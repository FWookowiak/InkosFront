
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axiosInstance from '../lib/axios';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('Attempting login to localhost:8000/token');
      
      // Make real API call to your authentication endpoint
      const response = await axiosInstance.post('/api/token/', {
        username: email, // FastAPI typically expects 'username' field
        password: password,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        // Transform data to form-encoded format for OAuth2 compliance
        transformRequest: [(data) => {
          const params = new URLSearchParams();
          params.append('username', data.username);
          params.append('password', data.password);
          return params;
        }],
      });

      console.log('Login response:', response.data);
      console.log(response.data)

  
      const access_token = response.data.access
      const refresh_token = response.data.refresh
      console.log('Access Token:', access_token);
      console.log('Refresh Token:', refresh_token);
      // Store tokens
      localStorage.setItem('access_token', access_token);
      if (refresh_token) {
        localStorage.setItem('refresh_token', refresh_token);
      }

      // Create user object (you might need to adjust this based on your API response)
      const userData = {
        id: '1', // You might get this from the token or make another API call
        email: email,
        name: email.split('@')[0], // You might get this from your API
      };

      localStorage.setItem('user_data', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Login error:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
        throw new Error(error.response.data?.detail || 'Login failed');
      } else if (error.request) {
        console.error('No response received:', error.request);
        throw new Error('No response from server. Please check if the API is running.');
      } else {
        console.error('Request error:', error.message);
        throw new Error('Login request failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
