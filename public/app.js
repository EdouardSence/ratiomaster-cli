document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('torrentFileInput');
  const filePathInput = document.getElementById('torrentFilePathInput');
  const btnParsePath = document.getElementById('btnParsePath');
  const torrentMetaBox = document.getElementById('torrentMetaBox');

  const metaName = document.getElementById('metaName');
  const metaSize = document.getElementById('metaSize');
  const metaHash = document.getElementById('metaHash');
  const metaAnnounce = document.getElementById('metaAnnounce');

  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const statusBadge = document.getElementById('statusBadge');

  const statUploadSpeed = document.getElementById('statUploadSpeed');
  const statUploadedTotal = document.getElementById('statUploadedTotal');
  const statDownloadSpeed = document.getElementById('statDownloadSpeed');
  const statDownloadedTotal = document.getElementById('statDownloadedTotal');
  const statRatio = document.getElementById('statRatio');
  const statMode = document.getElementById('statMode');
  const statPeers = document.getElementById('statPeers');
  const statCountdown = document.getElementById('statCountdown');
  const progressFill = document.getElementById('progressFill');
  const statLastStatus = document.getElementById('statLastStatus');
  const logConsole = document.getElementById('logConsole');
  const btnClearLogs = document.getElementById('btnClearLogs');

  let currentTorrentMeta = null;

  // Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Drag & Drop
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('hover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('hover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('hover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  btnParsePath.addEventListener('click', () => {
    const val = filePathInput.value.trim();
    if (!val) return alert('Veuillez entrer un chemin de fichier torrent valide.');
    parseTorrentByPath(val);
  });

  async function handleFileSelect(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const buffer = e.target.result;
      try {
        const res = await fetch('/api/parse-torrent', {
          method: 'POST',
          body: buffer
        });
        const data = await res.json();
        if (data.success) {
          displayTorrentMeta(data.meta);
        } else {
          alert('Erreur parsing torrent: ' + data.error);
        }
      } catch (err) {
        alert('Erreur réseau: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function parseTorrentByPath(filePath) {
    try {
      const res = await fetch('/api/parse-torrent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const data = await res.json();
      if (data.success) {
        displayTorrentMeta(data.meta);
      } else {
        alert('Erreur: ' + data.error);
      }
    } catch (err) {
      alert('Erreur réseau: ' + err.message);
    }
  }

  function displayTorrentMeta(meta) {
    currentTorrentMeta = meta;
    metaName.textContent = meta.name;
    metaSize.textContent = formatBytes(meta.totalSize);
    metaHash.textContent = meta.infoHashHex;
    metaAnnounce.textContent = meta.announce;
    torrentMetaBox.classList.remove('hidden');
    addLogLine('success', `Torrent chargé : "${meta.name}" (${formatBytes(meta.totalSize)})`);
  }

  // Start Simulation
  btnStart.addEventListener('click', async () => {
    if (!currentTorrentMeta && !filePathInput.value.trim()) {
      return alert('Veuillez d\'abord charger un fichier .torrent !');
    }

    const payload = {
      torrentMeta: currentTorrentMeta,
      filePath: filePathInput.value.trim() || undefined,
      clientPreset: document.getElementById('clientSelect').value,
      port: document.getElementById('portInput').value,
      mode: document.getElementById('modeSelect').value,
      customPeerId: document.getElementById('customPeerIdInput').value.trim() || undefined,
      customUserAgent: document.getElementById('customUserAgentInput').value.trim() || undefined,
      minUploadRate: parseFloat(document.getElementById('minUploadInput').value) || 500,
      maxUploadRate: parseFloat(document.getElementById('maxUploadInput').value) || 1500,
      minDownloadRate: parseFloat(document.getElementById('minDownloadInput').value) || 0,
      maxDownloadRate: parseFloat(document.getElementById('maxDownloadInput').value) || 0,
      stopRatio: document.getElementById('stopRatioInput').value || undefined,
      stopUploaded: document.getElementById('stopUploadedInput').value || undefined,
      stopDownloaded: document.getElementById('stopDownloadedInput').value || undefined,
      stopTime: document.getElementById('stopTimeInput').value || undefined,
      customInterval: document.getElementById('intervalInput').value || undefined
    };

    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        btnStart.disabled = true;
        btnStop.disabled = false;
        statusBadge.textContent = '● En cours de simulation';
        statusBadge.className = 'status-pill status-running';
      } else {
        alert('Erreur lancement: ' + data.error);
      }
    } catch (err) {
      alert('Erreur réseau: ' + err.message);
    }
  });

  // Stop Simulation
  btnStop.addEventListener('click', async () => {
    btnStop.disabled = true;
    try {
      await fetch('/api/stop', { method: 'POST' });
    } catch (e) {}
    onStopped();
  });

  function onStopped() {
    btnStart.disabled = false;
    btnStop.disabled = true;
    statusBadge.textContent = '● En attente';
    statusBadge.className = 'status-pill status-idle';
    statUploadSpeed.textContent = '0.00 MB/s';
    statDownloadSpeed.textContent = '0.00 MB/s';
  }

  // SSE Event Listener
  const evtSource = new EventSource('/api/events');
  evtSource.addEventListener('tick', (e) => {
    const s = JSON.parse(e.data);
    updateDashboard(s);
  });
  evtSource.addEventListener('log', (e) => {
    const log = JSON.parse(e.data);
    addLogLine(log.level, log.message);
  });
  evtSource.addEventListener('stopped', () => {
    onStopped();
    addLogLine('warning', 'Simulation arrêtée.');
  });

  function updateDashboard(s) {
    statUploadSpeed.textContent = formatSpeed(s.uploadSpeed);
    statUploadedTotal.textContent = 'Total: ' + formatBytes(s.uploadedBytes);
    statDownloadSpeed.textContent = formatSpeed(s.downloadSpeed);
    statDownloadedTotal.textContent = 'Total: ' + formatBytes(s.downloadedBytes);

    statRatio.textContent = s.ratio.toFixed(2);
    statMode.textContent = 'Mode: ' + s.mode.toUpperCase();
    statPeers.textContent = `${s.seeders} / ${s.leechers}`;
    statLastStatus.textContent = s.lastResponseStatus;

    if (s.nextAnnounceCountdown !== undefined) {
      statCountdown.textContent = formatDuration(s.nextAnnounceCountdown);
      const totalInt = s.trackerInterval || 1800;
      const pct = Math.min(100, Math.max(0, ((totalInt - s.nextAnnounceCountdown) / totalInt) * 100));
      progressFill.style.width = pct + '%';
    }
  }

  function addLogLine(level, msg) {
    const div = document.createElement('div');
    div.className = `log-line ${level}`;
    const time = new Date().toLocaleTimeString();
    div.textContent = `[${time}] ${msg}`;
    logConsole.appendChild(div);
    logConsole.scrollTop = logConsole.scrollHeight;
  }

  btnClearLogs.addEventListener('click', () => {
    logConsole.innerHTML = '';
  });

  // Helpers
  function formatBytes(bytes) {
    const num = typeof bytes === 'bigint' ? Number(bytes) : Number(bytes);
    if (isNaN(num) || num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatSpeed(bytesPerSec) {
    const mb = bytesPerSec / (1024 * 1024);
    if (mb >= 1) return mb.toFixed(2) + ' MB/s';
    const kb = bytesPerSec / 1024;
    return kb.toFixed(1) + ' KB/s';
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
});
