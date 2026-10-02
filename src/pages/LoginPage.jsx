import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { user, profile, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const location = useLocation()

  if (!loading && user && profile) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError(''); setSubmitting(true)
    try { await signIn(email, password) }
    catch (authError) {
      setError(authError.code === 'auth/invalid-credential' ? 'Correo o contraseña incorrectos.' : 'No fue posible iniciar sesión. Intenta nuevamente.')
    } finally { setSubmitting(false) }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <span className="brand-mark brand-large">M</span>
        <p className="eyebrow">ACCESO SEGURO</p><h1>Maryo's POS</h1>
        <p>Ingresa con tu cuenta autorizada.</p>
        <label>Correo electrónico<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={submitting}>{submitting ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </main>
  )
}
