import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc, where
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase/config'

const categoriesCollection = collection(db, 'categories')
const productsCollection = collection(db, 'products')

export function subscribeToCategories(callback, onError) {
  return onSnapshot(query(categoriesCollection, orderBy('order')), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export function subscribeToProducts(callback, onError) {
  return onSnapshot(query(productsCollection, orderBy('name')), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export async function saveCategory(category, currentCount) {
  const payload = { name: category.name.trim(), active: category.active, order: Number(category.order), updatedAt: serverTimestamp() }
  if (category.id) return updateDoc(doc(db, 'categories', category.id), payload)
  return addDoc(categoriesCollection, { ...payload, order: currentCount, createdAt: serverTimestamp() })
}

export async function removeCategory(categoryId) {
  const linkedProducts = await getDocs(query(productsCollection, where('categoryId', '==', categoryId)))
  if (!linkedProducts.empty) throw new Error('CATEGORY_HAS_PRODUCTS')
  return deleteDoc(doc(db, 'categories', categoryId))
}

export async function toggleCategory(category) {
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
  const uploadedImage = await uploadProductImage(imageFile)
  const payload = {
    name: product.name.trim(), description: product.description.trim(), price: Number(product.price),
    cost: Number(product.cost || 0), categoryId: product.categoryId, available: product.available,
    updatedAt: serverTimestamp(), ...(uploadedImage || {})
  }
  if (product.id) return updateDoc(doc(db, 'products', product.id), payload)
  return addDoc(productsCollection, { ...payload, imageUrl: payload.imageUrl || '', imagePath: payload.imagePath || '', salesCount: 0, createdAt: serverTimestamp() })
}

export async function toggleProduct(product) {
  return updateDoc(doc(db, 'products', product.id), { available: !product.available, updatedAt: serverTimestamp() })
}

export async function removeProduct(product) {
  if ((product.salesCount || 0) > 0) throw new Error('PRODUCT_HAS_SALES')
  await deleteDoc(doc(db, 'products', product.id))
  if (product.imagePath) deleteObject(ref(storage, product.imagePath)).catch(() => {})
}
