import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchDailyMetrics } from '../services/firebase/dashboardService'

const formatMoney = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)

export default function HomePage() {
  const { profile } = useAuth()
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMetrics() {
      try {
        const data = await fetchDailyMetrics()
        setMetrics(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadMetrics()
  }, [])

  return (
    <section>
      <div className="hero-card">
        <p className="eyebrow">SESIÓN ACTIVA</p>
        <h1>Bienvenido{profile?.name ? `, ${profile.name}` : ''}.</h1>
        <p>Tu rol actual es <strong>{profile?.role}</strong>.</p>
      </div>

      {!loading && metrics && (
        <div style={{ display: 'grid', gap: '15px', marginTop: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="hero-card" style={{ padding: '20px' }}>
            <p className="eyebrow">VENTAS HOY</p>
            <h2 style={{ margin: '10px 0 0', fontSize: '1.8rem' }}>{formatMoney(metrics.totalSales)}</h2>
          </div>
          <div className="hero-card" style={{ padding: '20px' }}>
            <p className="eyebrow">PEDIDOS HOY</p>
            <h2 style={{ margin: '10px 0 0', fontSize: '1.8rem' }}>{metrics.totalOrders}</h2>
          </div>
          <div className="hero-card" style={{ padding: '20px' }}>
            <p className="eyebrow">TICKET PROMEDIO</p>
            <h2 style={{ margin: '10px 0 0', fontSize: '1.8rem' }}>{formatMoney(metrics.averageTicket)}</h2>
          </div>
          
          <div className="hero-card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
            <p className="eyebrow">PRODUCTOS MÁS VENDIDOS</p>
            <ul style={{ margin: '10px 0 0', paddingLeft: '20px', color: 'var(--text-main)' }}>
              {metrics.topProducts.map((p, i) => (
                <li key={i}><strong>{p.name}</strong> ({p.quantity} uds)</li>
              ))}
              {metrics.topProducts.length === 0 && <li>Aún no hay ventas hoy.</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
