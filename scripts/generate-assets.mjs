/**
 * Generates the default demo assets: assets/funk.png (skull face) and
 * assets/funk.mp3 (short two-tone "womp womp" beep). Pure Node, no external
 * runtime deps; MP3 encoding uses lamejs (devDependency).
 *
 * Run via: npm run generate-assets
 */
import * as zlib from 'node:zlib';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// lamejs's modular entry point is broken (missing globals), and its bundled
// lame.min.js defines a file-scoped global `lamejs()` that must be invoked to
// attach Mp3Encoder. Load it via vm to get that behavior.
const vm = await import('node:vm');
vm.runInThisContext(
  fs.readFileSync(
    require.resolve('lamejs/lame.min.js'),
    'utf8',
  ),
  { filename: 'lame.min.js' },
);
lamejs();
const lamejsEncoder = lamejs;

const W = 320;
const H = 320;
const buf = Buffer.alloc(W * H * 4);

function put(x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function fillEllipse(cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(x, y, color);
    }
  }
}

function fillRect(x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) put(x, y, color);
  }
}

const SKULL = [245, 245, 250, 255];
const DARK = [25, 20, 30, 255];
const GLYPH = [255, 45, 150, 255];

// Head: big rounded skull.
fillEllipse(160, 150, 110, 95, SKULL);
// Jaw hints: side shading.
fillEllipse(160, 230, 70, 40, SKULL);
// Eyes.
fillEllipse(120, 140, 26, 32, DARK);
fillEllipse(200, 140, 26, 32, DARK);
// Crossbones-style glow dots above eyes.
put(120, 96, GLYPH);
put(200, 96, GLYPH);
// Nose: triangle.
for (let y = 0; y < 26; y++) {
  const half = Math.floor((y / 3) + 3);
  for (let x = -half; x <= half; x++) put(160 + x, 172 + y, DARK);
}
// Teeth: two rows of blocky teeth on the jaw.
for (let i = 0; i < 6; i++) {
  const x0 = 130 + i * 11;
  fillRect(x0, 218, x0 + 9, 232, DARK);
  fillRect(x0, 236, x0 + 9, 250, DARK);
}
// Jaw seam between rows.
fillRect(126, 234, 200, 236, SKULL);
// Pink cheek accents for a funkier look.
fillEllipse(96, 178, 12, 8, GLYPH);
fillEllipse(224, 178, 12, 8, GLYPH);

// Encode PNG manually: scanlines with filter 0 + zlib deflate.
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  crc = (crc ^ 0xffffffff) >>> 0;
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc);
  return Buffer.concat([len, body, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

/* ---------- MP3: two-tone descending "womp womp" ---------- */
const sampleRate = 44100;
const notes = [220, 165]; // A3 -> E3
const noteDur = 0.28;
const samplesPerNote = Math.floor(noteDur * sampleRate);
const mono = new Int16Array(samplesPerNote * notes.length);

for (let n = 0; n < notes.length; n++) {
  for (let i = 0; i < samplesPerNote; i++) {
    const t = i / sampleRate;
    // Sawtooth-ish combo + decay envelope for a game-over feel.
    const env = Math.exp(-t * 6);
    const s =
      Math.sin(2 * Math.PI * notes[n] * t) * 0.6 +
      Math.sin(2 * Math.PI * notes[n] * 2 * t) * 0.25 +
      Math.sin(2 * Math.PI * notes[n] * 1.5 * t) * 0.15;
    mono[n * samplesPerNote + i] = Math.max(-32768, Math.min(32767, Math.floor(s * env * 26000)));
  }
}

const mp3enc = new lamejsEncoder.Mp3Encoder(1, sampleRate, 128);

const mp3Data = [];
const blockSize = 1152;
for (let i = 0; i < mono.length; i += blockSize) {
  const enc = mp3enc.encodeBuffer(mono.subarray(i, i + blockSize));
  if (enc.length > 0) mp3Data.push(Buffer.from(enc));
}
const flush = mp3enc.flush();
if (flush.length > 0) mp3Data.push(Buffer.from(flush));

fs.mkdirSync(path.resolve('assets'), { recursive: true });
fs.writeFileSync(path.join('assets', 'funk.png'), png);
fs.writeFileSync(path.join('assets', 'funk.mp3'), Buffer.concat(mp3Data));
console.log('Generated assets/funk.png and assets/funk.mp3');
