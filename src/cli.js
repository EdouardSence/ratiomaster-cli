import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { extractTorrentMetadata } from './bencode.js';
import { CLIENT_PRESETS, ClientInstance } from './clients.js';
import { SimulationEngine } from './simulator.js';
import { DashboardUI } from './ui.js';

function parseSingleSpeed(str) {
  if (typeof str !== 'string') return NaN;
  const match = str.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) return parseFloat(str);
  const val = parseFloat(match[1]);
  const unit = (match[2] || 'KB').toUpperCase().replace('O', 'B'); // Mo -> MB, Ko -> KB
  if (unit === 'MB' || unit === 'M') return val * 1024;
  if (unit === 'GB' || unit === 'G') return val * 1024 * 1024;
  if (unit === 'KB' || unit === 'K') return val;
  if (unit === 'B') return val / 1024;
  return val;
}

function parseSpeedRange(input, defaultMin = 500, defaultMax = 1500) {
  if (!input) return { min: defaultMin, max: defaultMax };
  if (input.includes('-')) {
    const parts = input.split('-');
    const min = parseSingleSpeed(parts[0]);
    const max = parseSingleSpeed(parts[1]);
    return { min: isNaN(min) ? defaultMin : min, max: isNaN(max) ? defaultMax : max };
  }
  const val = parseSingleSpeed(input);
  return { min: isNaN(val) ? defaultMin : val, max: isNaN(val) ? defaultMax : val };
}

function parseSize(input) {
  if (!input) return null;
  const match = input.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  const unit = (match[2] || 'MB').toUpperCase();
  const units = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };
  const multiplier = units[unit] || units['MB'];
  return Math.round(val * multiplier);
}

export async function runCLI(argv) {
  const program = new Command();

  program
    .name('ratiomaster')
    .description('CLI port of RatioMaster.NET - BitTorrent ratio spoofer & tracker announce simulator')
    .version('1.0.0')
    .argument('[torrents...]', 'Path to one or multiple .torrent files')
    .option('-c, --client <name>', 'BitTorrent client profile to emulate', 'qBittorrent-4.6.3')
    .option('-u, --upload <speed>', 'Upload speed in KB/s (fixed e.g. "1000" or range "500-1500")', '500-1500')
    .option('-d, --download <speed>', 'Download speed in KB/s (fixed e.g. "50" or range "10-100")', '0')
    .option('-p, --port <number>', 'Custom peer port to report to tracker')
    .option('-r, --stop-ratio <ratio>', 'Stop simulation once target ratio is reached (e.g. 2.0)', parseFloat)
    .option('-s, --stop-uploaded <size>', 'Stop simulation once target upload size is reached (e.g. "5GB" or "500MB")')
    .option('--stop-downloaded <size>', 'Stop simulation once target download size is reached (e.g. "2GB")')
    .option('-t, --stop-time <seconds>', 'Stop simulation after elapsed time in seconds', parseInt)
    .option('-i, --interval <seconds>', 'Override tracker announce interval in seconds', parseInt)
    .option('-m, --mode <seeding|leeching>', 'Initial mode: seeding (100% done) or leeching (0% done)', 'seeding')
    .option('-a, --announce-url <url>', 'Override announce URL from torrent file')
    .option('--custom-peer-id <id>', 'Custom 20-character Peer-ID to report to tracker')
    .option('--custom-user-agent <agent>', 'Custom HTTP User-Agent string')
    .option('--scrape', 'Fetch tracker scrape statistics (seeders/leechers) before announcing')
    .option('--gui', 'Launch the Web GUI interface in browser')
    .option('--gui-port <port>', 'Port for Web GUI server (default: 3000)', '3000')
    .option('--list-clients', 'List all supported client presets and exit')
    .option('--headless', 'Run without TUI full-screen interface (plain logging output)')
    .action(async (torrentPaths, options) => {
      if (options.gui) {
        const { startWebServer } = await import('./webserver.js');
        const port = parseInt(options.guiPort || '3000', 10);
        startWebServer(port);
        return;
      }
      if (options.listClients) {
        console.log(chalk.bold.blue('\nSupported BitTorrent Client Presets:\n'));
        for (const [key, preset] of Object.entries(CLIENT_PRESETS)) {
          console.log(`  ${chalk.green.bold(key.padEnd(22))} ${chalk.white(preset.name)} (${chalk.gray('PeerID prefix: ' + preset.peerIdPrefix)})`);
        }
        console.log('\nUse with: --client <name>\n');
        process.exit(0);
      }

      if (!torrentPaths || torrentPaths.length === 0) {
        console.error(chalk.red.bold('\nError: Missing required .torrent file path(s)!'));
        console.log(chalk.gray('Run with --help for detailed usage instructions.\n'));
        process.exit(1);
      }

      const resolvedPath = path.resolve(torrentPaths[0]);
      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red.bold(`\nError: File not found: "${resolvedPath}"\n`));
        process.exit(1);
      }

      // Read torrent file
      let torrentMeta;
      try {
        const fileBuf = fs.readFileSync(resolvedPath);
        torrentMeta = extractTorrentMetadata(fileBuf);
      } catch (err) {
        console.error(chalk.red.bold(`\nError parsing torrent file: ${err.message}\n`));
        process.exit(1);
      }

      // Parse options
      const uploadRange = parseSpeedRange(options.upload, 500, 1500);
      const downloadRange = parseSpeedRange(options.download, 0, 0);
      const stopUploadedBytes = parseSize(options.stopUploaded);
      const stopDownloadedBytes = parseSize(options.stopDownloaded);

      // Create client instance
      const client = new ClientInstance(options.client, {
        port: options.port ? parseInt(options.port, 10) : undefined,
        peerId: options.customPeerId,
        userAgent: options.customUserAgent
      });

      // Create simulator instance
      const simulator = new SimulationEngine(torrentMeta, client, {
        minUploadRate: uploadRange.min,
        maxUploadRate: uploadRange.max,
        minDownloadRate: downloadRange.min,
        maxDownloadRate: downloadRange.max,
        mode: options.mode,
        stopRatio: options.stopRatio,
        stopUploaded: stopUploadedBytes,
        stopDownloaded: stopDownloadedBytes,
        stopTime: options.stopTime,
        customInterval: options.interval,
        announceUrl: options.announceUrl
      });

      const isHeadless = options.headless || !process.stdout.isTTY;
      const ui = isHeadless ? null : new DashboardUI();

      simulator.on('log', (logItem) => {
        if (ui) {
          ui.addLog(logItem);
        } else {
          const timestamp = new Date().toLocaleTimeString();
          let levelTag = '[INFO]';
          if (logItem.level === 'success') levelTag = chalk.green('[OK]  ');
          else if (logItem.level === 'warning') levelTag = chalk.yellow('[WARN]');
          else if (logItem.level === 'error') levelTag = chalk.red('[ERR] ');
          console.log(`${chalk.gray(timestamp)} ${levelTag} ${logItem.message}`);
        }
      });

      simulator.on('tick', (snapshot) => {
        if (ui) {
          ui.render(snapshot);
        }
      });

      let isExiting = false;
      const handleShutdown = async (signal) => {
        if (isExiting) return;
        isExiting = true;
        console.log(chalk.yellow(`\nReceived ${signal}. Stopping simulation cleanly...`));
        await simulator.stop();
        console.log(chalk.green('Final stats reported to tracker. Exiting cleanly.\n'));
        process.exit(0);
      };

      process.on('SIGINT', () => handleShutdown('SIGINT'));
      process.on('SIGTERM', () => handleShutdown('SIGTERM'));

      simulator.on('stopped', () => {
        if (!isExiting) {
          console.log(chalk.bold.green('\nSimulation completed cleanly. Exiting.'));
          process.exit(0);
        }
      });

      // Start engine
      await simulator.start();
    });

  await program.parseAsync(argv);
}
