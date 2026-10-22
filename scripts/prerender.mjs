/**
 * Runs after `vite build`. Writes one HTML file per public page into dist/ (for example
 * dist/blog/index.html and dist/products/<slug>/index.html) so search engines and social
 * link previews see the right title, description, picture and structured data.
 *
 * Content comes from your Supabase project when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * are available (live products and the text edited in the admin), and falls back to built-in
 * wording otherwise. It never fails the build.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BLOG_POSTS } from '../src/data/blogPosts.js'
import { absoluteUrl, linkListHtml, pageUrl, paragraphsHtml, renderPage } from './prerender-lib.mjs'

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
const site = configured && !/localhost|127\.0\.0\.1/.test(configured) ? configured : 'https://idermacare.com'

const SOCIAL = ['https://www.instagram.com/idermacare.pk/', 'https://www.facebook.com/idermacare.pk', 'https://www.tiktok.com/@idermacare.pk']

async function rest(path) {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return null
  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(15000),
    })
    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

const BLOG = BLOG_POSTS

const siteRow = await rest('site_content?select=document&id=eq.storefront')
const doc = siteRow?.[0]?.document ?? {}
const business = { name: 'iDermaCare', email: 'sales@idermacare.com', phone: '03079594474', address: 'Office#14, First Floor, Farooq 2D Plaza, G-13/3, Islamabad', ...(doc.business || {}) }
const siteName = business.name || 'iDermaCare'

const productRows = (await rest('products?select=name,slug,short_description,description,product_variants(price,currency,inventory_cache(quantity_available))&status=eq.published')) || []
const docProducts = Array.isArray(doc.products) ? doc.products : []
const products = productRows.map((row) => {
  const edited = docProducts.find((item) => item.slug === row.slug) || {}
  const variant = (row.product_variants || [])[0] || {}
  const stock = variant.inventory_cache?.[0]?.quantity_available ?? variant.inventory_cache?.quantity_available
  return {
    slug: row.slug,
    name: edited.name || row.name,
    description: String(edited.description || row.description || row.short_description || '').split('\n')[0],
    tagline: edited.tagline || row.short_description || '',
    image: edited.image || '',
    price: variant.price != null ? variant.price / 100 : Number(edited.price) || 0,
    currency: variant.currency || 'PKR',
    inStock: stock == null ? true : stock > 0,
  }
})

const logo = doc.logo || '/logo.png'
const defaultImage = products.find((item) => item.image)?.image || logo
const homeText = 'Authentic SADOER, Hero Cosmetics and SOME BY MI skincare in Pakistan. Orders are confirmed on WhatsApp and cash on delivery is available.'

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: siteName,
  url: site,
  logo: `${site}${logo.startsWith('/') ? '' : '/'}${logo}`,
  email: business.email,
  telephone: business.phone,
  address: { '@type': 'PostalAddress', streetAddress: business.address, addressCountry: 'PK' },
  sameAs: SOCIAL,
}

const pages = []

pages.push({
  path: '/',
  title: `${siteName} | Authentic skincare in Pakistan`,
  description: homeText,
  image: defaultImage,
  jsonLd: [organization, { '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: site }],
  heading: `${siteName} – authentic skincare`,
  bodyHtml: paragraphsHtml([homeText]) + linkListHtml(products.map((item) => ({ href: `/products/${item.slug}`, label: item.name })).concat([{ href: '/shop', label: 'Shop all products' }, { href: '/blog', label: 'Skincare blog' }, { href: '/track-order', label: 'Track your order' }])),
})

pages.push({
  path: '/shop',
  title: `Shop skincare | ${siteName}`,
  description: `Shop ${products.map((item) => item.name).slice(0, 3).join(', ') || 'authentic skincare'} and more. Cash on delivery across Pakistan.`,
  image: defaultImage,
  heading: 'Shop skincare',
  bodyHtml: linkListHtml(products.map((item) => ({ href: `/products/${item.slug}`, label: `${item.name} – Rs. ${item.price.toLocaleString('en-US')}` }))),
})

for (const item of products) {
  const productUrl = pageUrl(site, `/products/${item.slug}`)
  pages.push({
    path: `/products/${item.slug}`,
    title: `${item.name} | ${siteName}`,
    description: item.description || item.tagline || `${item.name} from ${siteName}.`,
    image: item.image || defaultImage,
    type: 'product',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: item.name,
        description: item.description || item.tagline,
        image: item.image ? [`${site}${item.image.startsWith('/') ? '' : '/'}${item.image}`] : undefined,
        brand: { '@type': 'Brand', name: siteName },
        offers: {
          '@type': 'Offer',
          url: productUrl,
          priceCurrency: item.currency,
          price: item.price,
          availability: item.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        },
      },
    ],
    heading: item.name,
    bodyHtml: paragraphsHtml([item.tagline, item.description, `Price: Rs. ${item.price.toLocaleString('en-US')}.`, item.inStock ? 'In stock. Cash on delivery across Pakistan.' : 'Currently out of stock.']) + linkListHtml([{ href: '/shop', label: 'Back to the shop' }]),
  })
}

pages.push({
  path: '/blog',
  title: `Blog | ${siteName}`,
  description: 'Skincare tips, ingredient guides and routines from iDermaCare.',
  image: defaultImage,
  heading: `The ${siteName} blog`,
  bodyHtml: linkListHtml(BLOG.map((post) => ({ href: `/blog/${post.slug}`, label: post.title }))),
})

for (const post of BLOG) {
  pages.push({
    path: `/blog/${post.slug}`,
    title: `${post.title} | ${siteName}`,
    description: post.excerpt,
    image: defaultImage,
    type: 'article',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        datePublished: post.date,
        author: { '@type': 'Organization', name: siteName },
        dateModified: post.date,
        image: absoluteUrl(site, defaultImage),
        publisher: { '@type': 'Organization', name: siteName, logo: { '@type': 'ImageObject', url: absoluteUrl(site, logo) } },
        mainEntityOfPage: pageUrl(site, `/blog/${post.slug}`),
      },
    ],
    heading: post.title,
    bodyHtml: paragraphsHtml(post.body?.length ? post.body : [post.excerpt]) + linkListHtml([{ href: '/shop', label: 'Shop authentic skincare' }, { href: '/blog', label: 'More skincare articles' }]),
  })
}

const about = doc.about || {}
pages.push({
  path: '/about',
  title: `${about.title || 'About us'} | ${siteName}`,
  description: (about.paragraphs || [])[0] || `${siteName} sells authentic skincare in Pakistan.`,
  image: about.image || defaultImage,
  heading: about.title || 'About us',
  bodyHtml: paragraphsHtml(about.paragraphs || []),
})
pages.push({
  path: '/contact',
  title: `Contact | ${siteName}`,
  description: `Contact ${siteName}: ${business.address}. Call ${business.phone} or email ${business.email}.`,
  image: defaultImage,
  heading: 'Contact us',
  bodyHtml: paragraphsHtml([business.address, `Phone: ${business.phone}`, `Email: ${business.email}`]),
})
pages.push({
  path: '/track-order',
  title: `Track your order | ${siteName}`,
  description: `Check where your ${siteName} order is with your order number and email.`,
  image: defaultImage,
  noindex: true,
  heading: 'Track your order',
  bodyHtml: paragraphsHtml(['Enter your order number and email to see where your order is.']),
})
pages.push({
  path: '/gallery',
  title: `Gallery | ${siteName}`,
  description: `Photos of authentic skincare from ${siteName}.`,
  image: defaultImage,
  heading: 'Gallery',
  bodyHtml: linkListHtml([{ href: '/shop', label: 'Shop all products' }]),
})

const policyDefaults = { shipping: 'Shipping policy', refund: 'Refund policy', privacy: 'Privacy policy', terms: 'Terms of service' }
for (const [key, fallback] of Object.entries(policyDefaults)) {
  const policy = doc.policies?.[key] || {}
  pages.push({
    path: `/${key}`,
    title: `${policy.title || fallback} | ${siteName}`,
    description: policy.body || `${fallback} for ${siteName}.`,
    image: defaultImage,
    heading: policy.title || fallback,
    bodyHtml: paragraphsHtml([policy.body]),
  })
}

if (!existsSync('dist/index.html')) {
  console.warn('prerender: dist/index.html not found; run `vite build` first. Skipping.')
  process.exit(0)
}
const template = readFileSync('dist/index.html', 'utf8')

const crumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], index) => ({ '@type': 'ListItem', position: index + 1, name, item: pageUrl(site, path) })),
})
for (const page of pages) {
  if (page.path.startsWith('/products/')) page.jsonLd = [...(page.jsonLd || []), crumb([['Home', '/'], ['Shop', '/shop'], [page.heading, page.path]])]
  if (page.path.startsWith('/blog/')) page.jsonLd = [...(page.jsonLd || []), crumb([['Home', '/'], ['Blog', '/blog'], [page.heading, page.path]])]
}

// Apache serves this file with a real 404 status for addresses that do not exist (see public/.htaccess).
writeFileSync(
  join('dist', '404.html'),
  renderPage(readFileSync('dist/index.html', 'utf8'), {
    path: '/404',
    title: `Page not found | ${siteName}`,
    description: `This page does not exist. Browse ${siteName} skincare instead.`,
    noindex: true,
    heading: 'Page not found',
    bodyHtml: paragraphsHtml(['We could not find that page.']) + linkListHtml([{ href: '/', label: 'Back to home' }, { href: '/shop', label: 'Shop all products' }]),
  }, { site, siteName }),
)

for (const page of pages) {
  const html = renderPage(template, page, { site, siteName })
  const file = page.path === '/' ? join('dist', 'index.html') : join('dist', page.path, 'index.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
}
console.log(`prerender: wrote ${pages.length} pages (${products.length} products, ${BLOG.length} blog posts) for ${site}`)
