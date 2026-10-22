import type { Page, Route } from '@playwright/test'

/**
 * A tiny fake Supabase for the browser tests. It answers the same HTTP calls the app makes
 * (sign-in session, REST tables, edge functions) from in-memory state, and records every
 * request so tests can check what the app actually sent.
 */

export const FAKE_URL = 'https://e2e.supabase.test'

export interface FakeOrder {
  id: string
  orderNumber: string
  email: string
  phone: string
  currency: string
  subtotal: number
  discountTotal: number
  shippingTotal: number
  taxTotal: number
  grandTotal: number
  orderStatus: string
  paymentStatus: string
  fulfillmentStatus: string
  paymentMethod: string
  customerNotes: string | null
  shippingAddress: Record<string, string | null>
  deliveryMethod: string
  placedAt: string
  history: { status: string; at: string; note: string | null }[]
  tracking: { courier: string; trackingNumber: string | null; status: string } | null
  items: {
    id: string
    productId: string
    variantId: string
    sku: string
    productName: string
    variantName: string | null
    quantity: number
    unitPrice: number
    originalPrice: number | null
    lineTotal: number
  }[]
}

export interface RecordedCall {
  method: string
  path: string
  body: unknown
}

export interface FakeBackend {
  orders: FakeOrder[]
  siteContent: Record<string, unknown> | null
  isAdmin: boolean
  calls: RecordedCall[]
}

export function makeOrder(overrides: Partial<FakeOrder> = {}): FakeOrder {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    orderNumber: 'AURA-20261021-TEST01',
    email: 'buyer@example.com',
    phone: '03001234567',
    currency: 'PKR',
    subtotal: 440000,
    discountTotal: 0,
    shippingTotal: 20000,
    taxTotal: 0,
    grandTotal: 460000,
    orderStatus: 'pending',
    paymentStatus: 'pending',
    fulfillmentStatus: 'unfulfilled',
    paymentMethod: 'cod',
    customerNotes: null,
    shippingAddress: {
      recipientName: 'Test Buyer',
      phone: '03001234567',
      addressLine1: 'House 1, Street 2',
      addressLine2: null,
      city: 'Islamabad',
      province: 'Islamabad Capital Territory',
      postalCode: '44000',
      country: 'PK',
    },
    deliveryMethod: 'standard',
    placedAt: '2026-10-21T07:29:19.000Z',
    history: [{ status: 'pending', at: '2026-10-21T07:29:20.000Z', note: null }],
    tracking: null,
    items: [
      {
        id: 'item-1',
        productId: 'p1',
        variantId: 'v1',
        sku: 'ABC-HERO-MP-INV39',
        productName: 'Hero Mighty Patch Invisible+',
        variantName: '39 patches',
        quantity: 1,
        unitPrice: 440000,
        originalPrice: 550000,
        lineTotal: 440000,
      },
    ],
    ...overrides,
  }
}

function base64url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export const ADMIN_USER = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'owner@idermacare.test' }

function fakeSession(user = ADMIN_USER) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24
  const token = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: user.id, role: 'authenticated', exp })}.sig`
  return {
    access_token: token,
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: exp,
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

/** Put a signed-in session in the browser before the app starts. */
export async function signIn(page: Page, user = ADMIN_USER) {
  const session = fakeSession(user)
  await page.addInitScript((value) => {
    window.localStorage.setItem('sb-e2e-auth-token', JSON.stringify(value))
  }, session)
}

function json(route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', ...headers },
    body: JSON.stringify(body),
  })
}

const envelope = (data: unknown) => ({ ok: true, data })

/** Install the fake backend on a page. Returns its state so tests can change and inspect it. */
export async function mockSupabase(page: Page, initial: Partial<FakeBackend> = {}): Promise<FakeBackend> {
  const state: FakeBackend = { orders: [], siteContent: null, isAdmin: true, calls: [], ...initial }

  await page.route(`${FAKE_URL}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const path = url.pathname
    let body: unknown = null
    try {
      body = request.postDataJSON()
    } catch {
      body = request.postData()
    }

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      })
    }

    if (method !== 'GET' && method !== 'HEAD') state.calls.push({ method, path, body })

    // ---- auth
    if (path === '/auth/v1/user') return json(route, fakeSession().user)
    if (path.startsWith('/auth/v1/token')) return json(route, fakeSession())
    if (path.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })

    // ---- REST tables
    if (path === '/rest/v1/profiles') {
      const profile = {
        id: 'profile-1',
        auth_user_id: ADMIN_USER.id,
        first_name: 'Shop',
        last_name: 'Owner',
        email: ADMIN_USER.email,
        phone: null,
        avatar_url: null,
        status: 'active',
        is_admin: state.isAdmin,
      }
      const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      return json(route, wantsObject ? profile : [profile])
    }

    if (path === '/rest/v1/orders' && method === 'GET') {
      const search = url.searchParams.get('or') ?? ''
      const status = url.searchParams.get('order_status')?.replace('eq.', '')
      const needle = /ilike\.%([^%]*)%/.exec(search)?.[1]?.toLowerCase()
      let rows = state.orders
      if (status) rows = rows.filter((order) => order.orderStatus === status)
      if (needle) rows = rows.filter((order) => `${order.orderNumber} ${order.email} ${order.phone}`.toLowerCase().includes(needle))
      const data = rows.map((order) => ({
        id: order.id,
        order_number: order.orderNumber,
        email: order.email,
        phone: order.phone,
        grand_total: order.grandTotal,
        currency: order.currency,
        order_status: order.orderStatus,
        payment_status: order.paymentStatus,
        fulfillment_status: order.fulfillmentStatus,
        placed_at: order.placedAt,
        order_items: order.items.map((item) => ({ id: item.id })),
      }))
      return json(route, request.method() === 'HEAD' ? [] : data, 200, { 'content-range': `0-${Math.max(data.length - 1, 0)}/${data.length}` })
    }

    if (path === '/rest/v1/site_content') {
      if (method === 'GET') {
        return json(route, state.siteContent ? [{ document: state.siteContent }] : [])
      }
      // upsert from the admin "Save changes" button
      const row = body as { document?: Record<string, unknown> } | null
      if (row?.document) state.siteContent = row.document
      return json(route, [], 201)
    }

    if (path.startsWith('/rest/v1/')) {
      // Everything else (dashboard counts, products, ...) is simply empty.
      return json(route, [], 200, { 'content-range': '*/0' })
    }

    // ---- edge functions
    if (path === '/functions/v1/auth') {
      return json(
        route,
        envelope({
          profile: { id: 'profile-1', authUserId: ADMIN_USER.id, email: ADMIN_USER.email, isAdmin: state.isAdmin, status: 'active' },
          customer: null,
        }),
      )
    }

    const orderStatus = /^\/functions\/v1\/orders\/([^/]+)\/status$/.exec(path)
    if (orderStatus && method === 'POST') {
      const order = state.orders.find((candidate) => candidate.id === orderStatus[1])
      const next = (body as { status?: string } | null)?.status
      if (!order || !next) return json(route, { ok: false, error: { message: 'Order not found.' } }, 404)
      order.orderStatus = next
      order.history.push({ status: next, at: new Date().toISOString(), note: null })
      return json(route, envelope(order))
    }

    if (path === '/functions/v1/orders/lookup' && method === 'POST') {
      const input = body as { orderNumber?: string; email?: string } | null
      const order = state.orders.find(
        (candidate) => candidate.orderNumber === input?.orderNumber && candidate.email.toLowerCase() === String(input?.email ?? '').toLowerCase(),
      )
      if (!order) return json(route, { ok: false, error: { code: 'not_found', message: 'No order matches that order number and email.' } }, 404)
      return json(route, envelope(order))
    }

    const orderById = /^\/functions\/v1\/orders\/([^/]+)$/.exec(path)
    if (orderById && method === 'GET') {
      const order = state.orders.find((candidate) => candidate.id === orderById[1])
      if (!order) return json(route, { ok: false, error: { message: 'Order not found.' } }, 404)
      return json(route, envelope(order))
    }

    // Any other function answers with empty lists under the keys the app reads, so pages render with no data.
    if (path.startsWith('/functions/v1/')) {
      return json(route, envelope({ items: [], orders: [], shipments: [], returns: [], payments: [], events: [], jobs: [], variants: [], total: 0, count: 0 }))
    }

    return json(route, {}, 404)
  })

  return state
}
