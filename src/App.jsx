import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './layouts/AppShell'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PendingPage from './pages/PendingPage'
import ProductsPage from './pages/ProductsPage'
import SalesPage from './pages/SalesPage'
import UsersPage from './pages/UsersPage'
import CashRegisterPage from './pages/CashRegisterPage'
import SalesHistoryPage from './pages/SalesHistoryPage'
import ProtectedRoute from './routes/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<HomePage />} />
          <Route path="/ventas" element={<ProtectedRoute roles={['ADMIN', 'CAJERO']}><SalesPage /></ProtectedRoute>} />
          <Route path="/historial" element={<ProtectedRoute roles={['ADMIN', 'CAJERO']}><SalesHistoryPage /></ProtectedRoute>} />
          <Route path="/productos" element={<ProtectedRoute roles={['ADMIN']}><ProductsPage /></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute roles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
          <Route path="/caja" element={<ProtectedRoute roles={['ADMIN', 'CAJERO']}><CashRegisterPage /></ProtectedRoute>} />
          <Route path="/pedidos" element={<ProtectedRoute roles={['ADMIN', 'CAJERO', 'COCINA']}><PendingPage title="Pedidos" /></ProtectedRoute>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
