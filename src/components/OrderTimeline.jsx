const STEPS = [
  { key: 'pending', label: 'Order placed', text: 'We received your order.' },
  { key: 'confirmed', label: 'Confirmed', text: 'We confirmed your order.' },
  { key: 'processing', label: 'Being prepared', text: 'Your items are being prepared.' },
  { key: 'packed', label: 'Packed', text: 'Your order is packed.' },
  { key: 'shipped', label: 'On its way', text: 'Handed to the courier.' },
  { key: 'delivered', label: 'Delivered', text: 'Your order was delivered.' },
]

const ORDER = STEPS.map((step) => step.key)
// "ready for pickup" sits between packed and shipped; show it as part of "Packed".
const NORMALIZE = { ready_for_pickup: 'packed' }

const SIDE_STATES = {
  cancelled: 'This order was cancelled.',
  returned: 'This order was returned.',
  refunded: 'This order was refunded.',
}

function formatWhen(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Customer-facing progress for an order: a step list plus any courier tracking details. */
export default function OrderTimeline({ order }) {
  const status = NORMALIZE[order.orderStatus] || order.orderStatus
  const history = order.history || []
  const reachedAt = {}
  history.forEach((entry) => {
    const key = NORMALIZE[entry.status] || entry.status
    if (!reachedAt[key]) reachedAt[key] = entry.at
  })
  const currentIndex = ORDER.indexOf(status)
  const sideMessage = SIDE_STATES[order.orderStatus]

  return (
    <section className="ssz-timeline" aria-label="Order progress">
      <h2 className="font-medium mb-3">Where is my order?</h2>
      {sideMessage ? <p className="ssz-timeline__side">{sideMessage}</p> : null}
      <ol className="ssz-timeline__list">
        {STEPS.map((step, index) => {
          const done = currentIndex >= 0 && index <= currentIndex
          const current = index === currentIndex
          const when = reachedAt[step.key] || (step.key === 'pending' ? order.placedAt : '')
          return (
            <li key={step.key} className={`ssz-timeline__step${done ? ' is-done' : ''}${current ? ' is-current' : ''}`} aria-current={current ? 'step' : undefined}>
              <span className="ssz-timeline__dot" aria-hidden="true" />
              <div>
                <strong>{step.label}</strong>
                <span>{done ? (when ? formatWhen(when) : step.text) : step.text}</span>
              </div>
            </li>
          )
        })}
      </ol>
      {order.tracking ? (
        <p className="ssz-timeline__tracking">
          Courier: <strong>{String(order.tracking.courier).replace(/_/g, ' ')}</strong>
          {order.tracking.trackingNumber ? <> · Tracking number: <strong>{order.tracking.trackingNumber}</strong></> : null}
        </p>
      ) : null}
    </section>
  )
}
