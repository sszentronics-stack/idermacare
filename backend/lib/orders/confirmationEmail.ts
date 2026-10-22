import { formatMoney } from '../money/index.ts'

export interface ConfirmationLine {
  productName: string
  variantName?: string | null
  quantity: number
  lineTotal: number
}

export interface ConfirmationOrder {
  orderNumber: string
  email?: string | null
  currency?: string | null
  subtotal: number
  shippingTotal: number
  grandTotal: number
  orderStatus?: string | null
  paymentStatus?: string | null
  paymentMethod?: string | null
  deliveryMethod?: string | null
  shippingAddress?: {
    recipientName?: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    city?: string | null
    province?: string | null
  } | null
  items: ConfirmationLine[]
}

const PAYMENT_LABEL: Record<string, string> = { cod: 'Cash on Delivery', easypaisa: 'Easypaisa', bank_transfer: 'Bank / mobile wallet transfer' }
const STATUS_LABEL: Record<string, string> = { pending: 'Pending confirmation', confirmed: 'Confirmed' }

function money(amount: number, currency?: string | null) {
  return formatMoney(amount, { currency: currency || 'PKR' })
}

/** Plain-text body that matches the order confirmation page. */
export function buildOrderConfirmationMessage(order: ConfirmationOrder) {
  const currency = order.currency || 'PKR'
  const status = STATUS_LABEL[order.orderStatus || ''] || order.orderStatus || 'Pending confirmation'
  const payment = PAYMENT_LABEL[order.paymentMethod || ''] || order.paymentMethod || 'Cash on Delivery'
  const delivery = `${order.deliveryMethod || 'standard'} delivery`
  const address = order.shippingAddress
  const shipTo = [
    address?.recipientName,
    address?.addressLine1,
    address?.addressLine2,
    address?.city,
    address?.province,
  ].filter(Boolean).join(', ')

  const lines = [
    'Thank you for your order',
    '',
    `Order ${order.orderNumber} — ${status}`,
    '',
    `Payment method: ${payment}`,
    `Payment status: ${order.paymentStatus || 'pending'}`,
    `Delivery: ${delivery}`,
    '',
    'Items',
    ...order.items.map((item) => {
      const name = `${item.productName}${item.variantName ? ` — ${item.variantName}` : ''}`
      return `${name} × ${item.quantity} — ${money(item.lineTotal, currency)}`
    }),
    '',
    `Subtotal: ${money(order.subtotal, currency)}`,
    `Delivery: ${money(order.shippingTotal, currency)}`,
    `Total: ${money(order.grandTotal, currency)}`,
    '',
    'Shipping to',
    shipTo || 'Address confirmed at checkout',
    '',
    'iDermaCare',
    'Office#14, First Floor, Farooq 2D Plaza, G-13/3, Islamabad',
    '03079594474',
    'sales@idermacare.com',
  ]

  return {
    subject: `Your iDermaCare order ${order.orderNumber}`,
    text: lines.join('\n'),
  }
}

export interface MailEnv {
  apiKey?: string | null
  from?: string | null
  /** Store inbox that receives a "new order" alert. Optional. */
  notifyTo?: string | null
}

const BRAND = 'iDermaCare'
const DEFAULT_FROM = `${BRAND} <sales@idermacare.com>`

/**
 * The sender name customers see is always the brand. A configured sender (ORDER_FROM_EMAIL) can only
 * choose the address, so an old or misspelled display name in the settings can never reach customers.
 */
export function formatFrom(configured?: string | null): string {
  const address = /<\s*([^<>\s]+@[^<>\s]+)\s*>|([^\s<>"]+@[^\s<>"]+)/.exec(String(configured ?? ''))
  const email = (address?.[1] ?? address?.[2] ?? '').trim()
  return email ? `${BRAND} <${email}>` : DEFAULT_FROM
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function shipToLine(order: ConfirmationOrder) {
  const a = order.shippingAddress
  return [a?.recipientName, a?.addressLine1, a?.addressLine2, a?.city, a?.province].filter(Boolean).join(', ')
}

/** HTML version of the confirmation (inline styles only, for email clients). */
export function buildOrderConfirmationHtml(order: ConfirmationOrder, heading = 'Thank you for your order') {
  const currency = order.currency || 'PKR'
  const status = STATUS_LABEL[order.orderStatus || ''] || order.orderStatus || 'Pending confirmation'
  const payment = PAYMENT_LABEL[order.paymentMethod || ''] || order.paymentMethod || 'Cash on Delivery'
  const rows = order.items
    .map((item) => {
      const name = `${item.productName}${item.variantName ? ` — ${item.variantName}` : ''}`
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(name)} × ${item.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${esc(money(item.lineTotal, currency))}</td></tr>`
    })
    .join('')
  return `<!doctype html><html><body style="margin:0;background:#f6f4f8;font-family:Arial,Helvetica,sans-serif;color:#222">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#fff;border-radius:12px;padding:28px">
<h1 style="margin:0 0 4px;font-size:22px">${esc(heading)}</h1>
<p style="margin:0 0 20px;color:#555">Order <strong>${esc(order.orderNumber)}</strong> — ${esc(status)}</p>
<table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">${rows}
<tr><td style="padding-top:12px;color:#555">Subtotal</td><td style="padding-top:12px;text-align:right">${esc(money(order.subtotal, currency))}</td></tr>
<tr><td style="color:#555">Delivery</td><td style="text-align:right">${esc(money(order.shippingTotal, currency))}</td></tr>
<tr><td style="padding-top:8px;font-weight:bold">Total</td><td style="padding-top:8px;text-align:right;font-weight:bold">${esc(money(order.grandTotal, currency))}</td></tr></table>
<p style="font-size:14px;margin:20px 0 4px"><strong>Payment:</strong> ${esc(payment)}</p>
<p style="font-size:14px;margin:0"><strong>Shipping to:</strong> ${esc(shipToLine(order) || 'Address confirmed at checkout')}</p>
</div>
<p style="font-size:12px;color:#777;text-align:center;margin-top:16px">${BRAND}<br>Office#14, First Floor, Farooq 2D Plaza, G-13/3, Islamabad<br>03079594474 · sales@idermacare.com</p>
</div></body></html>`
}

const STATUS_MESSAGE: Record<string, { subject: string; heading: string; line: string }> = {
  confirmed: { subject: 'confirmed', heading: 'Your order is confirmed', line: 'We have confirmed your order and are getting it ready.' },
  processing: { subject: 'is being prepared', heading: 'We are preparing your order', line: 'Your order is being prepared.' },
  packed: { subject: 'is packed', heading: 'Your order is packed', line: 'Your order is packed and waiting for the courier.' },
  shipped: { subject: 'has shipped', heading: 'Your order is on its way', line: 'Your order has been handed to the courier.' },
  delivered: { subject: 'was delivered', heading: 'Your order was delivered', line: 'Your order has been delivered. We hope you enjoy it.' },
  cancelled: { subject: 'was cancelled', heading: 'Your order was cancelled', line: 'Your order has been cancelled. Contact us if this is unexpected.' },
}

/** Returns null for statuses that should not email the customer. */
export function buildOrderStatusMessage(order: ConfirmationOrder, status: string, note?: string | null) {
  const copy = STATUS_MESSAGE[status]
  if (!copy) return null
  const extra = note ? `

${note}` : ''
  const text = `${copy.heading}

Order ${order.orderNumber}
${copy.line}${extra}

${BRAND}
03079594474
sales@idermacare.com`
  const html = buildOrderConfirmationHtml({ ...order, orderStatus: status }, copy.heading).replace(
    '</strong> —',
    `</strong> — ${esc(copy.line)}${note ? ` ${esc(note)}` : ''} —`,
  )
  return { subject: `Your ${BRAND} order ${order.orderNumber} ${copy.subject}`, text, html }
}

async function sendMail(
  env: MailEnv,
  message: { to: string; subject: string; text: string; html?: string },
  fetchImpl: typeof fetch,
): Promise<{ sent: boolean; reason?: string }> {
  if (!message.to) return { sent: false, reason: 'no-email' }
  if (!env.apiKey) return { sent: false, reason: 'not-configured' }
  const request = {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: formatFrom(env.from),
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  }
  let reason = 'mail-failed'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl('https://api.resend.com/emails', request)
      if (response.ok) return { sent: true }
      reason = `mail-${response.status}`
      // Retry only when the provider is busy or down; a 4xx will not fix itself.
      if (response.status < 500 && response.status !== 429) break
    } catch (error) {
      reason = `mail-network: ${error instanceof Error ? error.message : 'unknown error'}`
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800))
  }
  return { sent: false, reason }
}

/** Sends the confirmation when a mail key is configured, plus a new-order alert to the store. */
export async function sendOrderConfirmationEmail(
  order: ConfirmationOrder,
  env: MailEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<{ sent: boolean; reason?: string; alert?: { sent: boolean; reason?: string } }> {
  const to = String(order.email || '').trim()
  const message = buildOrderConfirmationMessage(order)
  const result = await sendMail(
    env,
    { to, subject: message.subject, text: message.text, html: buildOrderConfirmationHtml(order) },
    fetchImpl,
  )
  const notifyTo = String(env.notifyTo || '').trim()
  if (notifyTo) {
    const alert = await sendMail(
      env,
      { to: notifyTo, subject: `New order ${order.orderNumber} — ${money(order.grandTotal, order.currency)}`, text: message.text, html: buildOrderConfirmationHtml(order, 'New order received') },
      fetchImpl,
    ).catch((error) => ({ sent: false, reason: error instanceof Error ? error.message : 'alert-failed' }))
    return { ...result, alert }
  }
  return result
}

/** Emails the customer when an admin moves the order to a new status. */
export async function sendOrderStatusEmail(
  order: ConfirmationOrder,
  status: string,
  env: MailEnv,
  note?: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<{ sent: boolean; reason?: string }> {
  const message = buildOrderStatusMessage(order, status, note)
  if (!message) return { sent: false, reason: 'no-template' }
  return sendMail(env, { to: String(order.email || '').trim(), ...message }, fetchImpl)
}
