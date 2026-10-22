import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as ordersApi from '../repositories/orders.repository'
import { formatMoney } from '../../backend/lib/money/index'
import { isSupabaseConfigured } from '../lib/supabase/client'
import { useSeo } from '../hooks/useSeo'
import OrderTimeline from '../components/OrderTimeline'

export default function TrackOrder() {
  useSeo({ title: 'Track your order | iDermaCare', description: 'Check where your iDermaCare order is with your order number and email.', noindex: true })
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setOrder(null)
    if (!isSupabaseConfigured()) {
      setError('Order tracking is not available right now.')
      return
    }
    setLoading(true)
    try {
      setOrder(await ordersApi.lookupGuestOrder(orderNumber.trim().toUpperCase(), email.trim()))
    } catch (err) {
      setError(err?.message || 'We could not find that order. Check the order number and email and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="ssz-section">
      <div className="ssz-container ssz-narrow">
        <h1>Track your order</h1>
        <p>Enter the order number from your confirmation email and the email you ordered with.</p>
        <form onSubmit={onSubmit} className="ssz-track__form">
          <label htmlFor="track-number">Order number</label>
          <input id="track-number" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="AURA-20261021-ABC123" required autoComplete="off" />
          <label htmlFor="track-email">Email</label>
          <input id="track-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required autoComplete="email" />
          <button type="submit" className="ssz-btn" disabled={loading}>{loading ? 'Checking…' : 'Track order'}</button>
        </form>
        {error ? <p className="ssz-track__error" role="alert">{error}</p> : null}
        {order ? (
          <div className="ssz-track__result">
            <p>
              Order <strong>{order.orderNumber}</strong> · {formatMoney(order.grandTotal, { currency: order.currency })}
            </p>
            <OrderTimeline order={order} />
            <ul className="ssz-track__items">
              {order.items.map((item) => (
                <li key={item.id}>{item.productName}{item.variantName ? ` — ${item.variantName}` : ''} × {item.quantity}</li>
              ))}
            </ul>
            <p>Questions? <Link to="/contact">Contact us</Link>.</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
