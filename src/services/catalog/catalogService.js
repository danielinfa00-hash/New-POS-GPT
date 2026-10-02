import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc, where
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase/config'

function categoriesCollection() {
  return db ? collection(db, 'categories') : null
}

function productsCollection() {
  return db ? collection(db, 'products') : null
}

export function subscribeToCategories(callback, onError) {
  const col = categoriesCollection()
  if (!col) {
    callback([])
    return () => {}
  }
  return onSnapshot(query(col, orderBy('order')), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export function subscribeToProducts(callback, onError) {
  const col = productsCollection()
  if (!col) {
    callback([])
    return () => {}
  }
  return onSnapshot(query(col, orderBy('name')), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export async function saveCategory(category, currentCount) {
  if (!db) throw new Error('Firebase no configurado')
  const payload = { name: category.name.trim(), active: category.active, order: Number(category.order), updatedAt: serverTimestamp() }
  if (category.id) return updateDoc(doc(db, 'categories', category.id), payload)
  return addDoc(categoriesCollection(), { ...payload, order: currentCount, createdAt: serverTimestamp() })
}

export async function removeCategory(categoryId) {
  if (!db) throw new Error('Firebase no configurado')
  const linkedProducts = await getDocs(query(productsCollection(), where('categoryId', '==', categoryId)))
  if (!linkedProducts.empty) throw new Error('CATEGORY_HAS_PRODUCTS')
  return deleteDoc(doc(db, 'categories', categoryId))
}

export async function toggleCategory(category) {
  if (!db) throw new Error('Firebase no configurado')
  return updateDoc(doc(db, 'categories', category.id), { active: !category.active, updatedAt: serverTimestamp() })
}

async function uploadProductImage(file) {
  if (!file) return null
  const path = `products/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
  const imageRef = ref(storage, path)
  await uploadBytes(imageRef, file, { contentType: file.type })
  return { imageUrl: await getDownloadURL(imageRef), imagePath: path }
}

export async function saveProduct(product, imageFile) {
  if (!db) throw new Error('Firebase no configurado')
  const uploadedImage = await uploadProductImage(imageFile)
  const payload = {
    name: product.name.trim(), description: product.description.trim(), price: Number(product.price),
    cost: Number(product.cost || 0), categoryId: product.categoryId, available: product.available,
    trackStock: Boolean(product.trackStock),
    minStock: Number(product.minStock || 0),
    updatedAt: serverTimestamp(), ...(uploadedImage || {})
  }
  if (product.id) return updateDoc(doc(db, 'products', product.id), payload)
  return addDoc(productsCollection(), { ...payload, imageUrl: payload.imageUrl || '', imagePath: payload.imagePath || '', salesCount: 0, stock: Number(product.stock || 0), createdAt: serverTimestamp() })
}

export async function updateStock(productId, newStock) {
  if (!db) throw new Error('Firebase no configurado')
  return updateDoc(doc(db, 'products', productId), { stock: newStock, updatedAt: serverTimestamp() })
}

export async function toggleProduct(product) {
  if (!db) throw new Error('Firebase no configurado')
  return updateDoc(doc(db, 'products', product.id), { available: !product.available, updatedAt: serverTimestamp() })
}

export async function removeProduct(product) {
  if (!db) throw new Error('Firebase no configurado')
  if ((product.salesCount || 0) > 0) throw new Error('PRODUCT_HAS_SALES')
  await deleteDoc(doc(db, 'products', product.id))
  if (product.imagePath) deleteObject(ref(storage, product.imagePath)).catch(() => {})
}
