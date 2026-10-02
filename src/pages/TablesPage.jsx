import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { subscribeToCategories, subscribeToProducts } from '../services/catalog/catalogService'
import {
  cancelTableOrder, markTableOrderPaid, openTable, subscribeOpenTables, updateTableOrder, subscribeTablesConfig, addTableConfig, renameTable, removeTable
} from '../services/firebase/tableService'
import { createSale } from '../services/sales/salesService'
import { buildPaymentPayload } from '../utils/paymentHelpers'
import SaleReceipt from '../components/SaleReceipt'

const formatMoney = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)

function tableSubtotal(cart) {
  return (cart || []).reduce((total, item) => total + item.price * item.quantity, 0)
}

export default function TablesPage() {
  const { user } = useAuth()
  const [tables, setTables] = useState([])
  const [configuredTables, setConfiguredTables] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [selectedTableId, setSelectedTableId] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [newTableNumber, setNewTableNumber] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [opening, setOpening] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [mixedTransfer, setMixedTransfer] = useState('')
  const [isDelivery, setIsDelivery] = useState(false)
  const [deliveryCost, setDeliveryCost] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [localCart, setLocalCart] = useState([])
  const [localDiscount, setLocalDiscount] = useState(0)
  const [tableNote, setTableNote] = useState('')
  const [sortOrder, setSortOrder] = useState('name-asc')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [editingTableId, setEditingTableId] = useState(null)
  const persistTimer = useRef(null)

  const selectedTable = useMemo(() => tables.find((t) => t.id === selectedTableId) || null, [tables, selectedTableId])

  useEffect(() => {
    const onError = () => setError('No fue posible cargar las mesas.')
    const stopTables = subscribeOpenTables(setTables, onError)
    const stopConfig = subscribeTablesConfig(setConfiguredTables)
    const stopCategories = subscribeToCategories(setCategories, onError)
    const stopProducts = subscribeToProducts(setProducts, onError)
    return () => { stopTables(); stopConfig(); stopCategories(); stopProducts() }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Sync only on selection change to initialize
  useEffect(() => {
    setCheckoutOpen(false)
    if (!selectedTableId) {
      setLocalCart([])
      setLocalDiscount(0)
      setTableNote('')
      return
    }
    const table = tables.find((t) => t.id === selectedTableId)
    if (!table) return
    setLocalCart(table.cart || [])
    setLocalDiscount(table.discount || 0)
    setTableNote(table.note || '')
  }, [selectedTableId]) // Only depend on selectedTableId

  // Background sync for cart from other devices (avoid overwriting during active edits)
  useEffect(() => {
    if (!selectedTableId) return
    const table = tables.find((t) => t.id === selectedTableId)
    if (!table) return
    // Only overwrite if the cart length changed (e.g., someone else added an item)
    // This prevents local typing/quantities from being overwritten by delayed snapshots
    setLocalCart((current) => {
      if (current.length !== (table.cart || []).length) return table.cart || []
      return current
    })
  }, [tables, selectedTableId])

  const persistTable = useCallback((tableId, cart, discount, note) => {
    if (!tableId) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      updateTableOrder(tableId, { cart, discount, note })
        .catch(() => setError('No se pudo guardar la orden en la base de datos (revisa los permisos).'))
        .finally(() => { persistTimer.current = null })
    }, 400)
  }, [])

  useEffect(() => {
    if (!selectedTableId || !selectedTable) return
    persistTable(selectedTableId, localCart, localDiscount, tableNote)
  }, [localCart, localDiscount, tableNote, selectedTableId, selectedTable, persistTable])

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    const list = products.filter((p) => p.available && (selectedCategory === 'all' || p.categoryId === selectedCategory) && (!term || p.name.toLocaleLowerCase('es').includes(term)))
    return list.sort((a, b) => {
      if (sortOrder === 'name-desc') return b.name.localeCompare(a.name, 'es')
      if (sortOrder === 'price-asc') return Number(a.price || 0) - Number(b.price || 0)
      if (sortOrder === 'price-desc') return Number(b.price || 0) - Number(a.price || 0)
      return a.name.localeCompare(b.name, 'es')
    })
  }, [products, selectedCategory, search, sortOrder])

  const subtotal = tableSubtotal(localCart)
  const safeDiscount = Math.min(Math.max(Number(localDiscount) || 0, 0), subtotal)
  const safeDeliveryCost = isDelivery ? Math.max(Number(deliveryCost) || 0, 0) : 0
  const total = subtotal - safeDiscount + safeDeliveryCost
  const effectiveCashReceived = cashReceived === '' ? total : Math.max(Number(cashReceived) || 0, 0)
  const cashChange = paymentMethod === 'CASH' ? Math.max(effectiveCashReceived - total, 0) : 0
  const effectiveMixedTransfer = Math.max(Number(mixedTransfer) || 0, 0)
  const mixedCashDue = Math.max(total - effectiveMixedTransfer, 0)

  function addToCart(product) {
    setError('')
    setToast(`${product.name} añadido a ${selectedTable?.label || 'la mesa'}`)
    setLocalCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { id: product.id, name: product.name, price: product.price, quantity: 1, note: '' }]
    })
  }

  function changeQuantity(id, quantity) {
    setLocalCart((current) => quantity < 1 ? current.filter((item) => item.id !== id) : current.map((item) => item.id === id ? { ...item, quantity } : item))
  }

  function updateItem(id, changes) {
    setLocalCart((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  async function updateOpenTableItems(table, nextCart) {
    try {
      await updateTableOrder(table.id, { cart: nextCart, discount: table.discount || 0 })
      setToast(`Pedido de ${table.label} actualizado`)
    } catch {
      setError('No se pudo actualizar el pedido de la mesa.')
    }
  }

  function changeOpenTableQuantity(table, itemId, quantity) {
    const nextCart = (table.cart || []).flatMap((item) => {
      if (item.id !== itemId) return [item]
      return quantity < 1 ? [] : [{ ...item, quantity }]
    })
    updateOpenTableItems(table, nextCart)
  }

  function updateOpenTableNote(table, itemId, note) {
    updateOpenTableItems(table, (table.cart || []).map((item) => item.id === itemId ? { ...item, note } : item))
  }

  async function updateTableCustomer(table, note) {
    try {
      await updateTableOrder(table.id, { cart: table.cart || [], discount: table.discount || 0, note })
      setToast(`Identificación de ${table.label} actualizada`)
    } catch { setError('No se pudo guardar la identificación de la mesa.') }
  }

  async function handleOpenTable(label) {
    setError('')
    setOpening(true)
    try {
      const id = await openTable({ tableNumber: label, label, userId: user.uid })
      setSelectedTableId(id)
      setMessage(`Mesa ${label} abierta.`)
    } catch (err) {
      setError(err.message || 'No se pudo abrir la mesa.')
    } finally {
      setOpening(false)
    }
  }

  async function handleAddNewTable() {
    const name = window.prompt("Introduce el nombre o número de la nueva mesa:")
    if (name && name.trim()) {
      try {
        await addTableConfig(name.trim())
        setMessage('Mesa agregada correctamente.')
      } catch (err) {
        setError('No se pudo agregar la mesa.')
      }
    }
  }

  async function handleCancelTable() {
    if (!selectedTable) return
    if (!window.confirm(`¿Cancelar ${selectedTable.label}? Se perderán los productos agregados.`)) return
    try {
      await cancelTableOrder(selectedTable.id)
      setSelectedTableId(null)
      setMessage('Mesa cancelada.')
    } catch {
      setError('No se pudo cancelar la mesa.')
    }
  }

  async function handleClearTable(table) {
    if (!window.confirm(`¿Vaciar ${table.label}? La mesa seguirá abierta, pero se eliminarán los productos y la nota.`)) return
    try {
      await updateTableOrder(table.id, { cart: [], discount: 0, note: '' })
      if (selectedTableId === table.id) { setLocalCart([]); setLocalDiscount(0); setTableNote('') }
      setMessage(`${table.label} fue vaciada.`)
    } catch { setError('No se pudo vaciar la mesa.') }
  }

  async function handleRenameTable(label, table) {
    const nextName = window.prompt('Nuevo nombre de la mesa:', label)
    if (!nextName || nextName.trim() === label) return
    try {
      await renameTable({ currentLabel: label, newLabel: nextName, tableId: table?.id })
      setMessage('Nombre de mesa actualizado.')
    } catch (err) { setError(err.message || 'No se pudo cambiar el nombre de la mesa.') }
  }

  async function handleRemoveTable(label, table) {
    const extra = table ? ' La orden abierta se cancelará.' : ''
    if (!window.confirm(`¿Eliminar la mesa “${label}”?${extra}`)) return
    try {
      await removeTable({ label, tableId: table?.id })
      if (selectedTableId === table?.id) setSelectedTableId(null)
      setMessage('Mesa eliminada.')
    } catch { setError('No se pudo eliminar la mesa.') }
  }

  async function handleCharge() {
    if (!selectedTable || !localCart.length) {
      setError('Agrega al menos un producto.')
      return
    }
    setError('')
    try {
      const payment = buildPaymentPayload({ paymentMethod, total, cashReceived, mixedTransfer })
      setSubmitting(true)
      const saleResult = await createSale({
        userId: user.uid,
        cart: localCart,
        discount: safeDiscount,
        payment,
        isDelivery,
        deliveryCost: safeDeliveryCost,
        tableLabel: selectedTable.label,
        source: 'TABLE'
      })
      await markTableOrderPaid(selectedTable.id)
      setReceipt(saleResult)
      setSelectedTableId(null)
      setCheckoutOpen(false)
      setPaymentMethod('CASH')
      setCashReceived('')
      setMixedTransfer('')
      setIsDelivery(false)
      setDeliveryCost(0)
      setMessage('Cobro registrado.')
    } catch (err) {
      setError(err.message || 'No fue posible cobrar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (selectedTable) {
    return (
      <section className="pos-page tables-page">
        <button type="button" className="secondary-button table-back" onClick={() => setSelectedTableId(null)}>← Mesas</button>
        <p className="eyebrow">MESA ABIERTA</p>
        <h1>{selectedTable.label}</h1>
        {message && <p className="notice success">{message}</p>}
        {error && <p className="notice error-message">{error}</p>}

        <div className="pos-layout">
          <div className="menu-panel">
            <div className="category-chips">
              <button type="button" className={selectedCategory === 'all' ? 'selected' : ''} onClick={() => setSelectedCategory('all')}>Todos</button>
              {categories.filter((c) => c.active).map((category) => (
                <button type="button" key={category.id} className={selectedCategory === category.id ? 'selected' : ''} onClick={() => setSelectedCategory(category.id)}>{category.name}</button>
              ))}
            </div>
            <div className="product-toolbar"><label className="product-search">Buscar producto<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre del producto" /></label><label className="product-sort">Ordenar productos<select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}><option value="name-asc">Nombre: A a Z</option><option value="name-desc">Nombre: Z a A</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option></select></label></div>
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <button type="button" className="pos-product" key={product.id} onClick={() => addToCart(product)}>
                  {product.imageUrl && <img src={product.imageUrl} alt="" />}
                  <strong>{product.name}</strong>
                  <span>{formatMoney(product.price)}</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="cart-panel table-cart-panel">
            <h2>Orden</h2>
            {localCart.length ? (
              <div className="cart-items">
                {localCart.map((item) => (
                  <article key={item.id} className="cart-item">
                    <div><strong>{item.name}</strong><small>{formatMoney(item.price)} c/u</small></div>
                    <div className="quantity-controls">
                      <button type="button" onClick={() => changeQuantity(item.id, item.quantity - 1)}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(item.id, item.quantity + 1)}>+</button>
                    </div>
                    <strong>{formatMoney(item.price * item.quantity)}</strong>
                    <input aria-label={`Nota ${item.name}`} placeholder="Nota (opcional)" value={item.note} onChange={(e) => updateItem(item.id, { note: e.target.value })} />
                  </article>
                ))}
              </div>
            ) : <p className="empty-state">Agrega productos a esta mesa.</p>}

            <label>Descuento<input type="number" min="0" max={subtotal} value={localDiscount} onChange={(e) => setLocalDiscount(e.target.value)} /></label>
            <div className="totals">
              <span>Subtotal <strong>{formatMoney(subtotal)}</strong></span>
              <span>Descuento <strong>− {formatMoney(safeDiscount)}</strong></span>
              <span className="grand-total">Total <strong>{formatMoney(subtotal - safeDiscount)}</strong></span>
            </div>

            {!checkoutOpen ? (
              <div className="table-actions">
                <button type="button" className="secondary-button" onClick={handleCancelTable}>Cancelar mesa</button>
                <button type="button" className="charge-button" disabled={!localCart.length} onClick={() => { setCheckoutOpen(true); setError('') }}>Cobrar</button>
              </div>
            ) : (
              <>
                <label className="delivery-row"><input type="checkbox" checked={isDelivery} onChange={(e) => { const on = e.target.checked; setIsDelivery(on); setDeliveryCost(on ? 2000 : 0) }} /> Es domicilio</label>
                {isDelivery && <label>Costo del domicilio<input type="number" min="0" value={deliveryCost} onChange={(e) => setDeliveryCost(e.target.value)} /></label>}
                <div className="totals"><span className="grand-total">Total a cobrar <strong>{formatMoney(total)}</strong></span></div>
                <fieldset className="payment-methods">
                  <legend>Método de pago</legend>
                  <label><input type="radio" name="table-payment" checked={paymentMethod === 'CASH'} onChange={() => setPaymentMethod('CASH')} /> Efectivo</label>
                  <label><input type="radio" name="table-payment" checked={paymentMethod === 'TRANSFER'} onChange={() => setPaymentMethod('TRANSFER')} /> Transferencia</label>
                  <label><input type="radio" name="table-payment" checked={paymentMethod === 'MIXED'} onChange={() => setPaymentMethod('MIXED')} /> Mixto</label>
                </fieldset>
                {paymentMethod === 'CASH' && (
                  <div className="payment-fields">
                    <label>Recibido<input type="number" min="0" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} /></label>
                    <p>Cambio: <strong>{formatMoney(cashChange)}</strong></p>
                  </div>
                )}
                {paymentMethod === 'MIXED' && (
                  <div className="form-grid">
                    <label>Efectivo restante<input type="number" value={mixedCashDue} readOnly /></label>
                    <label>Transferencia<input type="number" min="0" max={total} value={mixedTransfer} onChange={(e) => setMixedTransfer(e.target.value)} /></label>
                  </div>
                )}
                <div className="table-actions">
                  <button type="button" className="secondary-button" onClick={() => setCheckoutOpen(false)}>Volver</button>
                  <button type="button" className="charge-button" disabled={submitting} onClick={handleCharge}>{submitting ? 'Guardando…' : `Confirmar ${formatMoney(total)}`}</button>
                </div>
              </>
            )}
          </aside>
        </div>
        {receipt && <SaleReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
        {toast && <div className="cart-toast" role="status">✓ {toast}</div>}
      </section>
    )
  }

  return (
    <section className="tables-page">
      <p className="eyebrow">SALÓN</p>
      <h1>Mesas</h1>
      {message && <p className="notice success">{message}</p>}
      {error && <p className="notice error-message">{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Mesas</h2>
        <button type="button" className="secondary-button" onClick={handleAddNewTable} style={{ fontSize: '1.2rem', padding: '0 15px' }}>+</button>
      </div>

      <div className="table-grid">
        {configuredTables.map((label) => {
          const openTableMatch = tables.find(t => t.tableNumber === label || t.label === label)
          
          if (openTableMatch) {
            const tableTotal = tableSubtotal(openTableMatch.cart) - (openTableMatch.discount || 0)
            const itemCount = (openTableMatch.cart || []).reduce((n, i) => n + i.quantity, 0)
            const isEditing = editingTableId === openTableMatch.id
            return <article key={label} className="table-card table-card-open" style={{ borderLeft: '4px solid var(--accent)' }}><button type="button" className="table-card-main" onClick={() => { setSelectedTableId(openTableMatch.id); setMessage('') }}><strong>{openTableMatch.label}</strong><span>{itemCount} productos</span><span className="table-card-total">{formatMoney(tableTotal)}</span></button><label className="table-client-inline"><span>👤</span><input aria-label={`Cliente o identificación de ${openTableMatch.label}`} defaultValue={openTableMatch.note || ''} onBlur={(e) => updateTableCustomer(openTableMatch, e.target.value)} placeholder="Cliente o identificación" maxLength="80" /></label><div className="table-management-actions"><button type="button" className="icon-button" onClick={() => setEditingTableId(isEditing ? null : openTableMatch.id)} aria-label={isEditing ? 'Cerrar edición de productos' : 'Editar productos'} title={isEditing ? 'Cerrar edición' : 'Editar productos'}>{isEditing ? '×' : '☷'}</button><button type="button" className="icon-button" onClick={() => handleRenameTable(label, openTableMatch)} aria-label="Renombrar mesa" title="Renombrar mesa">✎</button><button type="button" className="icon-button" onClick={() => handleClearTable(openTableMatch)} aria-label="Vaciar mesa" title="Vaciar mesa">⌫</button><button type="button" className="icon-button danger-icon" onClick={() => handleRemoveTable(label, openTableMatch)} aria-label="Eliminar mesa" title="Eliminar mesa">🗑</button></div>{isEditing && <div className="table-order-editor"><p>Modifica cantidades, notas o elimina productos sin salir de Mesas.</p>{(openTableMatch.cart || []).map((item) => <article className="table-order-item" key={item.id}><div><strong>{item.name}</strong><small>{formatMoney(item.price)} c/u</small></div><div className="quantity-controls"><button type="button" onClick={() => changeOpenTableQuantity(openTableMatch, item.id, item.quantity - 1)} aria-label={`Restar ${item.name}`}>−</button><span>{item.quantity}</span><button type="button" onClick={() => changeOpenTableQuantity(openTableMatch, item.id, item.quantity + 1)} aria-label={`Sumar ${item.name}`}>+</button></div><button type="button" className="icon-button danger-icon" onClick={() => changeOpenTableQuantity(openTableMatch, item.id, 0)} aria-label={`Eliminar ${item.name}`} title={`Eliminar ${item.name}`}>🗑</button><input aria-label={`Nota para ${item.name}`} defaultValue={item.note || ''} onBlur={(e) => updateOpenTableNote(openTableMatch, item.id, e.target.value)} placeholder="Nota (opcional)" /></article>)}</div>}</article>
          }

          return (
            <article key={label} className="table-card table-card-open"><button type="button" className="table-card-main" onClick={() => handleOpenTable(label)} disabled={opening}>
              <strong>Mesa {label}</strong>
              <span>Libre</span>
              <span>-</span>
            </button><div className="table-management-actions"><button type="button" className="icon-button" onClick={() => handleRenameTable(label)} aria-label="Renombrar mesa" title="Renombrar mesa">✎</button><button type="button" className="icon-button danger-icon" onClick={() => handleRemoveTable(label)} aria-label="Eliminar mesa" title="Eliminar mesa">🗑</button></div></article>
          )
        })}
      </div>
      {receipt && <SaleReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
      {toast && <div className="cart-toast" role="status">✓ {toast}</div>}
    </section>
  )
}
