/**
 * orders — Phase 6 (Checkout & Order Management). Replaces the Phase 1
 * validate-and-501 stub with real order creation/read/cancellation on top
 * of the Phase 5 server-side cart.
 *
 *   POST   /              create an order from the caller's current cart
 *                          (requires an `X-Idempotency-Key` header — see
 *                          the idempotency handling below; CORS already
 *                          allowlists this header, see ../_shared/http.ts)
 *   GET    /               list the caller's own orders, newest first
 *   GET    /:id            read one order (caller-owned, or admin)
 *   POST   /:id/cancel     request cancellation (pending/confirmed only)
 *   POST   /lookup          guest order lookup {orderNumber, email}
 *
 * Every route requires a caller JWT (signed-in OR anonymous-auth guest —
 * see ../_shared/callerAuth.ts), same identity model Phase 5 established
 * for cart/wishlist. `/lookup` is the one exception: it authenticates by
 * order-number + email match instead, for a guest returning in a different
 * browser session where their original anonymous session no longer exists.
 *
 * SECURITY: getOrderForCaller() (orders.service.ts) always throws a
 * generic NotFoundError for "exists but isn't yours" — never a distinct
 * 403 — so this function can't be used to enumerate/confirm the existence
 * of another customer's order by id.
 */
import { withErrorHandling, okResponse } from '../_shared/http.ts'
import { requireCallerProfile } from '../_shared/callerAuth.ts'
import { getSupabaseAdminClient } from '../_shared/supabaseAdmin.ts'
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from '../../../backend/lib/errors/index.ts'
import { buildPendingIdempotencyRecord, decideIdempotency, type IdempotencyRecord } from '../../../backend/lib/idempotency/index.ts'
import {
  cancelOrderRequestSchema,
  checkoutSchema,
  guestOrderLookupSchema,
  updateOrderStatusSchema,
  parseOrThrow,
} from '../../../backend/lib/validation/index.ts'
import { writeAuditLog } from '../../../backend/lib/audit/index.ts'
import * as orders from '../../../backend/services/orders/orders.service.ts'
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from '../../../backend/lib/orders/confirmationEmail.ts'

const IDEMPOTENCY_SCOPE = 'order.create'
const STORE_ALERT_EMAIL = 'sales@idermacare.com'
const MAX_ORDERS_PER_HOUR = 5
const MAX_LOOKUPS_PER_10_MIN = 20

type Admin = ReturnType<typeof getSupabaseAdminClient>

/** Accepts both the documented names and the older ones so a fresh setup cannot silently skip email. */
function mailEnv() {
  return {
    apiKey: Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('EMAIL_PROVIDER_API_KEY'),
    from: Deno.env.get('ORDER_FROM_EMAIL') ?? Deno.env.get('EMAIL_FROM_ADDRESS'),
    notifyTo: Deno.env.get('ORDER_NOTIFY_EMAIL') ?? STORE_ALERT_EMAIL,
  }
}

/** Runs slow work (email) after the response is sent so checkout does not wait on the mail provider. */
function inBackground(task: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
  if (runtime?.waitUntil) runtime.waitUntil(task)
  else void task
}

/** Failed emails used to vanish into the logs; this leaves a visible trail in the admin Activity log. */
async function logEmailFailure(admin: Admin, kind: string, orderId: string, orderNumber: string, reason?: string) {
  try {
    await writeAuditLog(admin, {
      actor: null,
      actorType: 'system',
      action: 'order.email_failed',
      entityType: 'order',
      entityId: orderId,
      metadata: { kind, orderNumber, reason: reason ?? 'unknown' },
    })
  } catch (error) {
    console.error('Could not record an email failure.', error)
  }
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || undefined
}

async function countRecent(admin: Admin, action: string, ip: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString()
  const { count } = await admin
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action', action)
    .eq('ip', ip)
    .gte('created_at', since)
  return count ?? 0
}

async function loadIdempotencyRecord(admin: ReturnType<typeof getSupabaseAdminClient>, key: string): Promise<IdempotencyRecord | null> {
  const { data } = await admin.from('idempotency_keys').select('*').eq('key', key).maybeSingle()
  if (!data) return null
  return {
    key: data.key as string,
    scope: data.scope as string,
    requestHash: data.request_hash as string,
    responseReference: data.response_reference as string | null,
    status: data.status as IdempotencyRecord['status'],
    expiresAt: data.expires_at as string,
  }
}

async function saveIdempotencyRecord(admin: ReturnType<typeof getSupabaseAdminClient>, record: IdempotencyRecord): Promise<void> {
  await admin.from('idempotency_keys').upsert({
    key: record.key,
    scope: record.scope,
    request_hash: record.requestHash,
    response_reference: record.responseReference,
    status: record.status,
    expires_at: record.expiresAt,
  })
}

Deno.serve(
  withErrorHandling(async (req) => {
    const url = new URL(req.url)
    const segments = url.pathname.replace(/^\/(functions\/v1\/)?orders\/?/, '').split('/').filter(Boolean)
    const admin = getSupabaseAdminClient()
    const body = await req.json().catch(() => ({}))

    if (segments[0] === 'lookup' && req.method === 'POST') {
      const input = parseOrThrow(guestOrderLookupSchema, body)
      // Stop people guessing order numbers: cap lookups per connection.
      const ip = clientIp(req)
      if (ip) {
        if ((await countRecent(admin, 'order.lookup', ip, 10)) >= MAX_LOOKUPS_PER_10_MIN) {
          throw new ConflictError('Too many lookups. Please try again in a few minutes.')
        }
        await writeAuditLog(admin, { actor: null, actorType: 'customer', action: 'order.lookup', entityType: 'order', ip })
      }
      return okResponse(await orders.lookupGuestOrder(admin, input.orderNumber, input.email))
    }

    const caller = await requireCallerProfile(req)

    // POST / — create order (idempotent)
    if (segments.length === 0 && req.method === 'POST') {
      const input = parseOrThrow(checkoutSchema, body)
      const idempotencyKey = req.headers.get('x-idempotency-key')
      if (!idempotencyKey) {
        throw new ValidationError('Missing X-Idempotency-Key header.')
      }

      // Slow down bulk fake orders: per network address and per phone/email.
      const ip = clientIp(req)
      if (ip && (await countRecent(admin, 'order.created', ip, 60)) >= MAX_ORDERS_PER_HOUR) {
        throw new ConflictError('Too many orders from this connection. Please wait a while or contact us on WhatsApp.')
      }
      const since = new Date(Date.now() - 60 * 60_000).toISOString()
      const contacts = [input.email ? `email.eq.${input.email}` : null, input.phone ? `phone.eq.${input.phone}` : null].filter(Boolean).join(',')
      if (contacts) {
        const { count } = await admin.from('orders').select('id', { count: 'exact', head: true }).or(contacts).gte('created_at', since)
        if ((count ?? 0) >= MAX_ORDERS_PER_HOUR) {
          throw new ConflictError('Too many recent orders with these contact details. Please contact us on WhatsApp.')
        }
      }

      const existing = await loadIdempotencyRecord(admin, idempotencyKey)
      const decision = await decideIdempotency(existing, body)

      if (decision.action === 'reject_conflict') {
        throw new ConflictError('This idempotency key was already used with a different request.')
      }
      if (decision.action === 'wait_for_in_flight') {
        throw new ConflictError('This order is already being created — please wait a moment and check your order history.')
      }
      if (decision.action === 'replay' && decision.responseReference) {
        const order = await orders.getOrderForCaller(admin, caller.id, caller.isAdmin, decision.responseReference)
        return okResponse(order, 200)
      }

      const pending = await buildPendingIdempotencyRecord({ key: idempotencyKey, scope: IDEMPOTENCY_SCOPE, payload: body })
      await saveIdempotencyRecord(admin, pending)

      try {
        const order = await orders.createOrder(admin, caller.id, input)
        inBackground(
          sendOrderConfirmationEmail(order, mailEnv())
            .then(async (result) => {
              if (!result.sent) await logEmailFailure(admin, 'confirmation', order.id, order.orderNumber, result.reason)
              if (result.alert && !result.alert.sent) await logEmailFailure(admin, 'store-alert', order.id, order.orderNumber, result.alert.reason)
            })
            .catch((mailError) => logEmailFailure(admin, 'confirmation', order.id, order.orderNumber, mailError instanceof Error ? mailError.message : String(mailError))),
        )
        await saveIdempotencyRecord(admin, { ...pending, status: 'completed', responseReference: order.id })
        await writeAuditLog(admin, {
          actor: caller.id,
          actorType: 'customer',
          action: 'order.created',
          entityType: 'order',
          entityId: order.id,
          metadata: { orderNumber: order.orderNumber, grandTotal: order.grandTotal, itemCount: order.items.length },
        ip: clientIp(req),
        })
        return okResponse(order, 201)
      } catch (err) {
        await saveIdempotencyRecord(admin, { ...pending, status: 'failed' })
        throw err
      }
    }

    // GET / — list my orders
    if (segments.length === 0 && req.method === 'GET') {
      return okResponse({ orders: await orders.listOrdersForCaller(admin, caller.id) })
    }

    const [orderId, ...rest] = segments
    if (!orderId) throw new NotFoundError('Route')

    // POST /:id/cancel
    if (rest.length === 1 && rest[0] === 'cancel' && req.method === 'POST') {
      const input = parseOrThrow(cancelOrderRequestSchema, body)
      const order = await orders.requestOrderCancellation(admin, caller.id, caller.isAdmin, orderId, input.reason)
      await writeAuditLog(admin, {
        actor: caller.id,
        actorType: 'customer',
        action: 'order.cancellation_requested',
        entityType: 'order',
        entityId: orderId,
        metadata: { reason: input.reason ?? null },
      })
      return okResponse(order)
    }

    // POST /:id/status — admin moves the order along and the customer is emailed
    if (rest.length === 1 && rest[0] === 'status' && req.method === 'POST') {
      if (!caller.isAdmin) throw new AuthorizationError('Only admins can change order status.')
      const input = parseOrThrow(updateOrderStatusSchema, body)
      const order = await orders.updateOrderStatusByAdmin(admin, caller.id, orderId, input.status, input.note)
      await writeAuditLog(admin, {
        actor: caller.id,
        actorType: 'admin',
        action: 'order.status_changed',
        entityType: 'order',
        entityId: orderId,
        metadata: { to: input.status, note: input.note ?? null },
      })
      inBackground(
        sendOrderStatusEmail(order, input.status, mailEnv(), input.note)
          .then(async (result) => {
            if (!result.sent && result.reason !== 'no-template') await logEmailFailure(admin, `status:${input.status}`, order.id, order.orderNumber, result.reason)
          })
          .catch((mailError) => logEmailFailure(admin, `status:${input.status}`, order.id, order.orderNumber, mailError instanceof Error ? mailError.message : String(mailError))),
      )
      return okResponse(order)
    }

    // GET /:id
    if (rest.length === 0 && req.method === 'GET') {
      return okResponse(await orders.getOrderForCaller(admin, caller.id, caller.isAdmin, orderId))
    }

    throw new NotFoundError('route', 'No matching route for this method/path on the orders function.')
  }),
)
