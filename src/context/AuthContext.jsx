import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase.js";
const AuthContext = createContext(null);
const userView = (user) =>
  user
    ? {
        email: user.email,
        name: user.user_metadata?.name || "Guru",
        id: user.id,
      }
    : null;
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [authError, setAuthError] = useState("");
  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (active) {
          setUser(userView(session?.user));
          setAuthError(
            error ? "Sesi tidak dapat dipulihkan. Sila log masuk semula." : "",
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setAuthError("Sesi tidak dapat dimuatkan. Sila log masuk semula.");
          setLoading(false);
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(userView(session?.user));
        setLoading(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const login = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error)
      throw new Error(
        error.message === "Invalid login credentials"
          ? "E-mel atau kata laluan tidak sah."
          : error.message === "Email not confirmed"
            ? "Sila sahkan e-mel sebelum log masuk."
            : "Log masuk gagal. Semak sambungan atau cuba lagi sebentar.",
      );
    setUser(userView(data.user));
    setAuthError("");
    return userView(data.user);
  }, []);
  const signup = useCallback(async ({ name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    if (error)
      throw new Error(
        "Pendaftaran tidak dapat diproses. Semak maklumat atau cuba log masuk jika sudah berdaftar.",
      );
    return { requiresConfirmation: !data.session };
  }, []);
  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError("Log keluar gagal. Sila cuba semula.");
      return;
    }
    setUser(null);
    setAuthError("");
  }, []);
  return (
    <AuthContext.Provider
      value={{ user, loading, authError, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth mesti digunakan dalam AuthProvider");
  return context;
};
