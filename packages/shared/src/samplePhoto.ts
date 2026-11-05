// Sample accounts need a picture too. This makes a tiny solid-colour PNG for a name, so no image files are shipped.

const PALETTE: Array<[number, number, number]> = [
  [201, 154, 27],
  [110, 80, 52],
  [60, 90, 120],
  [120, 70, 90],
  [70, 110, 90],
  [150, 90, 50],
  [90, 90, 110],
  [160, 120, 80],
]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: number[]): number {
  let c = 0xffffffff
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]

function chunk(type: string, data: number[]): number[] {
  const body = [...type].map((c) => c.charCodeAt(0)).concat(data)
  return [...be32(data.length), ...body, ...be32(crc32(body))]
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const [a = 0, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]]
    const n = (a << 16) | (b << 8) | c
    out += BASE64[(n >> 18) & 63]! + BASE64[(n >> 12) & 63]! + (i + 1 < bytes.length ? BASE64[(n >> 6) & 63]! : '=') + (i + 2 < bytes.length ? BASE64[n & 63]! : '=')
  }
  return out
}

// The same name always gets the same colour
export function samplePhoto(seed: string): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const [r, g, b] = PALETTE[h % PALETTE.length]!
  const size = 8
  const raw: number[] = []
  for (let y = 0; y < size; y++) {
    raw.push(0)
    for (let x = 0; x < size; x++) raw.push(r, g, b)
  }
  // zlib with one stored (uncompressed) block, so no compressor is needed
  let s1 = 1
  let s2 = 0
  for (const v of raw) {
    s1 = (s1 + v) % 65521
    s2 = (s2 + s1) % 65521
  }
  const len = raw.length
  const zlib = [0x78, 0x01, 0x01, len & 255, len >> 8, ~len & 255, (~len >> 8) & 255, ...raw, ...be32(((s2 << 16) | s1) >>> 0)]
  const png = [137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', [...be32(size), ...be32(size), 8, 2, 0, 0, 0]), ...chunk('IDAT', zlib), ...chunk('IEND', [])]
  return `data:image/png;base64,${base64(png)}`
}
