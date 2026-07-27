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

function icon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.2;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const dx = Math.max(radius - x, 0, x - (size - 1 - radius));
    const dy = Math.max(radius - y, 0, y - (size - 1 - radius));
    const inside = dx * dx + dy * dy <= radius * radius;
    const offset = (y * size + x) * 4;
    if (!inside) continue;
    const gradient = Math.round(28 * y / size);
    pixels[offset] = 37; pixels[offset + 1] = 99 + gradient; pixels[offset + 2] = 235; pixels[offset + 3] = 255;
    const nx = x / size; const ny = y / size;
    const leftStroke = Math.abs(nx - (0.28 + (0.5 - ny) * 0.28)) < 0.055;
    const rightStroke = Math.abs(nx - (0.72 - (0.5 - ny) * 0.28)) < 0.055;
    const cross = ny > 0.53 && ny < 0.62 && nx > 0.33 && nx < 0.67;
    if (ny > 0.2 && ny < 0.82 && (leftStroke || rightStroke || cross)) {
      pixels[offset] = 255; pixels[offset + 1] = 255; pixels[offset + 2] = 255;
    }
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
