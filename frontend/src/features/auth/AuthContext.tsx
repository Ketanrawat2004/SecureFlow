import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAppStore } from '@/stores/useAppStore';
import { AuthContext as AuthContextType, TokenResponse, User } from '@/types';

export interface AuthContextValue {
  user: User | null;
  authContext: AuthContextType | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  devLogin: (role: string, email?: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, orgName?: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permissionCode: string) => boolean;
  activeRole: string | null;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { activeOrgId, setActiveOrgId } = useAppStore();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('secureflow_access_token'));

  // Fetch /auth/me when token is present
  const { data: authData, isLoading } = useQuery<AuthContextType>({
    queryKey: ['auth', 'me', token, activeOrgId],
    queryFn: () => api.get<AuthContextType>('/auth/me'),
    enabled: !!token,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    if (authData?.active_organization_id && authData.active_organization_id !== activeOrgId) {
      setActiveOrgId(authData.active_organization_id);
    }
  }, [authData, activeOrgId, setActiveOrgId]);

  const login = async (email: string, password: string) => {
    const res = await api.post<TokenResponse>('/auth/login', { email, password });
    localStorage.setItem('secureflow_access_token', res.access_token);
    setToken(res.access_token);
    await queryClient.invalidateQueries({ queryKey: ['auth'] });
  };

  const devLogin = async (role: string, email?: string) => {
    const res = await api.post<TokenResponse>('/auth/dev-login', { role, email });
    localStorage.setItem('secureflow_access_token', res.access_token);
    setToken(res.access_token);
    await queryClient.clear();
    await queryClient.invalidateQueries({ queryKey: ['auth'] });
  };

  const register = async (email: string, password: string, fullName: string, orgName?: string) => {
    const res = await api.post<TokenResponse>('/auth/register', {
      email,
      password,
      full_name: fullName,
      organization_name: orgName,
    });
    localStorage.setItem('secureflow_access_token', res.access_token);
    setToken(res.access_token);
    await queryClient.invalidateQueries({ queryKey: ['auth'] });
  };

  const logout = () => {
    localStorage.removeItem('secureflow_access_token');
    setToken(null);
    queryClient.clear();
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!authData?.permissions) return false;
    return authData.permissions.includes(permissionCode);
  };

  const value: AuthContextValue = {
    user: authData?.user || null,
    authContext: authData || null,
    isAuthenticated: !!token && !!authData?.user,
    isLoading: !!token && isLoading,
    login,
    devLogin,
    register,
    logout,
    hasPermission,
    activeRole: authData?.active_role || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
