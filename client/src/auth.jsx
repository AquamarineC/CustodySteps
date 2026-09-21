import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api.me();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signup = async (email, password) => {
    const { user: u } = await api.signup(email, password);
    setUser(u);
    return u;
  };

  const login = async (email, password) => {
    const { user: u } = await api.login(email, password);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const setUserPlan = (plan) => {
    setUser((prev) => (prev ? { ...prev, plan } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, refresh, setUserPlan }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
