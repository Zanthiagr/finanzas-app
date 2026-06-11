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

  const crearPerfilSiNoExiste = async (userId, nombre) => {
    const { data: existe } = await supabase
      .from('perfiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existe) {
      await supabase.from('perfiles').insert({
        id: userId,
        nombre: nombre || 'Usuario',
        moneda: 'COP',
        puntos_xp: 0,
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        crearPerfilSiNoExiste(session.user.id, session.user.user_metadata?.full_name);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await crearPerfilSiNoExiste(session.user.id, session.user.user_metadata?.full_name);
      } else {
        setUser(null);
        setPerfil(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
