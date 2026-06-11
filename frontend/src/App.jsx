import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Movimientos from './pages/Movimientos';
import CierreSemanal from './pages/CierreSemanal';
import { Activos, Deudas, Metas } from './pages/Patrimonio';
import Mental from './pages/Mental';
import Academia from './pages/Academia';
import Coach from './pages/Coach';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-g-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-g-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p className="text-g-400 text-sm">Cargando...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/movimientos" element={<Movimientos />} />
              <Route path="/cierre"      element={<CierreSemanal />} />
              <Route path="/activos"     element={<Activos />} />
              <Route path="/deudas"      element={<Deudas />} />
              <Route path="/metas"       element={<Metas />} />
              <Route path="/mental"      element={<Mental />} />
              <Route path="/academia"    element={<Academia />} />
              <Route path="/coach"       element={<Coach />} />
              <Route path="*"            element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontSize: 13, borderRadius: 10 },
            success: { iconTheme: { primary: '#2D6B4A', secondary: '#EDFAF3' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
