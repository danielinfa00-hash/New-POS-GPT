import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, getDocs, setDoc, updateDoc, query, orderBy } from 'firebase/firestore'
import { db, secondaryAuth } from './config'

export async function fetchUsers() {
  if (!db) return []
  const q = query(collection(db, 'users'), orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function createUser({ name, email, password, role }) {
  if (!secondaryAuth || !db) throw new Error('Firebase no configurado')
  
  // Create user in secondary auth to prevent logging out the admin
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  const uid = userCredential.user.uid
  
  // Sign out secondary auth immediately
  await signOut(secondaryAuth)

  // Save profile in firestore
  const userData = {
    name,
    email,
    role,
    active: true,
    createdAt: new Date().toISOString()
  }
  
  await setDoc(doc(db, 'users', uid), userData)
  return { id: uid, ...userData }
}

export async function updateUserRole(userId, role) {
  if (!db) return
  await updateDoc(doc(db, 'users', userId), { role })
}

export async function toggleUserStatus(userId, active) {
  if (!db) return
  await updateDoc(doc(db, 'users', userId), { active })
}
