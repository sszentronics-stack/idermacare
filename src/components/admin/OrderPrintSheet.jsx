import { formatMoney } from '../../../backend/lib/money/index'
import { useSiteContent } from '../../lib/siteContent'

/**
 * Printable invoice or packing slip. It is hidden on screen and only shown when
 * printing (see admin-theme.css), so the admin prints it from the order page.
 * The packing slip omits prices so it can go in the parcel.
 */
export default function OrderPrintSheet({ order, mode }) {
  const { business } = useSiteContent()
  const money = (value) => formatMoney(value, { currency: order.currency })
  const addr = order.shippingAddress ?? {}
  const isSlip = mode === 'slip'
  const placed = new Date(order.placedAt)

  return (
    <section className="print-sheet" aria-hidden="true">
      <header className="print-sheet__head">
        <div>
          <h1>{business.name}</h1>
          <p>{business.address}<br />{business.phone} · {business.email}</p>
        </div>
        <div className="print-sheet__meta">
          <h2>{isSlip ? 'Packing slip' : 'Invoice'}</h2>
          <p>
            Order <strong>{order.orderNumber}</strong><br />
            {Number.isNaN(placed.getTime()) ? '' : placed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>

      <div className="print-sheet__ship">
        <h3>Ship to</h3>
        <p>
          <strong>{addr.recipientName}</strong><br />
          {[addr.addressLine1, addr.addressLine2].filter(Boolean).join(', ')}<br />
          {[addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ')}<br />
          Phone: {addr.phone || order.phone || '—'}
        </p>
        {!isSlip ? <p>Payment: {order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod} ({order.paymentStatus})</p> : null}
      </div>

      <table className="print-sheet__table">
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU</th>
            <th className="num">Qty</th>
            {!isSlip ? <th className="num">Price</th> : null}
            {!isSlip ? <th className="num">Total</th> : null}
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>{item.productName}{item.variantName ? ` — ${item.variantName}` : ''}</td>
              <td>{item.sku}</td>
              <td className="num">{item.quantity}</td>
              {!isSlip ? <td className="num">{money(item.unitPrice)}</td> : null}
              {!isSlip ? <td className="num">{money(item.lineTotal)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>

      {!isSlip ? (
        <dl className="print-sheet__totals">
          <dt>Subtotal</dt><dd>{money(order.subtotal)}</dd>
          {order.discountTotal ? (<><dt>Discount</dt><dd>-{money(order.discountTotal)}</dd></>) : null}
          <dt>Delivery</dt><dd>{money(order.shippingTotal)}</dd>
          <dt className="grand">Total{order.paymentMethod === 'cod' ? ' to collect' : ''}</dt><dd className="grand">{money(order.grandTotal)}</dd>
        </dl>
      ) : (
        <p className="print-sheet__note">Customer notes: {order.customerNotes || '—'}</p>
      )}
      <p className="print-sheet__thanks">Thank you for shopping with {business.name}.</p>
    </section>
  )
}
