import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const requiredKeys = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID']
const missingKeys = requiredKeys.filter((key) => !import.meta.env[`VITE_FIREBASE_${key}`])

export const firebaseIsConfigured = missingKeys.length === 0
export const firebaseConfigurationError = firebaseIsConfigured ? null : `Faltan variables Firebase: ${missingKeys.join(', ')}`

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const app = firebaseIsConfigured ? initializeApp(firebaseConfig) : null
export const secondaryApp = firebaseIsConfigured ? initializeApp(firebaseConfig, 'Secondary') : null

export const auth = app ? getAuth(app) : null
export const secondaryAuth = secondaryApp ? getAuth(secondaryApp) : null
export const db = app ? getFirestore(app) : null
export const storage = app ? getStorage(app) : null

if (db) {
  enableIndexedDbPersistence(db).catch(() => {
    // Persistence can be unavailable in private browsing or another active tab.
  })
}
