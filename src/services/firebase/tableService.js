import {
  addDoc, arrayUnion, collection, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where
} from 'firebase/firestore'
import { db } from './config'

function tablesCollection() {
  if (!db) return null
  return collection(db, 'tableOrders')
}

export function subscribeOpenTables(callback, onError) {
  const col = tablesCollection()
  if (!col) {
    callback([])
    return () => {}
  }
  const q = query(col, where('status', '==', 'OPEN'))
  return onSnapshot(q, (snapshot) => {
    const tables = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    tables.sort((a, b) => String(a.tableNumber).localeCompare(String(b.tableNumber), undefined, { numeric: true }))
    callback(tables)
  }, onError)
}

export function subscribeTablesConfig(callback) {
  if (!db) { callback(['1', '2', '3', '4']); return () => {} }
  return onSnapshot(doc(db, 'settings', 'tablesConfig'), (snap) => {
    if (snap.exists() && snap.data().list && snap.data().list.length > 0) {
      callback(snap.data().list)
    } else {
      callback(['1', '2', '3', '4'])
    }
  }, () => callback(['1', '2', '3', '4']))
}

export async function addTableConfig(label) {
  if (!db) throw new Error('Firebase no configurado')
  const ref = doc(db, 'settings', 'tablesConfig')
  await setDoc(ref, { list: arrayUnion(label) }, { merge: true })
}

export async function openTable({ tableNumber, userId, label }) {
  const col = tablesCollection()
  if (!col) throw new Error('Firebase no configurado')
  const normalized = String(tableNumber).trim()
  if (!normalized) throw new Error('Indica el número de mesa.')

  const existingSnap = await getDocs(query(col, where('status', '==', 'OPEN'), where('tableNumber', '==', normalized)))
  if (!existingSnap.empty) throw new Error(`La mesa ${normalized} ya está abierta.`)

  const docRef = await addDoc(col, {
    tableNumber: normalized,
    label: label?.trim() || `Mesa ${normalized}`,
    status: 'OPEN',
    userId,
    cart: [],
    discount: 0,
    note: '',
    openedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

export async function updateTableOrder(tableId, { cart, discount, note }) {
  if (!db) throw new Error('Firebase no configurado')
  const payload = {
    cart,
    discount: Math.max(Number(discount) || 0, 0),
    updatedAt: serverTimestamp()
  }
  if (note !== undefined) payload.note = note
  await updateDoc(doc(db, 'tableOrders', tableId), payload)
}

export async function renameTable({ currentLabel, newLabel, tableId }) {
  if (!db) throw new Error('Firebase no configurado')
  const cleanName = newLabel.trim()
  if (!cleanName) throw new Error('Escribe un nombre para la mesa.')
  const configRef = doc(db, 'settings', 'tablesConfig')
  await runTransaction(db, async (transaction) => {
    const config = await transaction.get(configRef)
    const list = config.exists() ? (config.data().list || []) : []
    if (list.some((item) => item !== currentLabel && item.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw new Error('Ya existe una mesa con ese nombre.')
    transaction.set(configRef, { list: list.map((item) => item === currentLabel ? cleanName : item) }, { merge: true })
    if (tableId) transaction.update(doc(db, 'tableOrders', tableId), { label: cleanName, updatedAt: serverTimestamp() })
  })
}

export async function removeTable({ label, tableId }) {
  if (!db) throw new Error('Firebase no configurado')
  const configRef = doc(db, 'settings', 'tablesConfig')
  await runTransaction(db, async (transaction) => {
    const config = await transaction.get(configRef)
    const list = config.exists() ? (config.data().list || []) : []
    transaction.set(configRef, { list: list.filter((item) => item !== label) }, { merge: true })
    if (tableId) transaction.update(doc(db, 'tableOrders', tableId), { status: 'CANCELLED', cart: [], discount: 0, note: '', updatedAt: serverTimestamp() })
  })
}

export async function cancelTableOrder(tableId) {
  if (!db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'tableOrders', tableId), {
    status: 'CANCELLED',
    cart: [],
    discount: 0,
    note: '',
    updatedAt: serverTimestamp()
  })
}

export async function markTableOrderPaid(tableId) {
  if (!db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'tableOrders', tableId), {
    status: 'PAID',
    cart: [],
    discount: 0,
    note: '',
    updatedAt: serverTimestamp()
  })
}
