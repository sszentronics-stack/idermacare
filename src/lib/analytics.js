/**
 * Optional marketing analytics. Nothing loads unless an ID is set in the environment:
 *   VITE_META_PIXEL_ID, VITE_TIKTOK_PIXEL_ID, VITE_GA_MEASUREMENT_ID
 * Safe to call from anywhere: every function silently does nothing when no ID is configured.
 */
const META_ID = import.meta.env.VITE_META_PIXEL_ID
const TIKTOK_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

let started = false

function addScript(src) {
  const script = document.createElement('script')
  script.async = true
  script.src = src
  document.head.appendChild(script)
}

export function startAnalytics() {
  if (started || typeof window === 'undefined') return
  started = true

  if (META_ID) {
    window.fbq = window.fbq || function fbq(...args) { (window.fbq.queue = window.fbq.queue || []).push(args) }
    window._fbq = window.fbq
    window.fbq.loaded = true
    window.fbq.version = '2.0'
    window.fbq.queue = window.fbq.queue || []
    addScript('https://connect.facebook.net/en_US/fbevents.js')
    window.fbq('init', META_ID)
  }

  if (TIKTOK_ID) {
    const ttq = (window.ttq = window.ttq || [])
    ttq._i = ttq._i || {}
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie']
    ttq.setAndDefer = (target, method) => { target[method] = (...args) => target.push([method, ...args]) }
    ttq.methods.forEach((method) => ttq.setAndDefer(ttq, method))
    ttq.load = () => addScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${TIKTOK_ID}&lib=ttq`)
    ttq.load()
  }

  if (GA_ID) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() { window.dataLayer.push(arguments) } // eslint-disable-line prefer-rest-params
    window.gtag('js', new Date())
    window.gtag('config', GA_ID, { send_page_view: false })
    addScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`)
  }
}

export function trackPageView(path) {
  if (META_ID && window.fbq) window.fbq('track', 'PageView')
  if (TIKTOK_ID && window.ttq) window.ttq.page()
  if (GA_ID && window.gtag) window.gtag('event', 'page_view', { page_path: path })
}

/** name: 'AddToCart' | 'InitiateCheckout' | 'Purchase'; value in rupees. */
export function trackEvent(name, { value = 0, currency = 'PKR', id, quantity } = {}) {
  const contents = id ? [{ id: String(id), quantity: quantity || 1 }] : undefined
  if (META_ID && window.fbq) window.fbq('track', name, { value, currency, ...(contents ? { contents, content_type: 'product' } : {}) })
  if (TIKTOK_ID && window.ttq) {
    const map = { AddToCart: 'AddToCart', InitiateCheckout: 'InitiateCheckout', Purchase: 'CompletePayment' }
    window.ttq.track(map[name] || name, { value, currency, ...(contents ? { contents } : {}) })
  }
  if (GA_ID && window.gtag) {
    const map = { AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', Purchase: 'purchase' }
    window.gtag('event', map[name] || name, { value, currency })
  }
}
