import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, firebaseConfigurationError } from '../services/firebase/config'

const AuthContext = createContext(null)

async function logSession(userId, action) {
  if (!db) return
  await setDoc(doc(db, 'auditLogs', `${userId}_${Date.now()}`), {
    userId, action, entity: 'session', entityId: userId, timestamp: serverTimestamp(), metadata: {}
  })
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState(null)

  useEffect(() => {
    if (!auth || !db) { setAccessError(firebaseConfigurationError); setLoading(false); return undefined }
    let mounted = true
    setPersistence(auth, browserLocalPersistence).catch(() => {})
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!mounted) return
      if (!nextUser) { setUser(null); setProfile(null); setAccessError(null); setLoading(false); return }
      setLoading(true)
      try {
        const profileSnapshot = await getDoc(doc(db, 'users', nextUser.uid))
        if (!profileSnapshot.exists() || !['ADMIN', 'CAJERO', 'COCINA'].includes(profileSnapshot.data().role)) {
          setUser(nextUser); setProfile(null); setAccessError('Tu cuenta no tiene un rol asignado. Contacta al administrador.'); return
        }
        setUser(nextUser)
        setProfile({ id: profileSnapshot.id, ...profileSnapshot.data() })
        setAccessError(null)
      } catch {
        setAccessError('No fue posible validar tus permisos. Intenta nuevamente.')
      } finally { if (mounted) setLoading(false) }
    })
    return () => { mounted = false; unsubscribe() }
  }, [])

  async function signIn(email, password) {
    if (!auth) throw new Error('FIREBASE_NOT_CONFIGURED')
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
    logSession(credential.user.uid, 'LOGIN').catch(() => {})
  }

  async function signOutUser() {
    if (user) logSession(user.uid, 'LOGOUT').catch(() => {})
    if (auth) await signOut(auth)
  }

  const value = useMemo(() => ({ user, profile, loading, accessError, signIn, signOutUser }), [user, profile, loading, accessError])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
