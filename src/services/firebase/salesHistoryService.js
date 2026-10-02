import { collection, query, where, getDocs, doc, updateDoc, Timestamp, orderBy } from 'firebase/firestore'
import { db } from './config'

export async function fetchSalesByDate(date) {
  if (!db) return []
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const q = query(
    collection(db, 'sales'),
    where('createdAt', '>=', Timestamp.fromDate(start)),
    where('createdAt', '<=', Timestamp.fromDate(end)),
    orderBy('createdAt', 'desc')
  )
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function cancelSale(saleId, reason, userId) {
  if (!db) return
  // Instead of deleting, we mark it as cancelled for audit trails
  await updateDoc(doc(db, 'sales', saleId), {
    status: 'CANCELLED',
    cancelledAt: Timestamp.now(),
    cancelledBy: userId,
    cancelReason: reason
  })
}
