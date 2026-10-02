import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { subscribeToCategories, subscribeToProducts } from '../services/catalog/catalogService'
import { createSale } from '../services/sales/salesService'
import { buildPaymentPayload } from '../utils/paymentHelpers'
import SaleReceipt from '../components/SaleReceipt'

const formatMoney = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)

export default function SalesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('pos-counter-cart') || '[]') } catch { return [] }
  })
  const [discount, setDiscount] = useState(0)
  const [isDelivery, setIsDelivery] = useState(false)
  const [deliveryCost, setDeliveryCost] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [mixedTransfer, setMixedTransfer] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [sortOrder, setSortOrder] = useState('name-asc')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    const onError = () => setError('No fue posible cargar los productos. Revisa tus permisos o conexión.')
    const stopCategories = subscribeToCategories(setCategories, onError)
    const stopProducts = subscribeToProducts(setProducts, onError)
    return () => { stopCategories(); stopProducts() }
  }, [])

  useEffect(() => {
    sessionStorage.setItem('pos-counter-cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    const list = products.filter((product) => product.available && (selectedCategory === 'all' || product.categoryId === selectedCategory) && (!term || product.name.toLocaleLowerCase('es').includes(term)))
    return list.sort((a, b) => {
      if (sortOrder === 'name-desc') return b.name.localeCompare(a.name, 'es')
      if (sortOrder === 'price-asc') return Number(a.price || 0) - Number(b.price || 0)
      if (sortOrder === 'price-desc') return Number(b.price || 0) - Number(a.price || 0)
      return a.name.localeCompare(b.name, 'es')
    })
  }, [products, selectedCategory, sortOrder, search])
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const safeDiscount = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const safeDeliveryCost = isDelivery ? Math.max(Number(deliveryCost) || 0, 0) : 0
  const total = subtotal - safeDiscount + safeDeliveryCost
  const effectiveCashReceived = cashReceived === '' ? total : Math.max(Number(cashReceived) || 0, 0)
  const cashChange = paymentMethod === 'CASH' ? Math.max(effectiveCashReceived - total, 0) : 0
  const effectiveMixedTransfer = Math.max(Number(mixedTransfer) || 0, 0)
  const mixedCashDue = Math.max(total - effectiveMixedTransfer, 0)

  function addToCart(product) {
    setSuccess(''); setError('')
    setToast(`${product.name} añadido al carrito`)
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { ...product, quantity: 1, note: '' }]
    })
  }
  function updateItem(id, changes) { setCart((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item)) }
  function changeQuantity(id, quantity) { setCart((current) => quantity < 1 ? current.filter((item) => item.id !== id) : current.map((item) => item.id === id ? { ...item, quantity } : item)) }

  const [isCartOpen, setIsCartOpen] = useState(false)

  async function charge() {
    setError(''); setSuccess('')
    if (!cart.length) { setError('Agrega al menos un producto al carrito.'); return }
    try {
      const payment = buildPaymentPayload({ paymentMethod, total, cashReceived, mixedTransfer })
      setSubmitting(true)
      const result = await createSale({ userId: user.uid, cart, discount: safeDiscount, payment, isDelivery, deliveryCost: safeDeliveryCost })
      setCart([]); sessionStorage.removeItem('pos-counter-cart'); setDiscount(0); setIsDelivery(false); setDeliveryCost(0); setCashReceived(''); setMixedTransfer('')
      setReceipt(result)
      setSuccess(`Venta registrada correctamente por ${formatMoney(result.total)}. El pedido fue enviado a cocina.`)
      setIsCartOpen(false)
    } catch (saleError) {
      setError(saleError.message || 'No fue posible guardar la venta. Intenta nuevamente.')
    } finally { setSubmitting(false) }
  }

  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0)

  return <section className="pos-page">
    <p className="eyebrow">PUNTO DE VENTA</p><h1>Nueva venta</h1>
    {success && <p className="notice success">{success}</p>}{error && <p className="notice error-message">{error}</p>}
    <div className="pos-layout">
      <div className="menu-panel"><div className="category-chips"><button type="button" className={selectedCategory === 'all' ? 'selected' : ''} onClick={() => setSelectedCategory('all')}>Todos</button>{categories.filter((category) => category.active).map((category) => <button type="button" key={category.id} className={selectedCategory === category.id ? 'selected' : ''} onClick={() => setSelectedCategory(category.id)}>{category.name}</button>)}</div>
        <div className="product-toolbar"><label className="product-search">Buscar producto<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre del producto" /></label><label className="product-sort">Ordenar productos<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="name-asc">Nombre: A a Z</option><option value="name-desc">Nombre: Z a A</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option></select></label></div>
        <div className="product-grid">{visibleProducts.map((product) => <button type="button" className="pos-product" key={product.id} onClick={() => { addToCart(product); setSuccess('') }}>{product.imageUrl && <img src={product.imageUrl} alt="" />}<strong>{product.name}</strong><span>{formatMoney(product.price)}</span></button>)}{!visibleProducts.length && <p className="empty-state">No hay productos disponibles en esta categoría.</p>}</div>
      </div>
      
      <div className={`cart-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}></div>
      
      <aside className={`cart-panel ${isCartOpen ? 'open' : ''}`}>
        <button type="button" className="cart-close-btn" onClick={() => setIsCartOpen(false)}>Cerrar carrito</button>
        <h2>Carrito</h2>{cart.length ? <div className="cart-items">{cart.map((item) => <article key={item.id} className="cart-item"><div><strong>{item.name}</strong><small>{formatMoney(item.price)} c/u</small></div><div className="quantity-controls"><button onClick={() => changeQuantity(item.id, item.quantity - 1)} aria-label={`Quitar ${item.name}`}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, item.quantity + 1)} aria-label={`Agregar ${item.name}`}>+</button></div><strong>{formatMoney(item.price * item.quantity)}</strong><input aria-label={`Nota para ${item.name}`} placeholder="Nota (opcional)" value={item.note} onChange={(event) => updateItem(item.id, { note: event.target.value })} /></article>)}</div> : <p className="empty-state">Toca un producto para agregarlo.</p>}
        <label>Descuento<input type="number" min="0" max={subtotal} value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
        <label className="delivery-row"><input type="checkbox" checked={isDelivery} onChange={(event) => { const enabled = event.target.checked; setIsDelivery(enabled); setDeliveryCost(enabled ? 2000 : 0) }} /> Es domicilio</label>
        {isDelivery && <label>Costo del domicilio<input type="number" min="0" value={deliveryCost} onChange={(event) => setDeliveryCost(event.target.value)} required /></label>}
        <div className="totals"><span>Subtotal <strong>{formatMoney(subtotal)}</strong></span><span>Descuento <strong>− {formatMoney(safeDiscount)}</strong></span>{isDelivery && <span>Domicilio <strong>{formatMoney(safeDeliveryCost)}</strong></span>}<span className="grand-total">Total <strong>{formatMoney(total)}</strong></span></div>
        <fieldset className="payment-methods"><legend>Método de pago</legend><label><input type="radio" name="payment" checked={paymentMethod === 'CASH'} onChange={() => setPaymentMethod('CASH')} /> Efectivo</label><label><input type="radio" name="payment" checked={paymentMethod === 'TRANSFER'} onChange={() => setPaymentMethod('TRANSFER')} /> Transferencia</label><label><input type="radio" name="payment" checked={paymentMethod === 'MIXED'} onChange={() => setPaymentMethod('MIXED')} /> Mixto</label></fieldset>
        {paymentMethod === 'CASH' && <div className="payment-fields"><label>Recibido <small className="field-hint">Déjalo vacío si recibes el valor exacto.</small><input type="number" min="0" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} /></label><p>Cambio: <strong>{formatMoney(cashChange)}</strong></p></div>}
        {paymentMethod === 'MIXED' && <div className="form-grid"><label>Efectivo restante<input type="number" value={mixedCashDue} readOnly /></label><label>Transferencia<input type="number" min="0" max={total} value={mixedTransfer} onChange={(event) => setMixedTransfer(event.target.value)} /><small className="field-hint">Escribe el valor recibido por transferencia.</small></label></div>}
        <button type="button" className="charge-button" disabled={submitting || !cart.length} onClick={charge}>{submitting ? 'Guardando…' : `COBRAR ${formatMoney(total)}`}</button>
      </aside>

      <button type="button" className="minimized-cart-toggle" onClick={() => setIsCartOpen(true)}>
        <span className="badge">{cartItemCount}</span>
        Ver Carrito ({formatMoney(total)})
      </button>
    </div>
    {receipt && <SaleReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
    {toast && <div className="cart-toast" role="status">✓ {toast}</div>}
  </section>
}
