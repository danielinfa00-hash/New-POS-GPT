import { useEffect, useMemo, useState } from 'react'
import { subscribeToProducts, updateStock } from '../services/catalog/catalogService'

export default function InventoryPage() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  
  useEffect(() => {
    const unsub = subscribeToProducts(setProducts, () => setError('Error al cargar inventario'))
    return unsub
  }, [])

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [products, search])

  async function handleUpdateStock(productId, currentStock, change) {
    const newStock = Math.max(0, (Number(currentStock) || 0) + change)
    setSavingId(productId)
    try {
      await updateStock(productId, newStock)
    } catch(e) {
      setError('No se pudo actualizar el stock')
    } finally {
      setSavingId(null)
    }
  }

  async function handleSetStock(productId, value) {
    const newStock = Math.max(0, Number(value) || 0)
    setSavingId(productId)
    try {
      await updateStock(productId, newStock)
    } catch(e) {
      setError('No se pudo actualizar el stock')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="inventory-page">
      <p className="eyebrow">ADMINISTRACIÓN</p>
      <h1>Inventario</h1>
      {error && <p className="notice error-message">{error}</p>}
      
      <label className="search-input">Buscar producto<input placeholder="Ej. Hamburguesa" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      
      <div className="catalog-list">
        {filteredProducts.map(product => (
          <article className="catalog-item" key={product.id}>
             {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="image-placeholder">M</span>}
             <div>
                <strong>{product.name}</strong>
                <small>Stock actual: {product.stock || 0}</small>
                {product.trackStock && <small className={product.stock <= (product.minStock||0) ? 'unavailable' : 'available'}>Alerta: {product.stock <= 0 ? 'Sin stock' : product.stock <= (product.minStock||0) ? 'Bajo' : 'Normal'} (Mín: {product.minStock || 0})</small>}
             </div>
             <div className="item-actions" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button disabled={savingId === product.id} onClick={() => handleUpdateStock(product.id, product.stock, -1)}>−1</button>
                <input type="number" style={{ width: '60px', minHeight: '36px', textAlign: 'center' }} value={product.stock || 0} onChange={(e) => handleSetStock(product.id, e.target.value)} />
                <button disabled={savingId === product.id} onClick={() => handleUpdateStock(product.id, product.stock, 1)}>+1</button>
             </div>
          </article>
        ))}
        {!filteredProducts.length && <p className="empty-state">No se encontraron productos.</p>}
      </div>
    </section>
  )
}
