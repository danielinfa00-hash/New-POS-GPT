const formatMoney = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)

export default function SaleReceipt({ receipt, onClose }) {
  if (!receipt) return null

  const { orderCode, items, subtotal, discount, deliveryCost, total, paymentMethod, paymentBreakdown, isDelivery, tableLabel, createdAt } = receipt
  const paymentLabel = paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'TRANSFER' ? 'Transferencia' : 'Mixto'

  function handlePrint() {
    window.print()
  }

  return (
    <div className="receipt-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <div className="receipt-modal">
        <div className="receipt-print" id="receipt-print-area">
          <p className="receipt-brand">Maryo&apos;s POS</p>
          <p className="receipt-meta">{orderCode}</p>
          {tableLabel && <p className="receipt-meta">{tableLabel}</p>}
          <p className="receipt-meta">{createdAt ? new Date(createdAt).toLocaleString('es-CO') : ''}</p>
          <hr />
          <ul className="receipt-lines">
            {items.map((item, index) => (
              <li key={`${item.productId || item.id}-${index}`}>
                <span>{item.quantity}x {item.productName || item.name}</span>
                <span>{formatMoney((item.unitPrice ?? item.price) * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <hr />
          <p className="receipt-row"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></p>
          {discount > 0 && <p className="receipt-row"><span>Descuento</span><span>− {formatMoney(discount)}</span></p>}
          {isDelivery && deliveryCost > 0 && <p className="receipt-row"><span>Domicilio</span><span>{formatMoney(deliveryCost)}</span></p>}
          <p className="receipt-row receipt-total"><span>Total</span><span>{formatMoney(total)}</span></p>
          <p className="receipt-row"><span>Pago</span><span>{paymentLabel}</span></p>
          {paymentBreakdown?.cash > 0 && <p className="receipt-row"><span>Efectivo</span><span>{formatMoney(paymentBreakdown.cash)}</span></p>}
          {paymentBreakdown?.transfer > 0 && <p className="receipt-row"><span>Transferencia</span><span>{formatMoney(paymentBreakdown.transfer)}</span></p>}
          {paymentBreakdown?.change > 0 && <p className="receipt-row"><span>Cambio</span><span>{formatMoney(paymentBreakdown.change)}</span></p>}
          <hr />
          <p className="receipt-thanks">¡Gracias por su compra!</p>
        </div>
        <div className="receipt-actions no-print">
          <button type="button" className="primary-button" onClick={handlePrint}>Imprimir (58 mm)</button>
          <button type="button" className="secondary-button" onClick={onClose}>Cerrar</button>
        </div>
        <p className="receipt-hint no-print">Conecta la impresora térmica y elígela en el diálogo de impresión del navegador.</p>
      </div>
    </div>
  )
}
