// Generates PNG icons without external dependencies (Node.js built-ins only)
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

/* ── CRC32 ── */
const CRC = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC[i] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* ── PNG writer ── */
function chunk(type, data) {
  const t = Buffer.from(type), d = Buffer.from(data);
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crc]);
}

function makePNG(size, drawFn) {
  const px = new Uint8Array(size * size * 4);
  drawFn(px, size);

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      const d = y * (size * 4 + 1) + 1 + x * 4;
      raw[d] = px[s]; raw[d+1] = px[s+1]; raw[d+2] = px[s+2]; raw[d+3] = px[s+3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── Pixel helpers ── */
function fill(px, size, x, y, r, g, b) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = 255;
}

function fillRect(px, size, x1, y1, x2, y2, r, g, b) {
  for (let y = y1; y < y2; y++)
    for (let x = x1; x < x2; x++)
      fill(px, size, x, y, r, g, b);
}

/* ── Icon draw function ── */
function drawIcon(px, size) {
  const [br, bg, bb] = [229, 96, 26];   // #E5601A background
  const [fr, fg, fb] = [255, 255, 255]; // white letter

  // Background: full orange square (iOS masks to squircle automatically)
  for (let i = 0; i < size * size * 4; i += 4) {
    px[i] = br; px[i+1] = bg; px[i+2] = bb; px[i+3] = 255;
  }

  // "N" letter
  const sw   = Math.round(size * 0.115); // stroke width
  const top  = Math.round(size * 0.185);
  const bot  = Math.round(size * 0.815);
  const lx   = Math.round(size * 0.195); // left bar x
  const rx   = Math.round(size * 0.805); // right bar x (end)

  // Left vertical bar
  fillRect(px, size, lx, top, lx + sw, bot, fr, fg, fb);

  // Right vertical bar
  fillRect(px, size, rx - sw, top, rx, bot, fr, fg, fb);

  // Diagonal: top-left → bottom-right (thick line via perpendicular slabs)
  const ax = lx + sw / 2, ay = top;
  const bx = rx - sw / 2, by = bot;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len; // unit normal
  const half = sw * 0.55;
  const steps = Math.ceil(len * 1.5);

  for (let s = 0; s <= steps; s++) {
    const t  = s / steps;
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    for (let k = -half; k <= half; k++) {
      fill(px, size, Math.round(cx + nx * k), Math.round(cy + ny * k), fr, fg, fb);
    }
  }
}

/* ── Generate files ── */
const dir = path.join(__dirname, 'icons');
fs.mkdirSync(dir, { recursive: true });

const sizes = [
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

for (const { size, name } of sizes) {
  const png = makePNG(size, drawIcon);
  fs.writeFileSync(path.join(dir, name), png);
  console.log(`✓ icons/${name} (${size}×${size})`);
}
