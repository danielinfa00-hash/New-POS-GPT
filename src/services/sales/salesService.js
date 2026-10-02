import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

export async function createSale({ userId, cart, discount, payment, isDelivery, deliveryCost }) {
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const total = Math.max(0, subtotal - discount + deliveryCost)
  const counterRef = doc(db, 'settings', 'counters')
  const saleRef = doc(collection(db, 'sales'))
  const orderRef = doc(collection(db, 'orders'))

  await runTransaction(db, async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef)
    const nextNumber = (counterSnapshot.exists() ? Number(counterSnapshot.data().saleOrderNumber || 0) : 0) + 1
    const orderCode = `#${String(nextNumber).padStart(3, '0')}`
    const items = cart.map((item) => ({
      productId: item.id, productName: item.name, quantity: item.quantity,
      unitPrice: item.price, subtotal: item.price * item.quantity, note: item.note || ''
    }))
    const baseData = {
      saleNumber: nextNumber, orderCode, userId, items, subtotal, discount, deliveryCost,
      total, paymentMethod: payment.method, paymentBreakdown: payment.breakdown,
      orderType: isDelivery ? 'DELIVERY' : 'PICKUP', createdAt: serverTimestamp()
    }
    transaction.set(counterRef, { saleOrderNumber: nextNumber, updatedAt: serverTimestamp() }, { merge: true })
    transaction.set(saleRef, { ...baseData, status: 'COMPLETED' })
    transaction.set(orderRef, { ...baseData, saleId: saleRef.id, status: 'NUEVO' })
  })

  return { subtotal, total }
}
