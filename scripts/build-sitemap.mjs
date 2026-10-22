/**
 * Builds public/sitemap.xml and public/robots.txt before every production build.
 * Lists the static pages, every blog post and (when Supabase is reachable) every
 * published product, so search engines can find the whole catalogue.
 *
 * Reads VITE_APP_URL (site address) and VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * from the environment or .env.local. It never fails the build: if products cannot be
 * fetched it writes the static pages and blog posts only.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

function readEnvFile() {
  const values = {}
  for (const name of ['.env', '.env.local']) {
    if (!existsSync(name)) continue
    for (const line of readFileSync(name, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
  return values
}

const env = { ...readEnvFile(), ...process.env }
const configured = (env.VITE_APP_URL || '').replace(/\/+$/, '')
// A local address would put useless links in the sitemap, so fall back to the real domain.
const site = configured && !/localhost|127\.0\.0\.1/.test(configured) ? configured : 'https://idermacare.com'
const today = new Date().toISOString().slice(0, 10)

const staticPaths = ['/', '/shop', '/gallery', '/blog', '/about', '/contact', '/shipping', '/refund', '/privacy', '/terms']

// Blog slugs live in src/data/blogPosts.js; read them without importing browser code.
const blogSource = readFileSync('src/data/blogPosts.js', 'utf8')
const blogPaths = [...blogSource.matchAll(/slug:\s*'([^']+)'/g)].map((match) => `/blog/${match[1]}`)

let productPaths = []
if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/products?select=slug&status=eq.published`, {
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
    })
    if (response.ok) productPaths = (await response.json()).map((row) => `/products/${row.slug}`)
    else console.warn(`sitemap: products request returned ${response.status}; skipping products.`)
  } catch (error) {
    console.warn('sitemap: could not fetch products; skipping.', error.message)
  }
}

const urls = [...staticPaths, ...blogPaths, ...productPaths]
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map((path) => `  <url><loc>${site}${path === '/' ? '/' : `${path}/`}</loc><lastmod>${today}</lastmod></url>`)
  .join('\n')}\n</urlset>\n`
writeFileSync('public/sitemap.xml', xml)

const robots = `User-agent: *
Allow: /
Disallow: /account
Disallow: /admin
Disallow: /checkout
Disallow: /cart
Disallow: /order-confirmation
Disallow: /track-order

Sitemap: ${site}/sitemap.xml
`
writeFileSync('public/robots.txt', robots)
console.log(`sitemap: wrote ${urls.length} URLs for ${site}`)
