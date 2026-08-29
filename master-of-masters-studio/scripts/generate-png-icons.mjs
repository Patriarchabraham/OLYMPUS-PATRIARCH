import fs from 'fs';
import zlib from 'zlib';

function createSolidPng(width, height, r, g, b, a = 255) {
  // Simple uncompressed or deflate-compressed raw RGBA PNG encoder
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT raw scanlines (1 filter byte 0 + width*4 bytes per row)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Gradient / Emblem background
      const distFromCenter = Math.hypot(x - width / 2, y - height / 2) / (width / 2);
      if (distFromCenter < 0.85) {
        // Gold emblem / center glow
        const factor = Math.max(0, 1 - distFromCenter);
        rawData[pxOffset + 0] = Math.min(255, Math.floor(r * (0.6 + 0.4 * factor)));
        rawData[pxOffset + 1] = Math.min(255, Math.floor(g * (0.6 + 0.4 * factor)));
        rawData[pxOffset + 2] = Math.min(255, Math.floor(b * (0.6 + 0.4 * factor)));
        rawData[pxOffset + 3] = a;
      } else {
        // Dark metallic rim
        rawData[pxOffset + 0] = 11;
        rawData[pxOffset + 1] = 15;
        rawData[pxOffset + 2] = 25;
        rawData[pxOffset + 3] = a;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// CRC32 implementation
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

// Generate icon-192.png and icon-512.png (Rich Gold & Dark Sapphire Studio Palette)
const png192 = createSolidPng(192, 192, 245, 158, 11);
fs.writeFileSync('public/icon-192.png', png192);

const png512 = createSolidPng(512, 512, 239, 68, 68);
fs.writeFileSync('public/icon-512.png', png512);

console.log('✅ Generated public/icon-192.png and public/icon-512.png successfully!');
