import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Onboarding from './components/Onboarding';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Movimientos from './pages/Movimientos';
import CierreSemanal from './pages/CierreSemanal';
import { Activos, Deudas, Metas } from './pages/Patrimonio';
import Presupuestos from './pages/Presupuestos';
import Mental from './pages/Mental';
import Academia from './pages/Academia';
import Coach from './pages/Coach';
import Reporte from './pages/Reporte';
import Perfil from './pages/Perfil';
import NuevoMovimiento from './pages/NuevoMovimiento';
import Calculadora from './pages/Calculadora';
import Calendario from './pages/Calendario';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  // Si ya tenemos usuario, mostrar contenido inmediatamente aunque loading sea true.
  // Esto evita que al renovar el token (cada hora) la app muestre el spinner
  // y congele la interfaz — el usuario ya está autenticado, no hay razón para bloquearlo.
  if (user) return children;

  // Solo bloqueamos con el spinner en la carga completamente inicial
  // (cuando no sabemos aún si hay sesión o no).
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-g-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-g-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p className="text-g-400 text-sm">Un momento...</p>
      </div>
    </div>
  );

  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);

  useEffect(() => {
    if (user) {
      const yaVisto = localStorage.getItem(`onboarding_${user.id}`);
      if (!yaVisto) setMostrarOnboarding(true);
    }
  }, [user]);

  const completarOnboarding = () => {
    if (user) localStorage.setItem(`onboarding_${user.id}`, 'true');
    setMostrarOnboarding(false);
  };

  return (
    <>
      {mostrarOnboarding && user && <Onboarding onComplete={completarOnboarding}/>}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace/> : <AuthPage/>}/>
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/"             element={<Dashboard/>}/>
                <Route path="/movimientos"       element={<Movimientos/>}/>
                <Route path="/movimientos/nuevo" element={<NuevoMovimiento/>}/>
                <Route path="/cierre"       element={<CierreSemanal/>}/>
                <Route path="/presupuestos" element={<Presupuestos/>}/>
                <Route path="/activos"      element={<Activos/>}/>
                <Route path="/deudas"       element={<Deudas/>}/>
                <Route path="/metas"        element={<Metas/>}/>
                <Route path="/mental"       element={<Mental/>}/>
                <Route path="/academia"     element={<Academia/>}/>
                <Route path="/coach"        element={<Coach/>}/>
                <Route path="/reporte"      element={<Reporte/>}/>
                <Route path="/perfil"       element={<Perfil/>}/>
                <Route path="/calendario"   element={<Calendario/>}/>
                <Route path="/calculadora"  element={<Calculadora/>}/>
                <Route path="*"             element={<Navigate to="/" replace/>}/>
              </Routes>
            </Layout>
          </PrivateRoute>
        }/>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes/>
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
