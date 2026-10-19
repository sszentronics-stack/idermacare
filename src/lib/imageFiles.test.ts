import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS module
import { sortImageFiles, MAX_IMAGE_BYTES } from './imageFiles'

const file = (name: string, type: string, size = 1000) => ({ name, type, size })

describe('sortImageFiles', () => {
  it('accepts valid images and explains each rejection', () => {
    const { accepted, rejected } = sortImageFiles([
      file('a.jpg', 'image/jpeg'),
      file('b.gif', 'image/gif'),
      file('c.png', 'image/png', MAX_IMAGE_BYTES + 1),
      file('d.webp', 'image/webp'),
    ])
    expect(accepted.map((f: { name: string }) => f.name)).toEqual(['a.jpg', 'd.webp'])
    expect(rejected).toEqual(['b.gif: use JPG, PNG, WebP or AVIF', 'c.png: larger than 5 MB'])
  })

  it('handles empty input', () => {
    expect(sortImageFiles(null)).toEqual({ accepted: [], rejected: [] })
  })
})
