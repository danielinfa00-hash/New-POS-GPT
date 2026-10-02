import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db } from './config'

export async function fetchDailyMetrics() {
  if (!db) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const salesQuery = query(
    collection(db, 'sales'),
    where('createdAt', '>=', Timestamp.fromDate(today)),
    where('createdAt', '<', Timestamp.fromDate(tomorrow))
  )

  const productsQuery = query(
    collection(db, 'products'),
    where('trackStock', '==', true)
  )

  const [salesSnap, productsSnap] = await Promise.all([
    getDocs(salesQuery),
    getDocs(productsQuery).catch(() => ({ docs: [] }))
  ])

  // Las ventas anuladas permanecen en el historial para auditoría, pero no
  // representan ingreso, pedido ni consumo de inventario en el dashboard.
  const sales = salesSnap.docs.map((d) => d.data()).filter((sale) => sale.status !== 'CANCELLED')

  const totalSales = sales.reduce((sum, sale) => sum + (sale.total || 0), 0)
  const totalOrders = sales.length
  const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0

  let cashTotal = 0
  let transferTotal = 0
  sales.forEach((sale) => {
    const breakdown = sale.paymentBreakdown
    if (breakdown) {
      cashTotal += Number(breakdown.cash) || 0
      transferTotal += Number(breakdown.transfer) || 0
    } else if (sale.paymentMethod === 'CASH') {
      cashTotal += sale.total || 0
    } else if (sale.paymentMethod === 'TRANSFER') {
      transferTotal += sale.total || 0
    }
  })

  const productCounts = {}
  sales.forEach((sale) => {
    const lineItems = sale.items || sale.cart || []
    lineItems.forEach((item) => {
      const name = item.productName || item.name
      if (!name) return
      productCounts[name] = (productCounts[name] || 0) + (item.quantity || 0)
    })
  })

  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }))

  const stockAlerts = productsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => (p.stock || 0) <= (p.minStock || 0))
    .map((p) => ({ ...p, computedAlert: (p.stock || 0) <= 0 ? 'OUT' : 'LOW' }))
    .sort((a, b) => (a.computedAlert === 'OUT' ? -1 : 1) - (b.computedAlert === 'OUT' ? -1 : 1))

  return { totalSales, totalOrders, averageTicket, topProducts, cashTotal, transferTotal, stockAlerts }
}
