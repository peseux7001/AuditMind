import fs from "node:fs";
import zlib from "node:zlib";

const sourcePath = "public/samples/bankbook-sample.png";
const outputPath = "public/samples/bankbook-sample-low-confidence.png";
const signatureLength = 8;

const source = fs.readFileSync(sourcePath);
let offset = signatureLength;
const chunks = [];
let width = 0;
let height = 0;
let colorType = 0;
let bitDepth = 0;
const idatParts = [];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

while (offset < source.length) {
  const length = source.readUInt32BE(offset);
  const type = source.toString("ascii", offset + 4, offset + 8);
  const data = source.subarray(offset + 8, offset + 8 + length);
  chunks.push({ type, data });
  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  }
  if (type === "IDAT") idatParts.push(data);
  offset += length + 12;
  if (type === "IEND") break;
}

if (bitDepth !== 8 || colorType !== 6) {
  throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
}

const bytesPerPixel = 4;
const stride = width * bytesPerPixel;
const inflated = zlib.inflateSync(Buffer.concat(idatParts));
const pixels = Buffer.alloc(height * stride);

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
};

for (let y = 0; y < height; y += 1) {
  const filter = inflated[y * (stride + 1)];
  const rowStart = y * (stride + 1) + 1;
  const outStart = y * stride;
  for (let x = 0; x < stride; x += 1) {
    const raw = inflated[rowStart + x];
    const left = x >= bytesPerPixel ? pixels[outStart + x - bytesPerPixel] : 0;
    const up = y > 0 ? pixels[outStart + x - stride] : 0;
    const upLeft = y > 0 && x >= bytesPerPixel ? pixels[outStart + x - stride - bytesPerPixel] : 0;
    if (filter === 0) pixels[outStart + x] = raw;
    else if (filter === 1) pixels[outStart + x] = (raw + left) & 0xff;
    else if (filter === 2) pixels[outStart + x] = (raw + up) & 0xff;
    else if (filter === 3) pixels[outStart + x] = (raw + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) pixels[outStart + x] = (raw + paeth(left, up, upLeft)) & 0xff;
    else throw new Error(`Unsupported PNG filter: ${filter}`);
  }
}

const setPixel = (x, y, rgba) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const index = (y * width + x) * bytesPerPixel;
  pixels[index] = rgba[0];
  pixels[index + 1] = rgba[1];
  pixels[index + 2] = rgba[2];
  pixels[index + 3] = rgba[3];
};

const rectangle = { x: 110, y: 135, w: 175, h: 34 };
for (let y = rectangle.y; y < rectangle.y + rectangle.h; y += 1) {
  for (let x = rectangle.x; x < rectangle.x + rectangle.w; x += 1) {
    const wave = Math.sin((x - rectangle.x) / 6) * 13 + Math.cos((y - rectangle.y) / 3) * 9;
    const stripe = (x + y * 3) % 17 < 8 ? 1 : 0;
    const base = stripe ? 238 : 248;
    setPixel(x, y, [base + wave * 0.15, 231 + wave * 0.1, 128 + wave * 0.04, 255].map((v, i) => (i === 3 ? v : Math.max(0, Math.min(255, Math.round(v))))));
  }
}

for (let i = 0; i < 10; i += 1) {
  const y = rectangle.y + 3 + i * 3;
  for (let x = rectangle.x + 4; x < rectangle.x + rectangle.w - 4; x += 1) {
    if ((x + i) % 5 !== 0) setPixel(x, y, [188, 87, 72, 255]);
  }
}

for (let y = rectangle.y - 2; y < rectangle.y + rectangle.h + 2; y += 1) {
  setPixel(rectangle.x - 2, y, [177, 40, 47, 255]);
  setPixel(rectangle.x + rectangle.w + 1, y, [177, 40, 47, 255]);
}
for (let x = rectangle.x - 2; x < rectangle.x + rectangle.w + 2; x += 1) {
  setPixel(x, rectangle.y - 2, [177, 40, 47, 255]);
  setPixel(x, rectangle.y + rectangle.h + 1, [177, 40, 47, 255]);
}

const rawRows = Buffer.alloc(height * (stride + 1));
for (let y = 0; y < height; y += 1) {
  rawRows[y * (stride + 1)] = 0;
  pixels.copy(rawRows, y * (stride + 1) + 1, y * stride, y * stride + stride);
}

const idatData = zlib.deflateSync(rawRows, { level: 9 });
const buildChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  const crcBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
};

const outputChunks = chunks.flatMap((chunk) => {
  if (chunk.type === "IDAT") return [];
  if (chunk.type === "IEND") return [buildChunk("IDAT", idatData), buildChunk("IEND", Buffer.alloc(0))];
  return [buildChunk(chunk.type, chunk.data)];
});

fs.writeFileSync(outputPath, Buffer.concat([source.subarray(0, signatureLength), ...outputChunks]));
console.log(outputPath);
