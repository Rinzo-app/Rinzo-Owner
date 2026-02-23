import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { fetch } from 'expo/fetch';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { isFirebaseConfigured, firebaseReady, getFirebaseAuth } from './firebase';
import { queryClient } from './query-client';
import { BACKEND_URL } from './config';
import { request } from './http-client';

export type UserStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED';

interface AuthContextValue {
  user: any;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  userStatus: UserStatus | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auto-register with the unified backend on first login.
 * 409 = already registered — safe to ignore.
 */
async function registerWithBackend(idToken: string, user: any) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/auth/register/shop`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: user.displayName || user.email?.split('@')[0] || '',
          email: user.email || '',
          shopName: user.displayName || 'My Shop',
        }),
      },
    );
    if (!res.ok && res.status !== 409) {
      console.warn('Backend shop registration:', res.status);
    }
  } catch (err) {
    // Non-fatal — user may already be registered
    console.warn('Backend shop registration failed (non-fatal):', err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const appState = useRef(AppState.currentState);

  // ── Fetch user status from backend ─────────────────────
  const fetchUserStatus = useCallback(async () => {
    try {
      const data = await request<{ status?: string }>('GET', '/api/auth/me');
      const status = (data.status as UserStatus) || 'ACTIVE';
      setUserStatus(status);
      return status;
    } catch (err) {
      console.warn('Failed to fetch user status:', err);
      return null;
    }
  }, []);

  /** Public refresh — re-fetches status from backend */
  const refreshProfile = useCallback(async () => {
    await fetchUserStatus();
  }, [fetchUserStatus]);

  // ── Bootstrap: listen to Firebase auth state ───────────
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
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
        setUser(firebaseUser);
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          // Fetch user status from backend after auth
          await fetchUserStatus();
        } else {
          setToken(null);
          setUserStatus(null);
        }
        setIsLoading(false);
      });
    }).catch(() => {
      setIsLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchUserStatus]);

  // ── AppState listener: refetch status on foreground ────
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active' &&
        user
      ) {
        fetchUserStatus();
      }
      appState.current = nextState;
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user, fetchUserStatus]);

  // ── Email / password sign-in ────────────────────────────
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
      if (!auth) {
        throw new Error('Firebase authentication is not initialized. Please check your Firebase configuration.');
      }
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // Obtain the ID token immediately and register with backend
      const idToken = await cred.user.getIdToken();
      setToken(idToken);
      await registerWithBackend(idToken, cred.user);
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

  // ── Sign out ───────────────────────────────────────────
  const signOutUser = async () => {
    try {
      if (isFirebaseConfigured) {
        await firebaseReady;
        const auth = getFirebaseAuth();
        if (auth) {
          await fbSignOut(auth);
        }
      }
      setUser(null);
      setToken(null);
      setUserStatus(null);
      queryClient.clear();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const clearError = () => setError(null);

  const value = useMemo(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    isConfigured: isFirebaseConfigured,
    userStatus,
    signIn,
    signOut: signOutUser,
    refreshProfile,
    error,
    clearError,
  }), [user, token, isLoading, error, userStatus, refreshProfile]);

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
