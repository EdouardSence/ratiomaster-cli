import EventEmitter from 'events';
import { sendAnnounce, sendScrape } from './announce.js';

export class SimulationEngine extends EventEmitter {
  constructor(torrentMeta, client, options = {}) {
    super();
    this.torrentMeta = torrentMeta;
    this.client = client;

    // Speeds in Bytes per second
    this.minUploadSpeed = (options.minUploadRate || 500) * 1024;
    this.maxUploadSpeed = (options.maxUploadRate || 1500) * 1024;
    this.minDownloadSpeed = (options.minDownloadRate || 0) * 1024;
    this.maxDownloadSpeed = (options.maxDownloadRate || 0) * 1024;

    // Custom or initial values
    this.uploaded = BigInt(options.initialUploaded || 0);
    this.initialDownloaded = BigInt(options.initialDownloaded || 0);
    
    // Mode: 'seeding' (left = 0) vs 'leeching'
    this.mode = options.mode || 'seeding';
    if (this.mode === 'seeding') {
      this.downloaded = BigInt(torrentMeta.totalSize);
      this.left = 0n;
    } else {
      this.downloaded = this.initialDownloaded;
      this.left = BigInt(Math.max(0, torrentMeta.totalSize - Number(this.downloaded)));
    }

    // Stop conditions
    this.stopRatio = options.stopRatio || null;
    this.stopUploadedBytes = options.stopUploaded ? BigInt(options.stopUploaded) : null;
    this.stopDownloadedBytes = options.stopDownloaded ? BigInt(options.stopDownloaded) : null;
    this.stopTimeSeconds = options.stopTime || null;

    // Custom interval override
    this.customInterval = options.customInterval || null;

    // Anti-ban: Zero-Leecher Protection
    this.zeroLeechProtection = options.zeroLeechProtection !== false; // enabled by default
    this.zeroLeechAction = options.zeroLeechAction || 'pause'; // 'pause' | 'stop'
    this.isZeroLeechPaused = false;
    this.enableScrape = Boolean(options.scrape);

    // Internal State
    this.isRunning = false;
    this.isStopping = false;
    this.currentUploadSpeed = 0; // B/s
    this.currentDownloadSpeed = 0; // B/s
    this.elapsedSeconds = 0;
    this.nextAnnounceCountdown = 0;
    this.trackerInterval = 1800; // default 30 min
    this.activeAnnounceUrl = options.announceUrl || torrentMeta.announce;

    this.stats = {
      seeders: 0,
      leechers: 0,
      lastResponseStatus: 'Pending initial announce...',
      lastAnnounceTime: null,
      announceCount: 0
    };

    this.tickTimer = null;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit('log', { level: 'info', message: `Starting simulation for "${this.torrentMeta.name}"` });
    this.emit('log', { level: 'info', message: `Emulating client: ${this.client.name} (PeerID: ${this.client.peerId})` });

    if (this.zeroLeechProtection) {
      this.emit('log', { level: 'info', message: `Zero-leecher protection: active (action: ${this.zeroLeechAction})` });
    }

    // Optional Scrape before initial announce
    if (this.enableScrape) {
      this.emit('log', { level: 'info', message: 'Fetching tracker scrape statistics...' });
      try {
        const scrapeRes = await sendScrape({
          announceUrl: this.activeAnnounceUrl,
          torrentMeta: this.torrentMeta
        });
        if (scrapeRes) {
          this.stats.seeders = scrapeRes.complete;
          this.stats.leechers = scrapeRes.incomplete;
          this.emit('log', {
            level: 'info',
            message: `Scrape result: ${scrapeRes.complete} Seeders, ${scrapeRes.incomplete} Leechers`
          });
          if (this.zeroLeechProtection && scrapeRes.incomplete === 0) {
            if (this.zeroLeechAction === 'stop') {
              this.emit('log', {
                level: 'warning',
                message: '🛑 0 leechers detected in scrape. Aborting simulation before announce (anti-ban protection).'
              });
              this.isRunning = false;
              this.emit('stopped', this.getSnapshot());
              return;
            } else {
              this.isZeroLeechPaused = true;
              this.emit('log', {
                level: 'warning',
                message: '⚠️ 0 leechers detected in scrape. Upload initialized in paused state.'
              });
            }
          }
        }
      } catch (err) {
        this.emit('log', { level: 'warning', message: `Scrape failed: ${err.message}. Proceeding with announce.` });
      }
    }

    // Initial announce with event=started
    const success = await this.performAnnounce('started');
    if (!success && !this.isRunning) {
      return;
    }

    // Start 1-second tick loop for speed calculations, stop condition checks, and countdown
    this.tickTimer = setInterval(() => this.onTick(), 1000);
  }

  onTick() {
    if (!this.isRunning || this.isStopping) return;

    this.elapsedSeconds++;

    // Calculate current random speed (with zero-leecher pause check)
    if (this.zeroLeechProtection && this.isZeroLeechPaused) {
      this.currentUploadSpeed = 0;
    } else {
      this.currentUploadSpeed = this.getRandomSpeed(this.minUploadSpeed, this.maxUploadSpeed);
      // Add transfer bytes for this second
      this.uploaded += BigInt(Math.round(this.currentUploadSpeed));
    }

    this.currentDownloadSpeed = this.getRandomSpeed(this.minDownloadSpeed, this.maxDownloadSpeed);

    if (this.mode === 'leeching' && this.left > 0n) {
      const downloadedThisTick = BigInt(Math.round(this.currentDownloadSpeed));
      this.downloaded += downloadedThisTick;
      if (this.downloaded >= BigInt(this.torrentMeta.totalSize)) {
        this.downloaded = BigInt(this.torrentMeta.totalSize);
        this.left = 0n;
        this.mode = 'seeding';
        this.emit('log', { level: 'success', message: 'Download 100% completed! Switching to seeding mode.' });
        // Send completed event to tracker
        this.performAnnounce('completed');
      } else {
        this.left = BigInt(this.torrentMeta.totalSize) - this.downloaded;
      }
    }

    // Check stop conditions
    if (this.checkStopConditions()) {
      return;
    }

    // Countdown next announce
    this.nextAnnounceCountdown--;
    if (this.nextAnnounceCountdown <= 0) {
      this.performAnnounce(null);
    }

    this.emit('tick', this.getSnapshot());
  }

  getRandomSpeed(min, max) {
    if (min >= max) return min;
    return min + Math.random() * (max - min);
  }

  checkStopConditions() {
    const currentRatio = this.downloaded > 0n ? Number(this.uploaded) / Number(this.downloaded) : Number(this.uploaded) > 0 ? 999.99 : 0;

    if (this.stopRatio && currentRatio >= this.stopRatio) {
      this.emit('log', { level: 'success', message: `Target ratio of ${this.stopRatio} reached! (Current: ${currentRatio.toFixed(2)})` });
      this.stop();
      return true;
    }

    if (this.stopUploadedBytes && this.uploaded >= this.stopUploadedBytes) {
      this.emit('log', { level: 'success', message: 'Target upload byte count reached!' });
      this.stop();
      return true;
    }

    if (this.stopDownloadedBytes && this.downloaded >= this.stopDownloadedBytes) {
      this.emit('log', { level: 'success', message: 'Target download byte count reached!' });
      this.stop();
      return true;
    }

    if (this.stopTimeSeconds && this.elapsedSeconds >= this.stopTimeSeconds) {
      this.emit('log', { level: 'success', message: `Target simulation runtime of ${this.stopTimeSeconds}s reached!` });
      this.stop();
      return true;
    }

    return false;
  }

  async performAnnounce(event = null) {
    this.emit('log', { level: 'info', message: `Sending tracker announce (event: ${event || 'periodic'})...` });
    try {
      const res = await sendAnnounce({
        announceUrl: this.activeAnnounceUrl,
        torrentMeta: this.torrentMeta,
        client: this.client,
        uploaded: this.uploaded,
        downloaded: this.downloaded,
        left: this.left,
        event
      });

      this.stats.announceCount++;
      this.stats.lastAnnounceTime = new Date();

      if (res.success) {
        this.stats.seeders = res.complete;
        this.stats.leechers = res.incomplete;
        this.stats.lastResponseStatus = `OK (${res.complete} Seeders, ${res.incomplete} Leechers)`;
        
        // Interval update
        const recommendedInterval = this.customInterval || res.minInterval || res.interval || 1800;
        this.trackerInterval = recommendedInterval;
        this.nextAnnounceCountdown = recommendedInterval;

        this.emit('log', {
          level: 'success',
          message: `Tracker response: OK! Next announce in ${recommendedInterval}s (Seeders: ${res.complete}, Leechers: ${res.incomplete})`
        });
        if (res.warningMessage) {
          this.emit('log', { level: 'warning', message: `Tracker warning: ${res.warningMessage}` });
        }

        // Anti-ban: Zero-leecher check
        if (this.zeroLeechProtection) {
          if (res.incomplete === 0) {
            if (this.zeroLeechAction === 'stop') {
              this.emit('log', {
                level: 'warning',
                message: '🛑 0 leechers in swarm! Stopping simulation immediately (anti-ban protection).'
              });
              await this.stop();
              return true;
            } else {
              if (!this.isZeroLeechPaused) {
                this.isZeroLeechPaused = true;
                this.currentUploadSpeed = 0;
                this.emit('log', {
                  level: 'warning',
                  message: '⚠️ 0 leechers detected in swarm! Upload paused automatically to prevent ban. Periodic announces continue.'
                });
              }
            }
          } else if (this.isZeroLeechPaused && res.incomplete > 0) {
            this.isZeroLeechPaused = false;
            this.emit('log', {
              level: 'success',
              message: `🎉 Leechers detected (${res.incomplete})! Resuming simulated upload.`
            });
          }
        }

        return true;
      } else {
        this.stats.lastResponseStatus = `Failure: ${res.failureReason}`;
        this.nextAnnounceCountdown = 120; // retry in 2 min on error
        this.emit('log', { level: 'error', message: `Tracker error: ${res.failureReason}` });
        return false;
      }
    } catch (err) {
      this.stats.lastResponseStatus = `Error: ${err.message}`;
      this.nextAnnounceCountdown = 60; // retry in 1 min on network error
      this.emit('log', { level: 'error', message: `Network error announcing to tracker: ${err.message}` });
      return false;
    }
  }

  async stop() {
    if (!this.isRunning || this.isStopping) return;
    this.isStopping = true;
    this.emit('log', { level: 'info', message: 'Stopping simulation and flushing final stats to tracker...' });

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    try {
      await this.performAnnounce('stopped');
    } catch (err) {
      // ignore network errors on stop
    }

    this.isRunning = false;
    this.isStopping = false;
    this.emit('stopped', this.getSnapshot());
  }

  getSnapshot() {
    const totalSize = this.torrentMeta.totalSize;
    const currentRatio = this.downloaded > 0n 
      ? Number(this.uploaded) / Number(this.downloaded) 
      : (this.uploaded > 0n ? 999.99 : 0);

    return {
      torrentName: this.torrentMeta.name,
      infoHashHex: this.torrentMeta.infoHashHex,
      clientName: this.client.name,
      mode: this.mode,
      uploadedBytes: this.uploaded,
      downloadedBytes: this.downloaded,
      leftBytes: this.left,
      totalSizeBytes: totalSize,
      uploadSpeed: this.currentUploadSpeed,
      downloadSpeed: this.currentDownloadSpeed,
      ratio: currentRatio,
      elapsedSeconds: this.elapsedSeconds,
      nextAnnounceCountdown: this.nextAnnounceCountdown,
      trackerInterval: this.trackerInterval,
      seeders: this.stats.seeders,
      leechers: this.stats.leechers,
      isZeroLeechPaused: this.isZeroLeechPaused,
      zeroLeechProtection: this.zeroLeechProtection,
      zeroLeechAction: this.zeroLeechAction,
      lastResponseStatus: this.stats.lastResponseStatus,
      lastAnnounceTime: this.stats.lastAnnounceTime,
      announceCount: this.stats.announceCount
    };
  }
}
