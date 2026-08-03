import chalk from 'chalk';

function formatBytes(bytes) {
  const num = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec) {
  return formatBytes(bytesPerSec) + '/s';
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

function makeProgressBar(current, total, width = 20, char = '█') {
  if (total <= 0) return '[' + ' '.repeat(width) + ']';
  const ratio = Math.min(1, Math.max(0, current / total));
  const filledLength = Math.round(ratio * width);
  const emptyLength = width - filledLength;
  return '[' + chalk.cyan(char.repeat(filledLength)) + ' '.repeat(emptyLength) + ']';
}

export class DashboardUI {
  constructor() {
    this.logs = [];
    this.maxLogs = 8;
  }

  addLog(logItem) {
    const timeStr = new Date().toLocaleTimeString();
    this.logs.push({ ...logItem, time: timeStr });
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  render(snapshot) {
    // Clear screen & home cursor
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H');

    const width = 74;
    const borderLine = chalk.blue('─'.repeat(width));
    const titleBar = chalk.bgBlue.white.bold(` RatioMaster CLI v1.0.0 `) + chalk.bgGray.white(` BitTorrent Ratio Spoofer `);

    console.log(titleBar);
    console.log(borderLine);

    // Torrent info
    console.log(` ${chalk.bold.yellow('Torrent:')} ${chalk.white(snapshot.torrentName)}`);
    console.log(` ${chalk.bold.gray('InfoHash:')} ${chalk.gray(snapshot.infoHashHex)} | ${chalk.bold.gray('Size:')} ${chalk.white(formatBytes(snapshot.totalSizeBytes))}`);
    console.log(` ${chalk.bold.magenta('Client:')} ${chalk.cyan(snapshot.clientName)}`);
    console.log(borderLine);

    // Stats Grid
    const uploadedStr = chalk.green.bold(formatBytes(snapshot.uploadedBytes));
    const uploadSpeedStr = chalk.green(formatSpeed(snapshot.uploadSpeed));
    const downloadedStr = chalk.cyan(formatBytes(snapshot.downloadedBytes));
    const downloadSpeedStr = chalk.cyan(formatSpeed(snapshot.downloadSpeed));
    
    let ratioColor = chalk.white;
    if (snapshot.ratio >= 2.0) ratioColor = chalk.green.bold;
    else if (snapshot.ratio >= 1.0) ratioColor = chalk.yellow.bold;
    else ratioColor = chalk.red.bold;

    const ratioStr = ratioColor(snapshot.ratio.toFixed(3));

    console.log(` ${chalk.bold('TRANSFER STATISTICS')}`);
    console.log(`  Uploaded   : ${uploadedStr} (${uploadSpeedStr})`);
    console.log(`  Downloaded : ${downloadedStr} (${downloadSpeedStr})`);
    console.log(`  Ratio      : ${ratioStr} | Mode: ${chalk.yellow(snapshot.mode.toUpperCase())}`);
    console.log(`  Elapsed    : ${chalk.white(formatDuration(snapshot.elapsedSeconds))}`);
    console.log(borderLine);

    // Tracker Status
    const countdownBar = makeProgressBar(snapshot.trackerInterval - snapshot.nextAnnounceCountdown, snapshot.trackerInterval, 25);
    console.log(` ${chalk.bold('TRACKER STATUS')}`);
    console.log(`  Peers      : ${chalk.green(snapshot.seeders + ' Seeders')} / ${chalk.red(snapshot.leechers + ' Leechers')}`);
    console.log(`  Next Update: ${chalk.yellow(snapshot.nextAnnounceCountdown + 's')} ${countdownBar}`);
    console.log(`  Last Status: ${snapshot.lastResponseStatus.startsWith('OK') ? chalk.green(snapshot.lastResponseStatus) : chalk.red(snapshot.lastResponseStatus)}`);
    console.log(borderLine);

    // Activity Log
    console.log(` ${chalk.bold('ACTIVITY LOG')}`);
    if (this.logs.length === 0) {
      console.log(`  ${chalk.gray('No events recorded yet...')}`);
    } else {
      for (const log of this.logs) {
        let badge = chalk.blue('[INFO]');
        if (log.level === 'success') badge = chalk.green('[OK]  ');
        else if (log.level === 'warning') badge = chalk.yellow('[WARN]');
        else if (log.level === 'error') badge = chalk.red('[ERR] ');

        console.log(`  ${chalk.gray(log.time)} ${badge} ${log.message}`);
      }
    }

    console.log(borderLine);
    console.log(` ${chalk.gray('Press')} ${chalk.bold.red('Ctrl+C')} ${chalk.gray('to safely stop simulation and notify tracker.')}`);
  }
}
