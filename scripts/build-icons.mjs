import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0); name.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1; const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared)) : 0;
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function icon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 4;
  const strokes = [
    [0.13, 0.80, 0.34, 0.20], [0.34, 0.20, 0.55, 0.80], [0.21, 0.59, 0.47, 0.59],
    [0.62, 0.22, 0.86, 0.22], [0.74, 0.22, 0.74, 0.80], [0.62, 0.80, 0.86, 0.80]
  ];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const offset = (y * size + x) * 4;
    let backgroundCoverage = 0; let textCoverage = 0;
    for (let sy = 0; sy < samples; sy += 1) for (let sx = 0; sx < samples; sx += 1) {
      const nx = (x + (sx + 0.5) / samples) / size;
      const ny = (y + (sy + 0.5) / samples) / size;
      const radius = 0.20;
      const dx = Math.max(radius - nx, 0, nx - (1 - radius));
      const dy = Math.max(radius - ny, 0, ny - (1 - radius));
      if (dx * dx + dy * dy > radius * radius) continue;
      backgroundCoverage += 1;
      if (strokes.some(([x1, y1, x2, y2]) => distanceToSegment(nx, ny, x1, y1, x2, y2) <= 0.045)) textCoverage += 1;
    }
    if (!backgroundCoverage) continue;
    const alpha = backgroundCoverage / (samples * samples);
    const white = textCoverage / backgroundCoverage;
    const gradient = 28 * (y + 0.5) / size;
    pixels[offset] = Math.round(37 * (1 - white) + 255 * white);
    pixels[offset + 1] = Math.round((99 + gradient) * (1 - white) + 255 * white);
    pixels[offset + 2] = Math.round(235 * (1 - white) + 255 * white);
    pixels[offset + 3] = Math.round(255 * alpha);
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const directory = new URL("../public/icons/", import.meta.url);
await mkdir(directory, { recursive: true });
await Promise.all([16, 32, 48, 128].map((size) => writeFile(new URL(`icon-${size}.png`, directory), icon(size))));
console.log("Generated extension icons.");
