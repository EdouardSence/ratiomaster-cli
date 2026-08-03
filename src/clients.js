import crypto from 'crypto';

/**
 * Random character generator helpers.
 */
function randomAlphanumeric(length) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function randomNumeric(length) {
  const chars = '0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function randomHex(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function randomBytesUrlEncoded(length) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map(b => '%' + b.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

/**
 * Client Presets Registry
 */
export const CLIENT_PRESETS = {
  'qBittorrent-5.2.3': {
    name: 'qBittorrent 5.2.3',
    userAgent: 'qBittorrent/5.2.3',
    peerIdPrefix: '-qB5230-',
    peerIdType: 'alphanumeric',
    keyType: 'hex',
    defPort: 6881,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  },
  'qBittorrent-5.0.0': {
    name: 'qBittorrent 5.0.0',
    userAgent: 'qBittorrent/5.0.0',
    peerIdPrefix: '-qB5000-',
    peerIdType: 'alphanumeric', // 12 chars
    keyType: 'hex', // 8 chars
    defPort: 6881,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  },
  'qBittorrent-4.6.3': {
    name: 'qBittorrent 4.6.3',
    userAgent: 'qBittorrent/4.6.3',
    peerIdPrefix: '-qB4630-',
    peerIdType: 'alphanumeric',
    keyType: 'hex',
    defPort: 6881,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  },
  'qBittorrent-4.5.2': {
    name: 'qBittorrent 4.5.2',
    userAgent: 'qBittorrent/4.5.2',
    peerIdPrefix: '-qB4520-',
    peerIdType: 'alphanumeric',
    keyType: 'hex',
    defPort: 6881,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  },
  'Transmission-4.0.5': {
    name: 'Transmission 4.0.5',
    userAgent: 'Transmission/4.0.5',
    peerIdPrefix: '-TR4050-',
    peerIdType: 'alphanumeric',
    keyType: 'hex',
    defPort: 51413,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  },
  'Transmission-3.00': {
    name: 'Transmission 3.00',
    userAgent: 'Transmission/3.00',
    peerIdPrefix: '-TR3000-',
    peerIdType: 'alphanumeric',
    keyType: 'hex',
    defPort: 51413,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  },
  'uTorrent-3.5.5': {
    name: 'uTorrent 3.5.5',
    userAgent: 'uTorrent/3550(109033410)(46542)',
    peerIdPrefix: '-UT355u-',
    peerIdType: 'alphanumeric',
    keyType: 'hex',
    defPort: 34567,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  },
  'uTorrent-3.3.2': {
    name: 'uTorrent 3.3.2',
    userAgent: 'uTorrent/3320(30303)',
    peerIdPrefix: '-UT3320-',
    peerIdType: 'alphanumeric',
    keyType: 'hex',
    defPort: 34567,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  },
  'Deluge-2.1.1': {
    name: 'Deluge 2.1.1',
    userAgent: 'Deluge/2.1.1 libtorrent/2.0.9.0',
    peerIdPrefix: '-DE2110-',
    peerIdType: 'alphanumeric',
    keyType: 'hex',
    defPort: 5881,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  },
  'BiglyBT-3.4.0': {
    name: 'BiglyBT 3.4.0',
    userAgent: 'BiglyBT 3.4.0.0;Windows 10;Java 17.0.1',
    peerIdPrefix: '-AZ3400-',
    peerIdType: 'alphanumeric',
    keyType: 'alphanumeric',
    defPort: 6881,
    headers: {
      'Accept-Encoding': 'gzip'
    },
    queryPattern: 'info_hash={infohash}&peer_id={peerid}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&corrupt=0&key={key}&event={event}&numwant={numwant}&compact=1&no_peer_id=1'
  }
};

export class ClientInstance {
  constructor(clientPresetName = 'qBittorrent-4.6.3', customOptions = {}) {
    const preset = CLIENT_PRESETS[clientPresetName] || CLIENT_PRESETS['qBittorrent-4.6.3'];
    
    this.name = preset.name;
    this.userAgent = customOptions.userAgent || preset.userAgent;
    this.peerIdPrefix = customOptions.peerIdPrefix || preset.peerIdPrefix;
    this.port = customOptions.port || preset.defPort || (Math.floor(Math.random() * (65535 - 1025)) + 1025);
    
    // Generate peer ID suffix
    const suffixLength = 20 - this.peerIdPrefix.length;
    if (preset.peerIdType === 'numeric') {
      this.peerIdSuffix = randomNumeric(suffixLength);
    } else if (preset.peerIdType === 'hex') {
      this.peerIdSuffix = randomHex(suffixLength);
    } else {
      this.peerIdSuffix = randomAlphanumeric(suffixLength);
    }

    this.peerId = this.peerIdPrefix + this.peerIdSuffix;
    
    // Convert peerId raw characters into URL encoded format for BitTorrent protocol
    this.peerIdUrlEncoded = Array.from(Buffer.from(this.peerId, 'utf8'))
      .map(b => '%' + b.toString(16).padStart(2, '0').toUpperCase())
      .join('');

    // Generate random key
    if (preset.keyType === 'numeric') {
      this.key = randomNumeric(8);
    } else if (preset.keyType === 'alphanumeric') {
      this.key = randomAlphanumeric(8);
    } else {
      this.key = randomHex(8).toUpperCase();
    }

    this.headers = {
      'User-Agent': this.userAgent,
      'Accept': '*/*',
      'Connection': 'close',
      ...(preset.headers || {})
    };

    this.queryPattern = preset.queryPattern;
  }
}
