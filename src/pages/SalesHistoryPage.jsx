import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchSalesByDate, cancelSale } from '../services/firebase/salesHistoryService'

const formatMoney = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)

export default function SalesHistoryPage() {
  const { user, profile } = useAuth()
  
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadSales()
  }, [date])

  async function loadSales() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchSalesByDate(date)
      setSales(data)
    } catch (err) {
      setError('Error al cargar ventas: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(saleId) {
    const reason = prompt('Motivo de cancelación:')
    if (!reason) return
    
    try {
      await cancelSale(saleId, reason, user.uid)
      setSuccess('Venta cancelada correctamente')
      loadSales()
    } catch (err) {
      setError('Error al cancelar venta')
    }
  }

  return (
    <section className="catalog-page">
      <p className="eyebrow">REPORTES</p>
      <h1>Historial de Ventas</h1>
      
      {error && <p className="notice error-message">{error}</p>}
      {success && <p className="notice success">{success}</p>}

      <div className="catalog-form" style={{ marginBottom: '20px' }}>
        <label>Fecha de consulta
          <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today} />
        </label>
      </div>

      {loading ? (
        <p>Cargando ventas...</p>
      ) : sales.length === 0 ? (
        <p className="empty-state">No hay ventas registradas para esta fecha.</p>
      ) : (
        <div className="catalog-list">
          {sales.map(sale => (
            <article key={sale.id} className="catalog-item category-item" style={{ opacity: sale.status === 'CANCELLED' ? 0.6 : 1 }}>
              <div>
                <strong>Total: {formatMoney(sale.total)}</strong>
                <small>Método: {sale.payment?.method || 'N/A'}</small>
                <small>Artículos: {sale.cart?.length || 0}</small>
                {sale.status === 'CANCELLED' && (
                  <small className="unavailable">CANCELADA: {sale.cancelReason}</small>
                )}
                {sale.isDelivery && <small style={{color: 'var(--primary)'}}>Domicilio (+{formatMoney(sale.deliveryCost)})</small>}
              </div>
              
              <div className="item-actions">
                <details style={{ width: '100%' }}>
                  <summary style={{ cursor: 'pointer', padding: '10px 0', fontWeight: 'bold', color: 'var(--text-main)' }}>Ver detalle</summary>
                  <ul style={{ paddingLeft: '20px', margin: '5px 0', color: 'var(--text-muted)' }}>
                    {sale.cart?.map((item, idx) => (
                      <li key={idx}>
                        {item.quantity}x {item.name} - {formatMoney(item.price * item.quantity)}
                      </li>
                    ))}
                  </ul>
                  {sale.discount > 0 && <p>Descuento: -{formatMoney(sale.discount)}</p>}
                </details>

                {sale.status !== 'CANCELLED' && (profile?.role === 'ADMIN' || profile?.role === 'CAJERO') && (
                  <button className="delete-button" onClick={() => handleCancel(sale.id)}>Cancelar Venta</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
