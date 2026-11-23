import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../api/client';
import { AuthResponse, User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (roll_number: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('securevote_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('securevote_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('securevote_token');
      if (storedToken) {
        try {
          const res = await apiClient.get<User>('/api/auth/me');
          setUser(res.data);
          localStorage.setItem('securevote_user', JSON.stringify(res.data));
        } catch {
          // Token invalid or expired
          localStorage.removeItem('securevote_token');
          localStorage.removeItem('securevote_user');
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (roll_number: string, password: string): Promise<User> => {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', {
      roll_number,
      password,
    });

    const { access_token, user: loggedUser } = response.data;
    localStorage.setItem('securevote_token', access_token);
    localStorage.setItem('securevote_user', JSON.stringify(loggedUser));
    setToken(access_token);
    setUser(loggedUser);
    return loggedUser;
  };

  const logout = () => {
    localStorage.removeItem('securevote_token');
    localStorage.removeItem('securevote_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await apiClient.get<User>('/api/auth/me');
      setUser(res.data);
      localStorage.setItem('securevote_user', JSON.stringify(res.data));
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
