import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const links = [
  ['/', 'Inicio'],
  ['/ventas', 'Ventas'],
  ['/pedidos', 'Pedidos'],
  ['/caja', 'Caja'],
  ['/productos', 'Productos']
]

export default function AppShell() {
  const { profile, signOutUser } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  async function handleLogout() {
    await signOutUser()
    navigate('/login', { replace: true })
  }

  const navLinks = [
    ['/', 'Inicio'],
    ['/ventas', 'Ventas'],
    ['/historial', 'Historial'],
    ['/pedidos', 'Pedidos'],
    ['/caja', 'Caja'],
    ['/productos', 'Productos']
  ]

  if (profile?.role === 'ADMIN') {
    navLinks.push(['/usuarios', 'Usuarios'])
  }

  return (
    <div className="app-shell">
      {!isOnline && <div style={{ background: 'var(--error-bg)', color: 'var(--error-text)', textAlign: 'center', padding: '5px', fontSize: '0.8rem', fontWeight: 'bold' }}>Estás sin conexión. Los cambios se sincronizarán cuando vuelva el internet.</div>}
      <header className="app-header">
        <span className="brand-mark">M</span><strong>Maryo's POS</strong>
        <span className="user-role">{profile?.role}</span>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Cambiar tema">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button className="logout-button" onClick={handleLogout}>Salir</button>
      </header>
      <main><Outlet /></main>
      <nav className="bottom-nav" aria-label="Navegación principal">
        {navLinks.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
      </nav>
    </div>
  )
}
