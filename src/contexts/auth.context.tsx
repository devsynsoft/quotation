import React from 'react';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextType>({
  user: null,
  signIn: async () => {},
  signOut: async () => {},
});
