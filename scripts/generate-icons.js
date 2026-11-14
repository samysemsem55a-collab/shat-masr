import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal PNG encoder using node's built-in zlib
function createSolidPng(width, height, r, g, b, a = 255) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw Image Data (with filter byte 0 at start of each scanline)
  const lineSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * lineSize);

  const cx = width / 2;
  const cy = height / 2;
  const outerR = width * 0.46;
  const innerR = width * 0.42;

  for (let y = 0; y < height; y++) {
    const offset = y * lineSize;
    rawData[offset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= innerR) {
        // Chat emblem emerald/gold gradient
        const t = (x + y) / (width + height);
        rawData[pxOffset + 0] = Math.round(16 + t * 40);   // R
        rawData[pxOffset + 1] = Math.round(185 + t * 30);  // G
        rawData[pxOffset + 2] = Math.round(129 - t * 40);  // B
        rawData[pxOffset + 3] = 255;
      } else if (dist <= outerR) {
        // Gold glowing ring
        rawData[pxOffset + 0] = 245;
        rawData[pxOffset + 1] = 158;
        rawData[pxOffset + 2] = 11;
        rawData[pxOffset + 3] = 255;
      } else {
        // Deep background
        rawData[pxOffset + 0] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  
  // CRC32 calculation
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// Table-based CRC32
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate PNGs: 192x192, 512x512, apple-touch-icon (180x180)
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createSolidPng(192, 192, 5, 20, 16));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createSolidPng(512, 512, 5, 20, 16));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createSolidPng(512, 512, 5, 20, 16));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createSolidPng(180, 180, 5, 20, 16));

// 2. Generate SVG Brand Icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#061814" />
      <stop offset="100%" stop-color="#020806" />
    </linearGradient>
    <linearGradient id="primary" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bg)" />
  <circle cx="256" cy="256" r="190" stroke="url(#gold)" stroke-width="8" fill="none" opacity="0.6" />
  <!-- Chat Bubble with Crown and Mic -->
  <path d="M140 180 C140 130, 372 130, 372 180 C372 260, 240 280, 210 330 C200 345, 175 320, 170 300 C150 290, 140 230, 140 180 Z" fill="url(#primary)" />
  <!-- Crescent Moon & Star -->
  <path d="M290 180 A 30 30 0 1 1 310 235 A 40 40 0 1 0 290 180 Z" fill="url(#gold)" />
  <circle cx="330" cy="190" r="8" fill="#fbbf24" />
  <!-- Mic symbol -->
  <rect x="236" y="195" width="40" height="70" rx="20" fill="#ffffff" />
  <path d="M220 235 C220 275, 292 275, 292 235" stroke="#ffffff" stroke-width="12" stroke-linecap="round" fill="none" />
  <path d="M256 275 L256 305 M230 305 L282 305" stroke="#ffffff" stroke-width="12" stroke-linecap="round" />
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

console.log('PWA icons successfully generated in /public!');
