import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  fetchCurrentUser,
  logout as apiLogout,
} from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const hasToken = !!localStorage.getItem("uif_access_token");
    if (!hasToken) {
      setLoading(false);
      return;
    }
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  async function login(credentials) {
    await loginWithEmail(credentials);
    await loadUser();
  }

  async function register(payload) {
    await registerWithEmail(payload);
    await loadUser();
  }

  async function googleLogin(idToken) {
    await loginWithGoogle(idToken);
    await loadUser();
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  const value = { user, loading, login, register, googleLogin, logout, refresh: loadUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
