export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Splits dropped/picked files into usable images and human-readable rejections. */
export function sortImageFiles(fileList) {
  const accepted = []
  const rejected = []
  for (const file of Array.from(fileList || [])) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) rejected.push(`${file.name}: use JPG, PNG, WebP or AVIF`)
    else if (file.size > MAX_IMAGE_BYTES) rejected.push(`${file.name}: larger than 5 MB`)
    else accepted.push(file)
  }
  return { accepted, rejected }
}
