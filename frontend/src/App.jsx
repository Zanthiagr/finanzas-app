import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout, { COACH_HABILITADO } from './components/layout/Layout';
import Onboarding from './components/Onboarding';
import RecordatorioNocturnoOnboarding from './components/RecordatorioNocturnoOnboarding';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Icon from './utils/icons';

// Code-splitting: Dashboard y Auth cargan de inmediato (lo primero que ve
// el usuario), todo lo demás se descarga bajo demanda al navegar a esa
// ruta. Reduce el bundle inicial considerablemente (~950kB antes).
const Movimientos   = lazy(() => import('./pages/Movimientos'));
const CierreSemanal = lazy(() => import('./pages/CierreSemanal'));
const Activos    = lazy(() => import('./pages/Patrimonio').then(m => ({ default: m.Activos })));
const Deudas     = lazy(() => import('./pages/Patrimonio').then(m => ({ default: m.Deudas })));
const Tarjetas   = lazy(() => import('./pages/Patrimonio').then(m => ({ default: m.Tarjetas })));
const Metas      = lazy(() => import('./pages/Patrimonio').then(m => ({ default: m.Metas })));
const Prestamos  = lazy(() => import('./pages/Patrimonio').then(m => ({ default: m.Prestamos })));
const Presupuestos = lazy(() => import('./pages/Presupuestos'));
const Mental     = lazy(() => import('./pages/Mental'));
const Academia   = lazy(() => import('./pages/Academia'));
const Coach      = lazy(() => import('./pages/Coach'));
const Reporte    = lazy(() => import('./pages/Reporte'));
const Perfil     = lazy(() => import('./pages/Perfil'));
const Calendario = lazy(() => import('./pages/Calendario'));
const Calculadora = lazy(() => import('./pages/Calculadora'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 flex-col gap-3">
      <Icon name="loader" className="w-6 h-6 animate-spin text-g-400"/>
      <p className="text-sm text-g-400">Cargando...</p>
    </div>
  );
}

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
  const { user, perfil, esCuentaNueva, refrescarPerfil } = useAuth();
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);
  const [mostrarRecordatorio, setMostrarRecordatorio] = useState(false);

  useEffect(() => {
    // esCuentaNueva solo es true la primera vez que el perfil se crea en la
    // BD — a diferencia de un flag en localStorage, no depende del
    // navegador/dispositivo, así que alguien iniciando sesión en una cuenta
    // EXISTENTE (aunque sea desde un navegador nuevo) nunca ve el onboarding.
    if (user && esCuentaNueva) setMostrarOnboarding(true);
  }, [user, esCuentaNueva]);

  useEffect(() => {
    // recordatorio_prompt_visto=false cubre DOS poblaciones con el mismo
    // mecanismo: cuentas nuevas (siempre arrancan en false) Y cuentas que
    // ya existían antes de esta actualización (la migración las dejó en
    // false a todas). Cualquiera de las dos ve este aviso la primera vez
    // que entra después de esto — nunca más, responda lo que responda.
    // No se muestra mientras el Onboarding esté abierto, para no apilar
    // dos pantallas completas al mismo tiempo.
    if (user && perfil && !perfil.recordatorio_prompt_visto && !mostrarOnboarding) {
      setMostrarRecordatorio(true);
    }
  }, [user, perfil, mostrarOnboarding]);

  const completarOnboarding = () => {
    setMostrarOnboarding(false);
    // El Dashboard ya cargó el saldo ANTES de que se agregara el capital
    // inicial en el onboarding (es una capa flotante encima, no una
    // navegación real, así que su useEffect de carga no se vuelve a
    // disparar solo). Recargar es la forma simple y confiable de que
    // "Dinero disponible" y todo lo demás reflejen el capital recién
    // agregado sin tener que enchufar un sistema de refresco global.
    window.location.reload();
  };

  const cerrarRecordatorio = async () => {
    setMostrarRecordatorio(false);
    // Refresca el perfil en el contexto para que recordatorio_prompt_visto
    // quede en true de inmediato en memoria — así, aunque algo más adelante
    // dispare de nuevo este efecto, la condición ya no se vuelve a cumplir.
    await refrescarPerfil();
  };

  return (
    <>
      {mostrarOnboarding && user && <Onboarding onComplete={completarOnboarding}/>}
      {!mostrarOnboarding && mostrarRecordatorio && user && (
        <RecordatorioNocturnoOnboarding userId={user.id} onDone={cerrarRecordatorio}/>
      )}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace/> : <AuthPage/>}/>
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Suspense fallback={<PageLoader/>}>
                <Routes>
                  <Route path="/"             element={<Dashboard/>}/>
                  <Route path="/movimientos"  element={<Movimientos/>}/>
                  <Route path="/cierre"       element={<CierreSemanal/>}/>
                  <Route path="/presupuestos" element={<Presupuestos/>}/>
                  <Route path="/activos"      element={<Activos/>}/>
                  <Route path="/deudas"       element={<Deudas/>}/>
                  <Route path="/tarjetas"     element={<Tarjetas/>}/>
                  <Route path="/metas"        element={<Metas/>}/>
                  <Route path="/prestamos"    element={<Prestamos/>}/>
                  <Route path="/mental"       element={<Mental/>}/>
                  <Route path="/academia"     element={<Academia/>}/>
                  <Route path="/coach"        element={COACH_HABILITADO ? <Coach/> : <Navigate to="/" replace/>}/>
                  <Route path="/reporte"      element={<Reporte/>}/>
                  <Route path="/perfil"       element={<Perfil/>}/>
                  <Route path="/calendario"   element={<Calendario/>}/>
                  <Route path="/calculadora"  element={<Calculadora/>}/>
                  <Route path="*"             element={<Navigate to="/" replace/>}/>
                </Routes>
              </Suspense>
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
            duration: 3000,
            success: { duration: 2200, iconTheme: { primary: '#16A34A', secondary: '#E9F9EF' } },
            error:   { duration: 3500 },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
