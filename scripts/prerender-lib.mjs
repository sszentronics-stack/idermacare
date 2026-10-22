/**
 * Pure helpers for build-time pre-rendering (see scripts/prerender.mjs).
 *
 * The storefront is a single-page app, so every URL used to serve the same empty HTML shell.
 * Search engines and link previews (WhatsApp, Facebook, TikTok) read the first HTML they
 * receive, so each public page now gets its own copy of the shell with the right title,
 * description, social-preview tags, structured data and a plain-text summary.
 * React still takes over in the browser exactly as before.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Trim to a sensible description length without cutting a word in half. */
export function clip(text, max = 160) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length)}…`
}

/** JSON for a <script type="application/ld+json"> tag; "<" is escaped so it cannot close the tag. */
export function jsonLdScript(data) {
  return `<script type="application/ld+json" data-prerendered="1">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

/** Canonical address of a page: the same trailing-slash form the server redirects to. */
export function pageUrl(site, path) {
  if (!path || path === '/') return `${site}/`
  return `${site}${path.startsWith('/') ? '' : '/'}${path.replace(/\/+$/, '')}/`
}

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/track-order', label: 'Track your order' },
]

export function absoluteUrl(site, pathOrUrl) {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${site}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

/**
 * Build the final HTML for one page from the built index.html.
 * page: { path, title, description, image?, type?, jsonLd?: object[], heading?, bodyHtml? }
 */
export function renderPage(template, page, { site, siteName }) {
  const url = pageUrl(site, page.path)
  const title = escapeHtml(page.title)
  const description = escapeHtml(clip(page.description))
  const image = page.image ? escapeHtml(absoluteUrl(site, page.image)) : ''

  const tags = [
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}" />`,
    `<meta property="og:locale" content="en_PK" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `<meta property="og:type" content="${escapeHtml(page.type || 'website')}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    image ? `<meta property="og:image" content="${image}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    image ? `<meta name="twitter:image" content="${image}" />` : '',
    ...(page.jsonLd || []).map(jsonLdScript),
  ]
    .filter(Boolean)
    .join('\n    ')

  let html = template
  html = /<title>[\s\S]*?<\/title>/i.test(html) ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`) : html.replace('</head>', `<title>${title}</title></head>`)
  html = /<meta\s+name="description"[\s\S]*?\/>/i.test(html)
    ? html.replace(/<meta\s+name="description"[\s\S]*?\/>/i, `<meta name="description" content="${description}" />`)
    : html.replace('</head>', `<meta name="description" content="${description}" /></head>`)
  html = html.replace('</head>', `    ${tags}\n  </head>`)

  if (page.heading || page.bodyHtml) {
    // Real content inside #root: crawlers (and visitors with scripts off) read it straight away,
    // and React replaces it as soon as the app loads.
    const nav = `<nav aria-label="Main">${linkListHtml(NAV_LINKS)}</nav>`
    const summary = `<header><strong>${escapeHtml(siteName)}</strong>${nav}</header><main><h1>${escapeHtml(page.heading || page.title)}</h1>${page.bodyHtml || ''}</main>`
    html = html.replace('<div id="root"></div>', `<div id="root">${summary}</div>`)
  }
  return html
}

/** Turn plain paragraphs into safe HTML. */
export function paragraphsHtml(paragraphs) {
  return paragraphs
    .filter(Boolean)
    .map((text) => `<p>${escapeHtml(text)}</p>`)
    .join('')
}

/** A <ul> of links, so crawlers without JavaScript can still follow them. */
export function linkListHtml(links) {
  return `<ul>${links.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join('')}</ul>`
}
