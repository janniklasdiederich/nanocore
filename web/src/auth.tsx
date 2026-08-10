import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type Org, type User } from "./api";

type AuthState = {
  loading: boolean;
  setupComplete: boolean;
  user: User | null;
  org: Org | null;
  refresh: () => Promise<void>;
  setSession: (user: User, org: Org | null) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await api.setupStatus();
      setSetupComplete(status.setupComplete);
      if (!status.setupComplete) {
        setUser(null);
        setOrg(null);
        return;
      }
      const me = await api.me();
      setUser(me.user);
      setOrg(me.org);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSession = useCallback((u: User, o: Org | null) => {
    setUser(u);
    setOrg(o);
    setSetupComplete(true);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      setupComplete,
      user,
      org,
      refresh,
      setSession,
      clearSession,
    }),
    [loading, setupComplete, user, org, refresh, setSession, clearSession],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
