import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { isFirebaseConfigured, firebaseReady, getFirebaseAuth } from './firebase';

interface AuthContextValue {
  user: any;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  skipAuth: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    firebaseReady.then(async () => {
      const auth = getFirebaseAuth();
      if (!auth) {
        setIsLoading(false);
        return;
      }
      const { onAuthStateChanged } = await import('firebase/auth');
      unsubscribe = onAuthStateChanged(auth, (firebaseUser: any) => {
        setUser(firebaseUser);
        setIsLoading(false);
      });
    }).catch(() => {
      setIsLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured. Please add Firebase credentials.');
      throw new Error('Firebase not configured');
    }
    setError(null);
    setIsLoading(true);
    try {
      await firebaseReady;
      const auth = getFirebaseAuth();
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Invalid email or password');
      } else if (code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email');
      } else {
        setError('Sign in failed. Please try again');
      }
      setIsLoading(false);
      throw err;
    }
  };

  const signOutUser = async () => {
    setSkipped(false);
    try {
      if (isFirebaseConfigured) {
        await firebaseReady;
        const auth = getFirebaseAuth();
        if (auth) {
          const { signOut: fbSignOut } = await import('firebase/auth');
          await fbSignOut(auth);
        }
      }
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const skipAuth = () => {
    setSkipped(true);
  };

  const clearError = () => setError(null);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user || skipped,
    isConfigured: isFirebaseConfigured,
    signIn,
    signOut: signOutUser,
    skipAuth,
    error,
    clearError,
  }), [user, isLoading, error, skipped]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
