import { collection, query, where, getDocs, doc, Timestamp, orderBy, serverTimestamp, runTransaction, increment } from 'firebase/firestore'
import { db } from './config'

export async function fetchSalesByRange({ startDate, endDate } = {}, { userId, isAdmin = false } = {}) {
  if (!db) return []
  const constraints = [orderBy('createdAt', 'desc')]
  if (startDate) constraints.unshift(where('createdAt', '>=', Timestamp.fromDate(startDate)))
  if (endDate) constraints.unshift(where('createdAt', '<', Timestamp.fromDate(endDate)))
  // Las reglas permiten a un cajero consultar únicamente sus propias ventas.
  // Incluir este filtro evita que Firestore rechace toda la consulta.
  if (!isAdmin && userId) constraints.unshift(where('userId', '==', userId))
  const q = query(collection(db, 'sales'), ...constraints)
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function fetchSalesByDate(date, options) {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return fetchSalesByRange({ startDate: start, endDate: end }, options)
}

export async function cancelSale(saleId, reason, userId) {
  if (!db) throw new Error('Firebase no configurado')
  const saleRef = doc(db, 'sales', saleId)

  // La anulación y la reposición se realizan como una sola operación: nunca
  // queda una venta anulada sin que su inventario se haya devuelto.
  await runTransaction(db, async (transaction) => {
    const saleSnapshot = await transaction.get(saleRef)
    if (!saleSnapshot.exists()) throw new Error('La venta ya no existe.')
    const sale = saleSnapshot.data()
    if (sale.status !== 'COMPLETED') throw new Error('Esta venta ya fue anulada.')

    const items = sale.items || sale.cart || []
    const productRefs = items
      .map((item) => ({ productId: item.productId || item.id, quantity: Number(item.quantity) || 0 }))
      .filter(({ productId, quantity }) => productId && quantity > 0)
      .map(({ productId, quantity }) => ({ ref: doc(db, 'products', productId), quantity }))
    const productSnapshots = await Promise.all(productRefs.map(({ ref }) => transaction.get(ref)))

    transaction.update(saleRef, {
      status: 'CANCELLED',
      cancelledAt: serverTimestamp(),
      cancelledBy: userId,
      cancelReason: reason
    })
    productSnapshots.forEach((productSnapshot, index) => {
      if (productSnapshot.exists()) transaction.update(productRefs[index].ref, { stock: increment(productRefs[index].quantity) })
    })
  })
}
