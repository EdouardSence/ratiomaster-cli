import http from 'http';
import { parseSize } from './cli.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTorrentMetadata } from './bencode.js';
import { CLIENT_PRESETS, ClientInstance } from './clients.js';
import { SimulationEngine } from './simulator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

let currentSimulator = null;
const sseClients = new Set();

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const clientRes of sseClients) {
    clientRes.write(payload);
  }
}

export function startWebServer(port = 3000) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // Server-Sent Events endpoint
    if (url.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('retry: 1000\n\n');
      sseClients.add(res);

      if (currentSimulator) {
        res.write(`event: state\ndata: ${JSON.stringify(currentSimulator.getSnapshot())}\n\n`);
      }

      req.on('close', () => sseClients.delete(res));
      return;
    }

    // Get Presets
    if (url.pathname === '/api/clients' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(CLIENT_PRESETS));
    }

    // Parse Torrent File
    if (url.pathname === '/api/parse-torrent' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const bodyBuf = Buffer.concat(chunks);
          let fileBuf = bodyBuf;

          // If JSON request with path
          if (req.headers['content-type']?.includes('application/json')) {
            const bodyStr = bodyBuf.toString('utf8');
            const data = JSON.parse(bodyStr);
            if (data.filePath) {
              fileBuf = fs.readFileSync(path.resolve(data.filePath));
            }
          }

          const meta = extractTorrentMetadata(fileBuf);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, meta }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Start Simulation
    if (url.pathname === '/api/start' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          
          if (currentSimulator && currentSimulator.isRunning) {
            await currentSimulator.stop();
          }

          let torrentMeta;
          if (body.torrentMeta) {
            torrentMeta = body.torrentMeta;
          } else if (body.filePath) {
            const fileBuf = fs.readFileSync(path.resolve(body.filePath));
            torrentMeta = extractTorrentMetadata(fileBuf);
          } else {
            throw new Error('No torrent metadata or file path provided');
          }

          const client = new ClientInstance(body.clientPreset || 'qBittorrent-5.2.3', {
            port: body.port ? parseInt(body.port, 10) : undefined,
            peerId: body.customPeerId,
            userAgent: body.customUserAgent
          });

          currentSimulator = new SimulationEngine(torrentMeta, client, {
            minUploadRate: body.minUploadRate || 500,
            maxUploadRate: body.maxUploadRate || 1500,
            minDownloadRate: body.minDownloadRate || 0,
            maxDownloadRate: body.maxDownloadRate || 0,
            mode: body.mode || 'seeding',
            stopRatio: body.stopRatio ? parseFloat(body.stopRatio) : null,
            stopUploaded: parseSize(body.stopUploaded),
            stopDownloaded: parseSize(body.stopDownloaded),
            stopTime: body.stopTime ? parseInt(body.stopTime, 10) : null,
            customInterval: body.customInterval ? parseInt(body.customInterval, 10) : null,
            announceUrl: body.announceUrl
          });

          currentSimulator.on('log', (logItem) => broadcastSSE('log', logItem));
          currentSimulator.on('tick', (snapshot) => broadcastSSE('tick', snapshot));
          currentSimulator.on('stopped', (snapshot) => broadcastSSE('stopped', snapshot));

          await currentSimulator.start();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Simulation started' }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Stop Simulation
    if (url.pathname === '/api/stop' && req.method === 'POST') {
      if (currentSimulator) {
        await currentSimulator.stop();
        currentSimulator = null;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: 'Simulation stopped' }));
    }

    // Get Current State
    if (url.pathname === '/api/state' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(currentSimulator ? currentSimulator.getSnapshot() : { isRunning: false }));
    }

    // Static Files (public/)
    let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml'
      };

      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  server.listen(port, () => {
    console.log(`\n🚀 RatioMaster Web GUI running at: http://localhost:${port}\n`);
  });

  return server;
}
