/** A tiny PNG encoder for the bake and export scripts (no image library in the repo): RGBA pixels in, an RGB PNG out. */
import { deflateSync, crc32 } from "node:zlib";

/** RGBA pixels -> PNG (RGB, "Sub" filtered rows: flat map colours compress well) */
export function png(px: Uint8ClampedArray | Uint8Array, size: number): Buffer {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 1;
    for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) {
      const v = px[(y * size + x) * 4 + c]!, left = x ? px[(y * size + x - 1) * 4 + c]! : 0;
      raw[row + 1 + x * 3 + c] = (v - left) & 255;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

