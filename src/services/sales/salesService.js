import { collection, doc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

export async function createSale({ userId, cart, discount, payment, isDelivery, deliveryCost, tableLabel, source = 'COUNTER' }) {
  if (!db) throw new Error('Firebase no configurado')
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const total = Math.max(0, subtotal - discount + deliveryCost)
  const counterRef = doc(db, 'settings', 'counters')
  const saleRef = doc(collection(db, 'sales'))
  const orderRef = doc(collection(db, 'orders'))

  let saleMeta = {}

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
      orderType: isDelivery ? 'DELIVERY' : 'PICKUP', source, tableLabel: tableLabel || null,
      createdAt: serverTimestamp()
    }
    saleMeta = {
      orderCode, saleNumber: nextNumber, items, subtotal, discount, deliveryCost, total,
      paymentMethod: payment.method, paymentBreakdown: payment.breakdown,
      isDelivery, tableLabel: tableLabel || null, createdAt: Date.now()
    }
    transaction.set(counterRef, { saleOrderNumber: nextNumber, updatedAt: serverTimestamp() }, { merge: true })
    transaction.set(saleRef, { ...baseData, status: 'COMPLETED' })
    transaction.set(orderRef, { ...baseData, saleId: saleRef.id, status: 'NUEVO' })
    
    for (const item of cart) {
      if (item.id) {
        transaction.update(doc(db, 'products', item.id), { stock: increment(-item.quantity) })
      }
    }
  })

  return saleMeta
}
