import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]     = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = async (userId) => {
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setPerfil(data);
  };

  const crearPerfilSiNoExiste = async (userId, nombre, email) => {
    const { data: existe } = await supabase
      .from('perfiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existe) {
      await supabase.from('perfiles').insert({
        id: userId,
        nombre: nombre || 'Usuario',
        email: email || null,
        moneda: 'COP',
        puntos_xp: 0,
        notif_cierre: true,
        notif_diario: false,
      });
      await supabase.from('habitos').insert([
        { usuario_id: userId, nombre: 'Leer 10 min sobre finanzas', momento: 'manana', puntos: 20 },
        { usuario_id: userId, nombre: 'Registrar gastos del día', momento: 'noche', puntos: 15 },
        { usuario_id: userId, nombre: 'Visualizar mi yo futuro', momento: 'noche', puntos: 20 },
        { usuario_id: userId, nombre: 'Afirmación en voz alta', momento: 'cualquier_momento', puntos: 10 },
      ]);
    }
    await cargarPerfil(userId);
  };

  useEffect(() => {
    const timeoutDeSeguridad = setTimeout(() => setLoading(false), 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        // TOKEN_REFRESHED y USER_UPDATED no requieren recargar el perfil completo
        // — son renovaciones silenciosas del token, no cambios de sesión real.
        // Procesarlos igual causaba congelamiento de la UI al volver del background.
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) setUser(session.user);
          setLoading(false);
          clearTimeout(timeoutDeSeguridad);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          // Solo crear/cargar perfil en eventos de login real, no en refresh de token
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            await crearPerfilSiNoExiste(
              session.user.id,
              session.user.user_metadata?.full_name,
              session.user.email
            );
          }
        } else {
          setUser(null);
          setPerfil(null);
        }
      } catch (err) {
        console.warn('Error procesando sesión:', err);
      } finally {
        setLoading(false);
        clearTimeout(timeoutDeSeguridad);
      }
    });

    // Listener para cuando la app vuelve al primer plano (visibilitychange).
    // iOS congela las tabs en background — cuando vuelven, el token puede
    // estar expirado pero onAuthStateChange no siempre dispara solo.
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUser(session.user);
            if (!perfil) await cargarPerfil(session.user.id);
          } else {
            setUser(null);
            setPerfil(null);
          }
        } catch (err) {
          console.warn('Error al reactivar sesión:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutDeSeguridad);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const loginConGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const loginConEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const registrarConEmail = async (nombre, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: nombre } },
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPerfil(null);
  };

  return (
    <AuthContext.Provider value={{ user, perfil, loading, loginConGoogle, loginConEmail, registrarConEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
