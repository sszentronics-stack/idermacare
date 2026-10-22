import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JavaScript build script
import { clip, escapeHtml, jsonLdScript, paragraphsHtml, renderPage } from './prerender-lib.mjs'

const template = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="description"
      content="old description"
    />
    <title>iDermaCare</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

const ctx = { site: 'https://idermacare.com', siteName: 'iDermaCare' }

describe('prerender helpers', () => {
  it('escapes characters that could break out of an attribute', () => {
    expect(escapeHtml('"><script>x</script> & more')).toBe('&quot;&gt;&lt;script&gt;x&lt;/script&gt; &amp; more')
  })

  it('shortens long descriptions at a word boundary', () => {
    const text = 'word '.repeat(80)
    const result = clip(text, 100)
    expect(result.length).toBeLessThanOrEqual(100)
    expect(result.endsWith('…')).toBe(true)
    expect(clip('short text')).toBe('short text')
  })

  it('keeps structured data from closing its own script tag', () => {
    expect(jsonLdScript({ name: '</script><b>' })).not.toMatch(/<\/script><b>/)
    expect(jsonLdScript({ name: 'x' })).toContain('data-prerendered')
  })

  it('writes the right title, description, canonical and social tags', () => {
    const html = renderPage(
      template,
      { path: '/products/hero', title: 'Hero Patch | iDermaCare', description: 'A thin patch.', image: '/products/hero/1.jpg', type: 'product' },
      ctx,
    )
    expect(html).toContain('<title>Hero Patch | iDermaCare</title>')
    expect(html).toContain('<meta name="description" content="A thin patch." />')
    expect(html).not.toContain('old description')
    expect(html).toContain('<link rel="canonical" href="https://idermacare.com/products/hero" />')
    expect(html).toContain('<meta property="og:type" content="product" />')
    expect(html).toContain('<meta property="og:image" content="https://idermacare.com/products/hero/1.jpg" />')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
  })

  it('uses a small card when the page has no picture', () => {
    const html = renderPage(template, { path: '/track-order', title: 'Track', description: 'Track an order.' }, ctx)
    expect(html).toContain('<meta name="twitter:card" content="summary" />')
    expect(html).not.toContain('og:image')
  })

  it('adds structured data and a no-JavaScript summary but keeps the app root', () => {
    const html = renderPage(
      template,
      {
        path: '/blog/x',
        title: 'Post',
        description: 'Post text',
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: 'Post' }],
        heading: 'Post',
        bodyHtml: paragraphsHtml(['Hello <world>']),
      },
      ctx,
    )
    expect(html).toContain('"@type":"BlogPosting"')
    expect(html).toContain('<div id="root"></div>')
    expect(html).toContain('<noscript><main><h1>Post</h1><p>Hello &lt;world&gt;</p></main></noscript>')
  })

  it('escapes the page title', () => {
    const html = renderPage(template, { path: '/x', title: 'A & B <i>', description: 'd' }, ctx)
    expect(html).toContain('<title>A &amp; B &lt;i&gt;</title>')
  })
})
