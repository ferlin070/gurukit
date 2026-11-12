import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext.jsx";
import { getTeachingProfile, saveTeachingProfile } from "../lib/api.js";
import { DEFAULT_CONTEXT } from "../data/mrsm.js";
import { validateContext } from "../lib/tool-validation.js";
const TeachingContext = createContext(null);
export function TeachingProvider({ children }) {
  const { user } = useAuth();
  const [context, setContext] = useState({ ...DEFAULT_CONTEXT }),
    [fullName, setFullName] = useState(""),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setReady(false);
    setContext({ ...DEFAULT_CONTEXT });
    setFullName("");
    setError("");
    if (!user) {
      setContext({ ...DEFAULT_CONTEXT });
      setFullName("");
      setReady(true);
      return;
    }
    try {
      const profile = await getTeachingProfile();
      if (current !== generation.current) return;
      setContext(validateContext(profile.teaching_context || {}));
      setFullName(profile.full_name);
    } catch (e) {
      if (current !== generation.current) return;
      setError(e.message);
      setContext({ ...DEFAULT_CONTEXT });
    } finally {
      if (current === generation.current) setReady(true);
    }
  }, [user?.id]);
  useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, [load]);
  const save = async (name, next) => {
    const validated = validateContext(next);
    if (!name.trim() || name.trim().length > 100)
      throw new Error("Nama mestilah antara 1 hingga 100 aksara.");
    const current = generation.current;
    await saveTeachingProfile(name.trim(), validated);
    if (current !== generation.current) return;
    setContext(validated);
    setFullName(name.trim());
    setError("");
  };
  return (
    <TeachingContext.Provider
      value={{ context, fullName, ready, error, reload: load, save }}
    >
      {children}
    </TeachingContext.Provider>
  );
}
export const useTeaching = () => useContext(TeachingContext);
