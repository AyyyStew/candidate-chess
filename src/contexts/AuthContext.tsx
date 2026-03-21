import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getMe, logout as apiLogout, type ApiUser } from "../services/api";

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<ApiUser>) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  function updateUser(patch: Partial<ApiUser>) {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
