import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db } from './config'

export async function fetchDailyMetrics() {
  if (!db) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const q = query(
    collection(db, 'sales'),
    where('createdAt', '>=', Timestamp.fromDate(today)),
    where('createdAt', '<', Timestamp.fromDate(tomorrow))
  )
  
  const snapshot = await getDocs(q)
  const sales = snapshot.docs.map(d => d.data())
  
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0)
  const totalOrders = sales.length
  const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0
  
  const productCounts = {}
  sales.forEach(sale => {
    sale.cart?.forEach(item => {
      productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity
    })
  })
  
  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }))

  return { totalSales, totalOrders, averageTicket, topProducts }
}
