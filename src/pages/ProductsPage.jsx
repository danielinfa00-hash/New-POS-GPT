import { useEffect, useMemo, useState } from 'react'
import { removeCategory, removeProduct, saveCategory, saveProduct, subscribeToCategories, subscribeToProducts, toggleCategory, toggleProduct } from '../services/catalog/catalogService'

const emptyCategory = { name: '', active: true, order: 0 }
const emptyProduct = { name: '', description: '', price: '', cost: '', categoryId: '', available: true, trackStock: false, minStock: 5 }
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function getErrorMessage(error) {
  if (error.message === 'CATEGORY_HAS_PRODUCTS') return 'No puedes eliminar una categoría que todavía tiene productos.'
  if (error.message === 'PRODUCT_HAS_SALES') return 'Este producto ya tiene ventas. Desactívalo para conservar el historial.'
  if (error.code === 'permission-denied') return 'No tienes permisos para realizar esta acción.'
  if (error.code === 'storage/unauthorized') return 'No tienes permisos para subir esta imagen.'
  return 'No fue posible guardar los cambios. Intenta nuevamente.'
}

export default function ProductsPage() {
  const [tab, setTab] = useState('products')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [categoryForm, setCategoryForm] = useState(emptyCategory)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [imageFile, setImageFile] = useState(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handleError = () => setError('No fue posible cargar el catálogo. Revisa tu conexión y permisos.')
    const categoriesUnsubscribe = subscribeToCategories(setCategories, handleError)
    const productsUnsubscribe = subscribeToProducts(setProducts, handleError)
    return () => { categoriesUnsubscribe(); productsUnsubscribe() }
  }, [])

  const filteredProducts = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase())), [products, search])
  function notify(text) { setMessage(text); setError('') }
  function fail(err) { setError(getErrorMessage(err)); setMessage('') }

  async function submitCategory(event) {
    event.preventDefault(); setSaving(true)
    try { await saveCategory(categoryForm, categories.length); setCategoryForm(emptyCategory); notify('Categoría guardada correctamente.') } catch (err) { fail(err) } finally { setSaving(false) }
  }
  async function submitProduct(event) {
    event.preventDefault(); setSaving(true)
    try { await saveProduct(productForm, imageFile); setProductForm(emptyProduct); setImageFile(null); notify('Producto guardado correctamente.') } catch (err) { fail(err) } finally { setSaving(false) }
  }
  async function deleteCategory(category) {
    if (!window.confirm(`¿Eliminar la categoría “${category.name}”?`)) return
    try { await removeCategory(category.id); if (categoryForm.id === category.id) setCategoryForm(emptyCategory); notify('Categoría eliminada.') } catch (err) { fail(err) }
  }
  async function deleteProduct(product) {
    if (!window.confirm(`¿Eliminar el producto “${product.name}”?`)) return
    try { await removeProduct(product); if (productForm.id === product.id) setProductForm(emptyProduct); notify('Producto eliminado.') } catch (err) { fail(err) }
  }

  return (
    <section className="catalog-page">
      <p className="eyebrow">ADMINISTRACIÓN</p><h1>Catálogo</h1>
      <div className="tabs" role="tablist"><button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Productos</button><button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>Categorías</button></div>
      {message && <p className="notice success">{message}</p>}{error && <p className="notice error-message">{error}</p>}
      {tab === 'products' ? <>
        <form className="catalog-form" onSubmit={submitProduct}>
          <h2>{productForm.id ? 'Editar producto' : 'Nuevo producto'}</h2>
          <label>Nombre<input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /></label>
          <label>Descripción<input value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></label>
          <div className="form-grid"><label>Precio<input type="number" min="0" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required /></label><label>Costo<input type="number" min="0" value={productForm.cost} onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })} /></label></div>
          <label>Categoría<select value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })} required><option value="">Selecciona una categoría</option>{categories.filter((category) => category.active || category.id === productForm.categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>Imagen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} /><small className="field-hint">Opcional. Requiere habilitar Firebase Storage (plan Blaze) cuando decidas usar fotos.</small></label>
          <label className="checkbox-row"><input type="checkbox" checked={productForm.available} onChange={(e) => setProductForm({ ...productForm, available: e.target.checked })} /> Disponible para venta</label>
          <div className="form-grid">
            <label className="checkbox-row" style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={productForm.trackStock || false} onChange={(e) => setProductForm({ ...productForm, trackStock: e.target.checked })} /> Activar alertas de inventario en Dashboard</label>
            {productForm.trackStock && <label>Rango de alerta de stock bajo<input type="number" min="0" value={productForm.minStock || 0} onChange={(e) => setProductForm({ ...productForm, minStock: e.target.value })} /></label>}
          </div>
          <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar producto'}</button>{productForm.id && <button type="button" className="secondary-button" onClick={() => { setProductForm(emptyProduct); setImageFile(null) }}>Cancelar edición</button>}</div>
        </form>
        <label className="search-input">Buscar producto<input placeholder="Ej. Hamburguesa" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="catalog-list">{filteredProducts.map((product) => <article className="catalog-item" key={product.id}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="image-placeholder">M</span>}<div><strong>{product.name}</strong><small>{categories.find((category) => category.id === product.categoryId)?.name || 'Sin categoría'} · {money.format(product.price || 0)}</small><small className={product.available ? 'available' : 'unavailable'}>{product.available ? 'Disponible' : 'Desactivado'}</small>{product.trackStock && <small className={product.stock <= (product.minStock||0) ? 'unavailable' : ''}> · {product.stock <= 0 ? 'Sin stock' : product.stock <= (product.minStock||0) ? 'Stock bajo' : 'Stock Normal'} ({product.stock || 0} uds)</small>}</div><div className="item-actions"><button onClick={() => { setProductForm({ ...product, trackStock: product.trackStock || false, minStock: product.minStock || 5 }); setImageFile(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Editar</button><button onClick={() => toggleProduct(product).catch(fail)}>{product.available ? 'Desactivar' : 'Activar'}</button><button className="delete-button" onClick={() => deleteProduct(product)}>Eliminar</button></div></article>)}{!filteredProducts.length && <p className="empty-state">Aún no hay productos registrados.</p>}</div>
      </> : <>
        <form className="catalog-form compact" onSubmit={submitCategory}><h2>{categoryForm.id ? 'Editar categoría' : 'Nueva categoría'}</h2><label>Nombre<input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required /></label><label>Orden<input type="number" min="0" value={categoryForm.order} onChange={(e) => setCategoryForm({ ...categoryForm, order: e.target.value })} /></label><label className="checkbox-row"><input type="checkbox" checked={categoryForm.active} onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })} /> Activa</label><div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar categoría'}</button>{categoryForm.id && <button type="button" className="secondary-button" onClick={() => setCategoryForm(emptyCategory)}>Cancelar edición</button>}</div></form>
        <div className="catalog-list">{categories.map((category) => <article className="catalog-item category-item" key={category.id}><div><strong>{category.name}</strong><small>Orden: {category.order ?? 0} · {category.active ? 'Activa' : 'Desactivada'}</small></div><div className="item-actions"><button onClick={() => { setCategoryForm(category); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Editar</button><button onClick={() => toggleCategory(category).catch(fail)}>{category.active ? 'Desactivar' : 'Activar'}</button><button className="delete-button" onClick={() => deleteCategory(category)}>Eliminar</button></div></article>)}{!categories.length && <p className="empty-state">Crea primero las categorías de tu menú.</p>}</div>
      </>}
    </section>
  )
}
