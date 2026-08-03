import crypto from 'crypto';

/**
 * Robust Bencode parser operating directly on Node.js Buffers.
 */
export function decodeBencode(buf) {
  let offset = 0;

  function parseNext() {
    if (offset >= buf.length) {
      throw new Error('Unexpected EOF while parsing bencode data');
    }

    const char = buf[offset];

    // Integer: i<number>e
    if (char === 0x69 /* 'i' */) {
      offset++;
      const end = buf.indexOf(0x65 /* 'e' */, offset);
      if (end === -1) throw new Error('Unterminated integer in bencode');
      const numStr = buf.toString('ascii', offset, end);
      offset = end + 1;
      return BigInt(numStr);
    }

    // List: l<items>e
    if (char === 0x6c /* 'l' */) {
      offset++;
      const list = [];
      while (buf[offset] !== 0x65 /* 'e' */) {
        if (offset >= buf.length) throw new Error('Unterminated list in bencode');
        list.push(parseNext());
      }
      offset++; // skip 'e'
      return list;
    }

    // Dictionary: d<key><value>e
    if (char === 0x64 /* 'd' */) {
      offset++;
      const dict = {};
      while (buf[offset] !== 0x65 /* 'e' */) {
        if (offset >= buf.length) throw new Error('Unterminated dictionary in bencode');
        const keyBuf = parseNext();
        const key = Buffer.isBuffer(keyBuf) ? keyBuf.toString('utf8') : String(keyBuf);
        const value = parseNext();
        dict[key] = value;
      }
      offset++; // skip 'e'
      return dict;
    }

    // String / Byte string: <length>:<bytes>
    if (char >= 0x30 && char <= 0x39 /* '0'-'9' */) {
      const colon = buf.indexOf(0x3a /* ':' */, offset);
      if (colon === -1) throw new Error('Invalid string length specifier in bencode');
      const len = parseInt(buf.toString('ascii', offset, colon), 10);
      const start = colon + 1;
      const end = start + len;
      if (end > buf.length) throw new Error('String length exceeds buffer boundaries');
      offset = end;
      return buf.subarray(start, end);
    }

    throw new Error(`Unexpected byte 0x${char.toString(16)} at index ${offset}`);
  }

  return parseNext();
}

/**
 * Extracts raw bencoded info dictionary and calculates SHA1 info_hash.
 */
export function extractTorrentMetadata(buf) {
  let infoStart = -1;
  let infoEnd = -1;

  // Locate top level '4:info' dictionary slice in raw buffer
  const keyMarker = Buffer.from('4:info');
  const idx = buf.indexOf(keyMarker);
  if (idx !== -1) {
    infoStart = idx + keyMarker.length;
    // To accurately find info dictionary end, parse from infoStart
    let offset = infoStart;

    function skipElement() {
      const char = buf[offset];
      if (char === 0x69 /* 'i' */) {
        offset = buf.indexOf(0x65 /* 'e' */, offset) + 1;
      } else if (char === 0x6c /* 'l' */ || char === 0x64 /* 'd' */) {
        offset++;
        while (buf[offset] !== 0x65 /* 'e' */) {
          skipElement();
        }
        offset++;
      } else if (char >= 0x30 && char <= 0x39) {
        const colon = buf.indexOf(0x3a, offset);
        const len = parseInt(buf.toString('ascii', offset, colon), 10);
        offset = colon + 1 + len;
      } else {
        throw new Error(`Error skipping byte 0x${char.toString(16)} at offset ${offset}`);
      }
    }

    skipElement();
    infoEnd = offset;
  }

  const parsed = decodeBencode(buf);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid torrent file: Root is not a dictionary');
  }

  const infoDict = parsed.info;
  if (!infoDict) {
    throw new Error('Invalid torrent file: Missing "info" dictionary');
  }

  let infoBuffer;
  if (infoStart !== -1 && infoEnd !== -1) {
    infoBuffer = buf.subarray(infoStart, infoEnd);
  } else {
    throw new Error('Could not slice info dictionary from torrent buffer');
  }

  const hashBuffer = crypto.createHash('sha1').update(infoBuffer).digest();
  const infoHashHex = hashBuffer.toString('hex');
  const infoHashUrlEncoded = Array.from(hashBuffer)
    .map(b => '%' + b.toString(16).padStart(2, '0').toUpperCase())
    .join('');

  // Calculate total size
  let totalSize = 0n;
  if (infoDict.length) {
    totalSize = BigInt(infoDict.length);
  } else if (Array.isArray(infoDict.files)) {
    for (const file of infoDict.files) {
      if (file.length) {
        totalSize += BigInt(file.length);
      }
    }
  }

  // Name
  let name = 'Unknown Torrent';
  if (infoDict.name) {
    name = Buffer.isBuffer(infoDict.name) ? infoDict.name.toString('utf8') : String(infoDict.name);
  }

  // Announce & Announce-list
  let announce = '';
  if (parsed.announce) {
    announce = Buffer.isBuffer(parsed.announce) ? parsed.announce.toString('utf8') : String(parsed.announce);
  }

  const announceList = [];
  if (announce) announceList.push(announce);

  if (Array.isArray(parsed['announce-list'])) {
    for (const tier of parsed['announce-list']) {
      if (Array.isArray(tier)) {
        for (const urlBuf of tier) {
          const urlStr = Buffer.isBuffer(urlBuf) ? urlBuf.toString('utf8') : String(urlBuf);
          if (urlStr && !announceList.includes(urlStr)) {
            announceList.push(urlStr);
          }
        }
      }
    }
  }

  // Piece length & total pieces
  const pieceLength = infoDict['piece length'] ? Number(infoDict['piece length']) : 0;
  const piecesBuf = infoDict.pieces;
  const pieceCount = (Buffer.isBuffer(piecesBuf) ? piecesBuf.length : 0) / 20;

  return {
    name,
    infoHashHex,
    infoHashUrlEncoded,
    infoHashBuffer: hashBuffer,
    announce,
    announceList,
    totalSize: Number(totalSize),
    pieceLength,
    pieceCount,
    isPrivate: infoDict.private === 1n || infoDict.private === 1
  };
}

/**
 * Encodes JavaScript data back to Bencode format Buffer.
 */
export function encodeBencode(data) {
  if (typeof data === 'bigint' || typeof data === 'number') {
    return Buffer.from(`i${data}e`);
  }
  if (typeof data === 'string') {
    const buf = Buffer.from(data, 'utf8');
    return Buffer.concat([Buffer.from(`${buf.length}:`), buf]);
  }
  if (Buffer.isBuffer(data)) {
    return Buffer.concat([Buffer.from(`${data.length}:`), data]);
  }
  if (Array.isArray(data)) {
    const parts = [Buffer.from('l')];
    for (const item of data) {
      parts.push(encodeBencode(item));
    }
    parts.push(Buffer.from('e'));
    return Buffer.concat(parts);
  }
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data).sort();
    const parts = [Buffer.from('d')];
    for (const k of keys) {
      parts.push(encodeBencode(k));
      parts.push(encodeBencode(data[k]));
    }
    parts.push(Buffer.from('e'));
    return Buffer.concat(parts);
  }
  throw new Error(`Cannot bencode unsupported type: ${typeof data}`);
}
