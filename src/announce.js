import http from 'http';
import https from 'https';
import dgram from 'dgram';
import zlib from 'zlib';
import crypto from 'crypto';
import { URL } from 'url';
import { decodeBencode } from './bencode.js';

/**
 * Sends HTTP/HTTPS or UDP tracker announce.
 */
export async function sendAnnounce({
  announceUrl,
  torrentMeta,
  client,
  uploaded,
  downloaded,
  left,
  event = null,
  numwant = 200,
  timeoutMs = 15000,
  agent = null
}) {
  const urlObj = new URL(announceUrl);

  if (urlObj.protocol === 'udp:') {
    return sendUdpAnnounce({ announceUrl, torrentMeta, client, uploaded, downloaded, left, event, numwant, timeoutMs });
  }

  // Construct query string replacing placeholders
  let query = client.queryPattern
    .replace('{infohash}', torrentMeta.infoHashUrlEncoded)
    .replace('{peerid}', client.peerIdUrlEncoded)
    .replace('{port}', client.port)
    .replace('{uploaded}', uploaded.toString())
    .replace('{downloaded}', downloaded.toString())
    .replace('{left}', left.toString())
    .replace('{key}', client.key)
    .replace('{numwant}', numwant.toString());

  if (event) {
    query = query.replace('{event}', `&event=${event}`);
  } else {
    query = query.replace('{event}', '');
  }

  const existingSearch = urlObj.search ? urlObj.search.substring(1) : '';
  const finalSearch = existingSearch ? `${existingSearch}&${query}` : query;

  const requestOptions = {
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: `${urlObj.pathname}?${finalSearch}`,
    method: 'GET',
    headers: {
      'Host': urlObj.host,
      ...client.headers
    },
    agent,
    timeout: timeoutMs
  };

  const transport = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(requestOptions, (res) => {
      const chunks = [];

      let stream = res;
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createDeflate());
      }

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        const bodyBuf = Buffer.concat(chunks);

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Tracker HTTP error ${res.statusCode} ${res.statusMessage}`));
        }

        try {
          const decoded = decodeBencode(bodyBuf);

          if (decoded['failure reason']) {
            const failReason = Buffer.isBuffer(decoded['failure reason'])
              ? decoded['failure reason'].toString('utf8')
              : String(decoded['failure reason']);
            return resolve({
              success: false,
              failureReason: failReason,
              raw: decoded
            });
          }

          const interval = decoded.interval ? Number(decoded.interval) : 1800;
          const minInterval = decoded['min interval'] ? Number(decoded['min interval']) : null;
          const complete = decoded.complete !== undefined ? Number(decoded.complete) : (decoded.seeders !== undefined ? Number(decoded.seeders) : 0);
          const incomplete = decoded.incomplete !== undefined ? Number(decoded.incomplete) : (decoded.leechers !== undefined ? Number(decoded.leechers) : 0);
          
          let warningMessage = null;
          if (decoded['warning message']) {
            warningMessage = Buffer.isBuffer(decoded['warning message'])
              ? decoded['warning message'].toString('utf8')
              : String(decoded['warning message']);
          }

          resolve({
            success: true,
            statusCode: res.statusCode,
            interval,
            minInterval,
            complete,
            incomplete,
            warningMessage,
            raw: decoded
          });
        } catch (parseErr) {
          const rawText = bodyBuf.toString('utf8').substring(0, 200);
          reject(new Error(`Failed to parse tracker bencoded response: ${parseErr.message} (Raw: "${rawText}")`));
        }
      });

      stream.on('error', (err) => {
        reject(new Error(`Decompression error: ${err.message}`));
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Tracker request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(new Error(`Network error contacting tracker: ${err.message}`));
    });

    req.end();
  });
}

/**
 * BitTorrent UDP Tracker Protocol (BEP 15) Announce.
 */
export async function sendUdpAnnounce({
  announceUrl,
  torrentMeta,
  client,
  uploaded,
  downloaded,
  left,
  event = null,
  numwant = 200,
  timeoutMs = 15000
}) {
  const urlObj = new URL(announceUrl);
  const host = urlObj.hostname;
  const port = parseInt(urlObj.port || '80', 10);

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      socket.close();
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`UDP tracker timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const transactionId = crypto.randomBytes(4).readUInt32BE(0);

    // Step 1: Connect Request
    const connectReq = Buffer.alloc(16);
    connectReq.writeBigUInt64BE(0x41727101980n, 0); // protocol_id
    connectReq.writeUInt32BE(0, 8);                 // action = 0 (connect)
    connectReq.writeUInt32BE(transactionId, 12);     // transaction_id

    socket.on('error', (err) => {
      cleanup();
      reject(new Error(`UDP Socket error: ${err.message}`));
    });

    socket.on('message', (msg) => {
      if (msg.length < 8) return;

      const action = msg.readUInt32BE(0);
      const resTransId = msg.readUInt32BE(4);

      if (resTransId !== transactionId) return;

      if (action === 0) {
        // Connect Response: extract connection_id (8 bytes)
        if (msg.length < 16) {
          cleanup();
          return reject(new Error('Invalid UDP connect response length'));
        }
        const connectionId = msg.readBigUInt64BE(8);

        // Step 2: Send Announce Request
        const announceReq = Buffer.alloc(98);
        announceReq.writeBigUInt64BE(connectionId, 0);
        announceReq.writeUInt32BE(1, 8); // action = 1 (announce)
        announceReq.writeUInt32BE(transactionId, 12);
        
        // info_hash (20 bytes)
        torrentMeta.infoHashBuffer.copy(announceReq, 16);
        
        // peer_id (20 bytes)
        Buffer.from(client.peerId, 'utf8').copy(announceReq, 36);

        // downloaded, left, uploaded (64-bit ints)
        announceReq.writeBigUInt64BE(BigInt(downloaded), 56);
        announceReq.writeBigUInt64BE(BigInt(left), 64);
        announceReq.writeBigUInt64BE(BigInt(uploaded), 72);

        // event: 0=none, 1=completed, 2=started, 3=stopped
        let eventId = 0;
        if (event === 'completed') eventId = 1;
        else if (event === 'started') eventId = 2;
        else if (event === 'stopped') eventId = 3;
        announceReq.writeUInt32BE(eventId, 80);

        // IP address (0 = default)
        announceReq.writeUInt32BE(0, 84);

        // Key
        const keyNum = parseInt(client.key, 16) || 12345;
        announceReq.writeUInt32BE(keyNum, 88);

        // num_want (-1)
        announceReq.writeInt32BE(numwant, 92);

        // port
        announceReq.writeUInt16BE(client.port, 96);

        socket.send(announceReq, 0, announceReq.length, port, host);
      } else if (action === 1) {
        // Announce Response
        if (msg.length < 20) {
          cleanup();
          return reject(new Error('Invalid UDP announce response length'));
        }

        const interval = msg.readUInt32BE(8);
        const leechers = msg.readUInt32BE(12);
        const seeders = msg.readUInt32BE(16);

        cleanup();
        resolve({
          success: true,
          statusCode: 200,
          interval,
          minInterval: null,
          complete: seeders,
          incomplete: leechers,
          warningMessage: null,
          raw: { interval, seeders, leechers }
        });
      } else if (action === 3) {
        // Error response
        const errorMsg = msg.subarray(8).toString('utf8');
        cleanup();
        resolve({
          success: false,
          failureReason: errorMsg
        });
      }
    });

    // Send initial connect request
    socket.send(connectReq, 0, connectReq.length, port, host);
  });
}

/**
 * Sends HTTP/HTTPS or UDP tracker Scrape request.
 */
export async function sendScrape({ announceUrl, torrentMeta, timeoutMs = 10000 }) {
  const urlObj = new URL(announceUrl);

  if (urlObj.pathname.includes('/announce')) {
    urlObj.pathname = urlObj.pathname.replace('/announce', '/scrape');
  } else {
    urlObj.pathname = urlObj.pathname + '/scrape';
  }

  const query = `info_hash=${torrentMeta.infoHashUrlEncoded}`;
  const finalSearch = urlObj.search ? `${urlObj.search.substring(1)}&${query}` : query;

  const requestOptions = {
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: `${urlObj.pathname}?${finalSearch}`,
    method: 'GET',
    headers: { 'Host': urlObj.host },
    timeout: timeoutMs
  };

  const transport = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(requestOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const decoded = decodeBencode(Buffer.concat(chunks));
          if (decoded.files && decoded.files[torrentMeta.infoHashBuffer]) {
            const stats = decoded.files[torrentMeta.infoHashBuffer];
            resolve({
              complete: Number(stats.complete || stats.seeds || 0),
              incomplete: Number(stats.incomplete || stats.leeches || 0),
              downloaded: Number(stats.downloaded || 0)
            });
          } else {
            resolve({ complete: 0, incomplete: 0, downloaded: 0 });
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
