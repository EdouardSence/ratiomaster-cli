import assert from 'assert';
import { decodeBencode, encodeBencode, extractTorrentMetadata } from '../src/bencode.js';
import { CLIENT_PRESETS, ClientInstance } from '../src/clients.js';
import { SimulationEngine } from '../src/simulator.js';

console.log('Running extended test suite for ratiomaster-cli...\n');

// 1. Test Bencode encoder / decoder
{
  const data = {
    announce: 'http://tracker.example.com/announce',
    'announce-list': [['http://tracker.example.com/announce']],
    info: {
      length: 1048576n,
      name: Buffer.from('test_file.iso'),
      'piece length': 262144n,
      pieces: Buffer.alloc(80)
    }
  };

  const encoded = encodeBencode(data);
  const meta = extractTorrentMetadata(encoded);

  assert.strictEqual(meta.name, 'test_file.iso');
  assert.strictEqual(meta.announce, 'http://tracker.example.com/announce');
  assert.strictEqual(meta.totalSize, 1048576);
  assert.strictEqual(meta.pieceCount, 4);
  assert.strictEqual(meta.infoHashHex.length, 40);
  assert.strictEqual(meta.infoHashUrlEncoded.length, 60);

  console.log('✓ Bencode encoder & decoder test passed.');
}

// 2. Test Client Instance Generation (Modern & Custom)
{
  const qb = new ClientInstance('qBittorrent-5.2.3');
  assert.strictEqual(qb.name, 'qBittorrent 5.2.3');
  assert.strictEqual(qb.peerId.startsWith('-qB5230-'), true);
  assert.strictEqual(qb.peerId.length, 20);
  assert.strictEqual(qb.userAgent, 'qBittorrent/5.2.3');

  const custom = new ClientInstance('Custom', {
    peerId: '-CUSTOM-123456789012',
    userAgent: 'MyCustomAgent/1.0'
  });
  assert.strictEqual(custom.peerId, '-CUSTOM-123456789012');
  assert.strictEqual(custom.headers['User-Agent'], 'MyCustomAgent/1.0');

  console.log('✓ Client instance generation test passed.');
}

// 3. Test Simulation Engine Logic & Stop Conditions
{
  const dummyMeta = {
    name: 'Sample Movie',
    infoHashHex: '0123456789abcdef0123456789abcdef01234567',
    infoHashUrlEncoded: '%01%23%45%67%89%AB%CD%EF%01%23%45%67%89%AB%CD%EF%01%23%45%67',
    announce: 'udp://tracker.opentrackr.org:1337/announce',
    totalSize: 5000000
  };

  const client = new ClientInstance('qBittorrent-5.2.3');
  const engine = new SimulationEngine(dummyMeta, client, {
    minUploadRate: 1000,
    maxUploadRate: 1000,
    stopRatio: 2.0,
    stopDownloaded: 5000000
  });

  assert.strictEqual(engine.mode, 'seeding');
  assert.strictEqual(engine.left, 0n);
  assert.strictEqual(engine.stopDownloadedBytes, 5000000n);

  console.log('✓ Simulation engine unit test passed.');
}

console.log('\nAll extended tests passed successfully! 🎉');
