import { useState, useEffect } from 'react'
import { fetchUsers, createUser, updateUserRole, toggleUserStatus } from '../services/firebase/userService'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Form state
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('CAJERO')

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch (err) {
      setError('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    setError(''); setSuccess('')
    setIsCreating(true)
    try {
      const newUser = await createUser({ name, email, password, role })
      setUsers(prev => [...prev, newUser].sort((a, b) => a.name.localeCompare(b.name)))
      setSuccess('Usuario creado exitosamente')
      setName(''); setEmail(''); setPassword(''); setRole('CAJERO')
    } catch (err) {
      setError(err.message || 'Error al crear usuario')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleToggleStatus(userId, currentStatus) {
    try {
      await toggleUserStatus(userId, !currentStatus)
      setUsers(users.map(u => u.id === userId ? { ...u, active: !currentStatus } : u))
    } catch (err) {
      setError('Error al cambiar estado del usuario')
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await updateUserRole(userId, newRole)
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err) {
      setError('Error al cambiar rol del usuario')
    }
  }

  if (loading) return <div className="screen-message">Cargando usuarios...</div>

  return (
    <section className="catalog-page">
      <p className="eyebrow">ADMINISTRACIÓN</p>
      <h1>Gestión de Usuarios</h1>
      
      {error && <p className="notice error-message">{error}</p>}
      {success && <p className="notice success">{success}</p>}

      <form className="catalog-form" onSubmit={handleCreateUser}>
        <h2>Crear nuevo usuario</h2>
        <div className="form-grid">
          <label>Nombre<input value={name} onChange={e => setName(e.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength="6" /></label>
          <label>Rol
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="CAJERO">Cajero</option>
              <option value="COCINA">Cocina</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={isCreating}>
            {isCreating ? 'Creando...' : 'Crear Usuario'}
          </button>
        </div>
      </form>

      <div className="catalog-list">
        {users.map(user => (
          <article key={user.id} className="catalog-item category-item">
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
              <small className={user.active ? 'available' : 'unavailable'}>
                {user.active ? 'Activo' : 'Inactivo'}
              </small>
            </div>
            <div className="item-actions">
              <select 
                value={user.role} 
                onChange={e => handleRoleChange(user.id, e.target.value)}
                style={{ width: 'auto', minHeight: '36px', padding: '0 10px', fontSize: '0.85rem' }}
              >
                <option value="CAJERO">Cajero</option>
                <option value="COCINA">Cocina</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button 
                className={user.active ? 'delete-button' : ''} 
                onClick={() => handleToggleStatus(user.id, user.active)}
              >
                {user.active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
