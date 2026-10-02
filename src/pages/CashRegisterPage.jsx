import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getCurrentSession, openCashRegister, closeCashRegister, addTransaction, getTransactions } from '../services/firebase/cashService'
import { fetchDailyMetrics } from '../services/firebase/dashboardService'

const formatMoney = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)

export default function CashRegisterPage() {
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ totalSales: 0 })
  
  const [initialAmount, setInitialAmount] = useState('')
  const [transactionAmount, setTransactionAmount] = useState('')
  const [transactionReason, setTransactionReason] = useState('')
  const [transactionType, setTransactionType] = useState('WITHDRAWAL')
  const [actualCash, setActualCash] = useState('')

  useEffect(() => {
    loadSession()
  }, [])

  async function loadSession() {
    setLoading(true)
    try {
      const current = await getCurrentSession()
      setSession(current)
      if (current) {
        const txs = await getTransactions(current.id)
        setTransactions(txs)
        const daily = await fetchDailyMetrics()
        setMetrics(daily)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleOpen(e) {
    e.preventDefault()
    await openCashRegister(user.uid, Number(initialAmount))
    setInitialAmount('')
    await loadSession()
  }

  async function handleAddTransaction(e) {
    e.preventDefault()
    await addTransaction(session.id, transactionType, Number(transactionAmount), transactionReason, user.uid)
    setTransactionAmount('')
    setTransactionReason('')
    const txs = await getTransactions(session.id)
    setTransactions(txs)
  }

  async function handleClose(e) {
    e.preventDefault()
    const expected = expectedCash
    const actual = Number(actualCash)
    const difference = actual - expected
    await closeCashRegister(session.id, expected, actual, difference, user.uid)
    setActualCash('')
    await loadSession()
  }

  if (loading) return <div className="screen-message">Cargando caja...</div>

  if (!session) {
    return (
      <section className="catalog-page">
        <p className="eyebrow">CAJA</p>
        <h1>Apertura de Caja</h1>
        <form className="catalog-form" onSubmit={handleOpen}>
          <div className="form-grid">
            <label>Monto inicial (Base)
              <input type="number" min="0" value={initialAmount} onChange={e => setInitialAmount(e.target.value)} required />
            </label>
          </div>
          <button type="submit" className="primary-button" style={{ marginTop: '15px' }}>Abrir Caja</button>
        </form>
      </section>
    )
  }

  const incomes = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0)
  const withdrawals = transactions.filter(t => t.type === 'WITHDRAWAL').reduce((acc, t) => acc + t.amount, 0)
  // Simple expected cash: initial + incomes + sales - withdrawals. 
  // In a real app we only add CASH sales, but for this demo we assume totalSales is mostly cash or handled via metrics
  const expectedCash = Number(session.initialAmount) + incomes + (metrics?.totalSales || 0) - withdrawals

  return (
    <section className="catalog-page">
      <p className="eyebrow">CAJA - TURNO ABIERTO</p>
      <h1>Gestión de Caja</h1>
      
      <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr', marginBottom: '20px' }}>
        <div className="hero-card" style={{ padding: '20px' }}>
          <p className="eyebrow">BASE INICIAL</p>
          <h2>{formatMoney(session.initialAmount)}</h2>
        </div>
        <div className="hero-card" style={{ padding: '20px' }}>
          <p className="eyebrow">EFECTIVO ESPERADO</p>
          <h2 style={{ color: 'var(--primary)' }}>{formatMoney(expectedCash)}</h2>
        </div>
      </div>

      <form className="catalog-form" onSubmit={handleAddTransaction}>
        <h2>Registrar Movimiento</h2>
        <div className="form-grid">
          <label>Tipo
            <select value={transactionType} onChange={e => setTransactionType(e.target.value)}>
              <option value="WITHDRAWAL">Retiro (Gasto)</option>
              <option value="INCOME">Ingreso</option>
            </select>
          </label>
          <label>Monto<input type="number" min="1" value={transactionAmount} onChange={e => setTransactionAmount(e.target.value)} required /></label>
          <label style={{ gridColumn: '1 / -1' }}>Motivo<input type="text" value={transactionReason} onChange={e => setTransactionReason(e.target.value)} required /></label>
        </div>
        <button type="submit" className="secondary-button" style={{ marginTop: '15px' }}>Registrar Movimiento</button>
      </form>

      <form className="catalog-form" onSubmit={handleClose}>
        <h2>Cierre de Caja</h2>
        <div className="form-grid">
          <label>Efectivo real en caja
            <input type="number" min="0" value={actualCash} onChange={e => setActualCash(e.target.value)} required />
          </label>
        </div>
        <button type="submit" className="primary-button" style={{ marginTop: '15px' }}>Cerrar Turno</button>
      </form>

      {transactions.length > 0 && (
        <div className="catalog-list">
          <h3 style={{ margin: '20px 0 10px' }}>Últimos movimientos</h3>
          {transactions.map(t => (
            <article key={t.id} className="catalog-item category-item">
              <div>
                <strong>{t.reason}</strong>
                <small className={t.type === 'INCOME' ? 'available' : 'unavailable'}>
                  {t.type === 'INCOME' ? 'Ingreso: ' : 'Retiro: '} {formatMoney(t.amount)}
                </small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
