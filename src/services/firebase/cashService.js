import { collection, doc, getDocs, addDoc, updateDoc, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

export async function getCurrentSession() {
  if (!db) return null
  const q = query(
    collection(db, 'cashSessions'),
    where('status', '==', 'OPEN'),
    orderBy('openedAt', 'desc'),
    limit(1)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const docData = snapshot.docs[0]
  return { id: docData.id, ...docData.data() }
}

export async function openCashRegister(userId, initialAmount) {
  if (!db) return
  const session = {
    openedBy: userId,
    openedAt: serverTimestamp(),
    status: 'OPEN',
    initialAmount,
    withdrawals: [],
    incomes: []
  }
  await addDoc(collection(db, 'cashSessions'), session)
}

export async function closeCashRegister(sessionId, expectedCash, actualCash, difference, userId) {
  if (!db) return
  await updateDoc(doc(db, 'cashSessions', sessionId), {
    status: 'CLOSED',
    closedBy: userId,
    closedAt: serverTimestamp(),
    expectedCash,
    actualCash,
    difference
  })
}

export async function addTransaction(sessionId, type, amount, reason, userId) {
  if (!db) return
  const sessionDoc = doc(db, 'cashSessions', sessionId)
  
  // To avoid race conditions, normally we'd use runTransaction or arrayUnion
  // Since it's a simple POS, we can fetch, then update, or better, we can store transactions in a subcollection
  // But let's keep it simple with arrayUnion or fetching.
  // Using a subcollection for transactions is safer:
  await addDoc(collection(sessionDoc, 'transactions'), {
    type, // 'WITHDRAWAL' or 'INCOME'
    amount,
    reason,
    userId,
    timestamp: serverTimestamp()
  })
}

export async function getTransactions(sessionId) {
  if (!db) return []
  const q = query(collection(db, 'cashSessions', sessionId, 'transactions'), orderBy('timestamp', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
