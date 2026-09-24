// Script único, executado manualmente (não faz parte do runtime do app):
// rasteriza design/icon-source.svg nos tamanhos exigidos e monta o
// favicon.ico. Rodar de novo só se o ícone for redesenhado.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "..");
const publicDir = path.join(root, "public");

const svg = readFileSync(path.join(dirname, "icon-source.svg"));
const maskableSvg = readFileSync(path.join(dirname, "icon-maskable-source.svg"));

const targets = [
  { file: "icon-16.png", size: 16, source: svg },
  { file: "icon-32.png", size: 32, source: svg },
  { file: "icon-48.png", size: 48, source: svg },
  { file: "icon-192.png", size: 192, source: svg },
  { file: "icon-512.png", size: 512, source: svg },
  { file: "icon-512-maskable.png", size: 512, source: maskableSvg },
  { file: "apple-touch-icon.png", size: 180, source: svg },
];

for (const target of targets) {
  const outPath = path.join(publicDir, target.file);
  await sharp(target.source, { density: 384 })
    .resize(target.size, target.size)
    .png()
    .toFile(outPath);
  console.log("wrote", target.file);
}

// favicon.ico com os frames 16x16 e 32x32 (formato ICO aceita PNG cru
// embutido desde o Vista — todos os navegadores atuais suportam).
const png16 = await sharp(svg, { density: 384 }).resize(16, 16).png().toBuffer();
const png32 = await sharp(svg, { density: 384 }).resize(32, 32).png().toBuffer();
writeFileSync(path.join(publicDir, "favicon.ico"), buildIco([
  { size: 16, data: png16 },
  { size: 32, data: png32 },
]));
console.log("wrote favicon.ico");

function buildIco(images) {
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * images.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const dirEntries = [];
  const dataChunks = [];

  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    const sizeByte = img.size >= 256 ? 0 : img.size;
    entry.writeUInt8(sizeByte, 0); // width
    entry.writeUInt8(sizeByte, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.data.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    offset += img.data.length;
    dirEntries.push(entry);
    dataChunks.push(img.data);
  }

  return Buffer.concat([header, ...dirEntries, ...dataChunks]);
}
