import { describe, expect, it } from 'vitest'
import {
  buildOrderConfirmationHtml,
  buildOrderConfirmationMessage,
  buildOrderStatusMessage,
  formatFrom,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
} from './confirmationEmail.ts'

const order = {
  orderNumber: 'SSZ-1001',
  email: 'customer@example.com',
  currency: 'PKR',
  subtotal: 440000,
  shippingTotal: 20000,
  grandTotal: 460000,
  orderStatus: 'pending',
  paymentStatus: 'pending',
  paymentMethod: 'cod',
  deliveryMethod: 'standard',
  shippingAddress: {
    recipientName: 'Ayesha Khan',
    addressLine1: 'House 12, Street 4',
    addressLine2: 'G-13/3',
    city: 'Islamabad',
    province: 'Islamabad',
  },
  items: [{ productName: 'Hero Mighty Patch Invisible+', variantName: null, quantity: 1, lineTotal: 440000 }],
}

describe('sender name', () => {
  it('always shows iDermaCare, keeping only the address from the setting', () => {
    expect(formatFrom('SS Zen Traders <orders@idermacare.com>')).toBe('iDermaCare <orders@idermacare.com>')
    expect(formatFrom('SSzentraders <sales@idermacare.com>')).toBe('iDermaCare <sales@idermacare.com>')
    expect(formatFrom('sales@idermacare.com')).toBe('iDermaCare <sales@idermacare.com>')
    expect(formatFrom('  "Old Name" <  hello@idermacare.com >  ')).toBe('iDermaCare <hello@idermacare.com>')
  })

  it('falls back to the default sender when nothing usable is set', () => {
    expect(formatFrom(undefined)).toBe('iDermaCare <sales@idermacare.com>')
    expect(formatFrom('')).toBe('iDermaCare <sales@idermacare.com>')
    expect(formatFrom('just a name')).toBe('iDermaCare <sales@idermacare.com>')
  })

  it('is used as the from address of a sent email', async () => {
    let from = ''
    await sendOrderConfirmationEmail(order, { apiKey: 'k', from: 'SS Zen Traders <sales@idermacare.com>' }, (async (_url: string, init: { body: string }) => {
      from = JSON.parse(init.body).from
      return { ok: true, status: 200 }
    }) as unknown as typeof fetch)
    expect(from).toBe('iDermaCare <sales@idermacare.com>')
  })
})

describe('order confirmation email', () => {
  it('includes the same order content shown on the confirmation page', () => {
    const message = buildOrderConfirmationMessage(order)
    expect(message.subject).toBe('Your iDermaCare order SSZ-1001')
    expect(message.text).toContain('Order SSZ-1001 — Pending confirmation')
    expect(message.text).toContain('Hero Mighty Patch Invisible+ × 1 — Rs.4,400')
    expect(message.text).toContain('Total: Rs.4,600')
    expect(message.text).toContain('Ayesha Khan, House 12, Street 4, G-13/3, Islamabad, Islamabad')
    expect(message.text).toContain('Cash on Delivery')
  })

  it('does not send when no mail key is configured', async () => {
    const result = await sendOrderConfirmationEmail(order, {})
    expect(result).toEqual({ sent: false, reason: 'not-configured' })
  })

  it('posts the confirmation to the mail provider', async () => {
    let body = ''
    const result = await sendOrderConfirmationEmail(order, { apiKey: 'test-key', from: 'Shop <sales@idermacare.com>' }, async (_url, init) => {
      body = String(init?.body || '')
      return new Response('{}', { status: 200 })
    })
    expect(result.sent).toBe(true)
    expect(body).toContain('customer@example.com')
    expect(body).toContain('Hero Mighty Patch Invisible+')
  })

  it('sends an HTML confirmation to the customer and an alert to the store', async () => {
    const calls: { to: string[]; html?: string; subject: string }[] = []
    const fake = (async (_url: string, init: { body: string }) => {
      calls.push(JSON.parse(init.body))
      return { ok: true }
    }) as unknown as typeof fetch
    const result = await sendOrderConfirmationEmail(order, { apiKey: 'k', notifyTo: 'store@example.com' }, fake)
    expect(result).toEqual({ sent: true, alert: { sent: true } })
    expect(calls.map((c) => c.to[0])).toEqual(['customer@example.com', 'store@example.com'])
    expect(calls[0]!.html).toContain('Thank you for your order')
    expect(calls[1]!.subject).toContain('New order SSZ-1001')
  })

  it('retries once when the provider is temporarily down', async () => {
    let attempts = 0
    const flaky = (async () => {
      attempts += 1
      return attempts === 1 ? { ok: false, status: 503 } : { ok: true, status: 200 }
    }) as unknown as typeof fetch
    const result = await sendOrderConfirmationEmail(order, { apiKey: 'k' }, flaky)
    expect(result.sent).toBe(true)
    expect(attempts).toBe(2)
  })

  it('does not retry a rejected request and reports why it failed', async () => {
    let attempts = 0
    const rejected = (async () => {
      attempts += 1
      return { ok: false, status: 403 }
    }) as unknown as typeof fetch
    const result = await sendOrderConfirmationEmail(order, { apiKey: 'k' }, rejected)
    expect(result).toEqual({ sent: false, reason: 'mail-403' })
    expect(attempts).toBe(1)
  })

  it('reports a failed store alert even when the customer email was sent', async () => {
    let call = 0
    const fake = (async () => {
      call += 1
      return call === 1 ? { ok: true, status: 200 } : { ok: false, status: 422 }
    }) as unknown as typeof fetch
    const result = await sendOrderConfirmationEmail(order, { apiKey: 'k', notifyTo: 'store@example.com' }, fake)
    expect(result.sent).toBe(true)
    expect(result.alert).toEqual({ sent: false, reason: 'mail-422' })
  })

  it('escapes customer-supplied text in the HTML', () => {
    const html = buildOrderConfirmationHtml({ ...order, shippingAddress: { recipientName: '<script>x</script>' } })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('emails status updates only for customer-facing statuses', async () => {
    expect(buildOrderStatusMessage(order, 'shipped')?.subject).toBe('Your iDermaCare order SSZ-1001 has shipped')
    expect(buildOrderStatusMessage(order, 'packed')?.subject).toContain('is packed')
    expect(buildOrderStatusMessage(order, 'ready_for_pickup')).toBeNull()
    expect(await sendOrderStatusEmail(order, 'ready_for_pickup', { apiKey: 'k' })).toEqual({ sent: false, reason: 'no-template' })
  })
})
