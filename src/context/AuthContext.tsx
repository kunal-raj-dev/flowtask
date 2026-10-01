import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  type User,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOutUser: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const firebaseAuth = auth;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        // Auto sign-in anonymously for zero-friction capture and offline-first cloud sync
        try {
          const anonCred = await signInAnonymously(firebaseAuth);
          setUser(anonCred.user);
        } catch (err: unknown) {
          console.warn('Anonymous sign-in not available or failed:', err);
          setUser(null);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setAuthError('Firebase is not configured yet. Check your environment variables.');
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      if (user && user.isAnonymous) {
        // If current session is guest, link it to the Google account so all tasks stay!
        try {
          const result = await linkWithPopup(user, googleProvider);
          setUser(result.user);
          return;
        } catch (linkError: unknown) {
          // If the credential is already in use by an existing account, fall back to standard sign in
          const firebaseErr = linkError as { code?: string; message?: string };
          if (firebaseErr?.code === 'auth/credential-already-in-use') {
            const result = await signInWithPopup(auth, googleProvider);
            setUser(result.user);
            return;
          }
          throw linkError;
        }
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        setUser(result.user);
      }
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      console.error('Google sign-in error:', err);
      if (firebaseErr?.code !== 'auth/popup-closed-by-user') {
        setAuthError(firebaseErr?.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const signInAsGuest = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    setLoading(true);
    setAuthError(null);
    try {
      const cred = await signInAnonymously(auth);
      setUser(cred.user);
    } catch (err: unknown) {
      const firebaseErr = err as { message?: string };
      setAuthError(firebaseErr?.message || 'Failed to sign in as guest');
    } finally {
      setLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    setLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
      // After sign-out, sign in anonymously again so user can continue seamlessly
      const anonCred = await signInAnonymously(auth);
      setUser(anonCred.user);
    } catch (err: unknown) {
      const firebaseErr = err as { message?: string };
      setAuthError(firebaseErr?.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAnonymous: user?.isAnonymous ?? true,
        isConfigured: isFirebaseConfigured,
        signInWithGoogle,
        signInAsGuest,
        signOutUser,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
