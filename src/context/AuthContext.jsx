import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pulihkan sesi + langgar perubahan auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? { email: session.user.email, name: session.user.user_metadata?.name || 'Guru', id: session.user.id } : null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { email: session.user.email, name: session.user.user_metadata?.name || 'Guru', id: session.user.id } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials'
      ? 'E-mel atau kata laluan tidak sah.' : error.message);
    return { email: data.user.email, name: data.user.user_metadata?.name || 'Guru' };
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message.includes('already registered')
      ? 'Akaun dengan e-mel ini sudah wujud.' : error.message);
    if (!data.session) throw new Error('Sila sahkan e-mel anda sebelum log masuk.');
    return { email: data.user.email, name };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth mesti digunakan dalam AuthProvider');
  return ctx;
}
