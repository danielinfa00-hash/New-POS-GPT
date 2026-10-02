import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ roles, children }) {
  const { user, profile, loading, accessError } = useAuth()
  const location = useLocation()

  if (loading) return <main className="screen-message">Validando sesión…</main>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (accessError || !profile) return <AccessDenied message={accessError || 'No tienes permisos para ingresar.'} />
  if (roles && !roles.includes(profile.role)) return <main className="screen-message error-message">No tienes permisos para acceder a esta sección.</main>
  return children || <Outlet />
}

function AccessDenied({ message }) {
  const { signOutUser } = useAuth()
  const navigate = useNavigate()
  async function leave() { await signOutUser(); navigate('/login', { replace: true }) }
  return <main className="screen-message error-message"><p>{message}</p><button className="secondary-button" onClick={leave}>Volver al acceso</button></main>
}
