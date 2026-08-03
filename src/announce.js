import http from 'http';
import https from 'https';
import zlib from 'zlib';
import { URL } from 'url';
import { decodeBencode } from './bencode.js';

export async function sendAnnounce({
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

  // Preserve existing query params from announceUrl (e.g. passkey / passkey=xyz)
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
          // If body is plain text or HTML error
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
