// The biggest picture a person may choose; it is shrunk before it is sent
export const MAX_PICTURE_BYTES = 10 * 1024 * 1024
export const TOO_BIG = 'The image exceeded the maximum size of 10 MB.'

// Crops a picture to a centred square and shrinks it, so a profile photo stays a few kilobytes
export async function squarePhoto(file: File, size = 256): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP picture.')
  if (file.size > MAX_PICTURE_BYTES) throw new Error(TOO_BIG)
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot resize pictures.')
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Crops a picture to a centred 4:5 portrait and shrinks it, for a competition's card on the home page
export async function coverPhoto(file: File, width = 720): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP picture.')
  const bitmap = await createImageBitmap(file)
  const height = Math.round(width * 1.25)
  const crop = Math.min(bitmap.width / width, bitmap.height / height)
  const sw = width * crop
  const sh = height * crop
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot resize pictures.')
  context.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.75)
}

// Shrinks a screenshot to at most `longest` pixels on its long side, keeping its shape, so a payment proof stays readable but small
export async function screenshotImage(file: File, longest = 1400): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP picture.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot resize pictures.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

// Shrinks a wide picture to at most 1600 pixels on its long side, keeping its shape, for the home page
export async function heroPhoto(file: File, longest = 1600): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP picture.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot resize pictures.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

// A picture of a signature as a small PNG with a clear background, so it prints cleanly over the signing line. It is
// shrunk to fit the box, and made smaller still until the server will take it.
export async function signatureImage(file: File, maxWidth = 600, maxHeight = 200, maxChars = 140_000): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP picture.')
  if (file.size > MAX_PICTURE_BYTES) throw new Error(TOO_BIG)
  const bitmap = await createImageBitmap(file)
  try {
    let scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
    for (let attempt = 0; attempt < 5; attempt++) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('This browser cannot resize pictures.')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
      // Near-white paper becomes clear; the ink stays
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i]! > 235 && pixels.data[i + 1]! > 235 && pixels.data[i + 2]! > 235) pixels.data[i + 3] = 0
      }
      context.putImageData(pixels, 0, 0)
      const png = canvas.toDataURL('image/png')
      if (png.length <= maxChars) return png
      scale *= 0.7
    }
  } finally {
    bitmap.close()
  }
  throw new Error('That picture is too detailed for a signature. Use a plain one.')
}
