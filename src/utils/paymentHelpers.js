export function buildPaymentPayload({ paymentMethod, total, cashReceived, mixedTransfer }) {
  const effectiveCashReceived = cashReceived === '' ? total : Math.max(Number(cashReceived) || 0, 0)
  const cashChange = paymentMethod === 'CASH' ? Math.max(effectiveCashReceived - total, 0) : 0
  const effectiveMixedTransfer = Math.max(Number(mixedTransfer) || 0, 0)
  const mixedCashDue = Math.max(total - effectiveMixedTransfer, 0)

  if (paymentMethod === 'CASH') {
    if (effectiveCashReceived < total) throw new Error('El efectivo recibido debe ser igual o mayor al total.')
    return { method: 'CASH', breakdown: { cash: total, transfer: 0, received: effectiveCashReceived, change: cashChange } }
  }
  if (paymentMethod === 'TRANSFER') {
    return { method: 'TRANSFER', breakdown: { cash: 0, transfer: total, received: total, change: 0 } }
  }
  if (effectiveMixedTransfer > total) throw new Error('La transferencia no puede ser mayor que el total.')
  return { method: 'MIXED', breakdown: { cash: mixedCashDue, transfer: effectiveMixedTransfer, received: total, change: 0 } }
}
