import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOutUser: () => Promise<void>;
  authError: string | null;
  authErrorCode: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const configured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here'
);

const connectionKey = 'flowtask_cloud_connected';

function formatAuthError(error: unknown): { message: string; code: string | null } {
  if (!error) return { message: 'An unknown error occurred.', code: null };
  const errCode = (error as { code?: string })?.code || null;
  const rawMsg = error instanceof Error ? error.message : String(error);

  switch (errCode) {
    case 'auth/unauthorized-domain': {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      return {
        code: errCode,
        message: `The domain "${currentHost}" is not authorized for OAuth in your Firebase project. In the Firebase Console, navigate to Authentication → Settings → Authorized domains and add "${currentHost}".`,
      };
    }
    case 'auth/popup-blocked':
      return {
        code: errCode,
        message: 'The sign-in popup was blocked by your browser. Please allow popups for this site, or use full-page redirect.',
      };
    case 'auth/popup-closed-by-user':
      return {
        code: errCode,
        message: 'Sign-in window was closed before completion.',
      };
    case 'auth/cancelled-popup-request':
      return {
        code: errCode,
        message: 'A previous sign-in request was cancelled.',
      };
    case 'auth/operation-not-allowed':
      return {
        code: errCode,
        message: 'Google Sign-In is not enabled for this Firebase project. In the Firebase Console, go to Authentication → Sign-in method and enable Google.',
      };
    case 'auth/network-request-failed':
      return {
        code: errCode,
        message: 'Network offline or connection failed. Please check your internet connection.',
      };
    case 'auth/user-disabled':
      return {
        code: errCode,
        message: 'This user account has been disabled. Please contact support.',
      };
    default:
      return {
        code: errCode,
        message: rawMsg.replace(/^Firebase:\s*/, '').replace(/Error\s*\([^)]+\):?\s*/, '') || 'Could not connect your account.',
      };
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [enabled, setEnabled] = useState(() => configured && localStorage.getItem(connectionKey) === 'true');
  const [loading, setLoading] = useState(enabled);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;

    // Check redirect result and auth state
    void Promise.all([import('firebase/auth'), import('../lib/firebase')])
      .then(([sdk, config]) => {
        const authInstance = config.auth;
        if (cancelled || !authInstance) return;

        // Process potential redirect sign-in completion
        sdk.getRedirectResult(authInstance)
          .then((redirectResult) => {
            if (!cancelled && redirectResult?.user) {
              localStorage.setItem(connectionKey, 'true');
              setEnabled(true);
              setUser(redirectResult.user);
            }
          })
          .catch((err) => {
            if (!cancelled && (err as { code?: string })?.code !== 'auth/popup-closed-by-user') {
              const formatted = formatAuthError(err);
              setAuthError(formatted.message);
              setAuthErrorCode(formatted.code);
            }
          });

        if (!enabled) return;

        stop = sdk.onAuthStateChanged(authInstance, (current) => {
          setUser(current);
          setLoading(false);
        });
      })
      .catch((error) => {
        if (!cancelled) {
          const formatted = formatAuthError(error);
          setAuthError(formatted.message);
          setAuthErrorCode(formatted.code);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled]);

  async function signInWithGoogle() {
    if (!configured) {
      setAuthError('Cloud sync is not configured for this installation.');
      setAuthErrorCode('not-configured');
      return;
    }
    setLoading(true);
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      const [sdk, config] = await Promise.all([import('firebase/auth'), import('../lib/firebase')]);
      const authInstance = config.auth;
      const provider = config.googleProvider;
      if (!authInstance || !provider) throw new Error('Cloud connection is unavailable.');
      await authInstance.authStateReady();
      let account: User;

      if (authInstance.currentUser?.isAnonymous) {
        const guest = authInstance.currentUser;
        try {
          account = (await sdk.linkWithPopup(guest, provider)).user;
        } catch (error) {
          if ((error as { code?: string }).code !== 'auth/credential-already-in-use') throw error;
          localStorage.setItem('flowtask_previous_guest_workspace', guest.uid);
          account = (await sdk.signInWithPopup(authInstance, provider)).user;
        }
      } else {
        account = (await sdk.signInWithPopup(authInstance, provider)).user;
      }

      localStorage.setItem(connectionKey, 'true');
      setEnabled(true);
      setUser(account);
    } catch (error) {
      if ((error as { code?: string })?.code === 'auth/popup-closed-by-user') {
        return;
      }
      const formatted = formatAuthError(error);
      setAuthError(formatted.message);
      setAuthErrorCode(formatted.code);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogleRedirect() {
    if (!configured) {
      setAuthError('Cloud sync is not configured for this installation.');
      setAuthErrorCode('not-configured');
      return;
    }
    setLoading(true);
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      const [sdk, config] = await Promise.all([import('firebase/auth'), import('../lib/firebase')]);
      const authInstance = config.auth;
      const provider = config.googleProvider;
      if (!authInstance || !provider) throw new Error('Cloud connection is unavailable.');
      await sdk.signInWithRedirect(authInstance, provider);
    } catch (error) {
      const formatted = formatAuthError(error);
      setAuthError(formatted.message);
      setAuthErrorCode(formatted.code);
      setLoading(false);
    }
  }

  async function signOutUser() {
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      const [sdk, config] = await Promise.all([import('firebase/auth'), import('../lib/firebase')]);
      const authInstance = config.auth;
      if (authInstance) await sdk.signOut(authInstance);
      localStorage.removeItem(connectionKey);
      setEnabled(false);
      setUser(null);
    } catch (error) {
      const formatted = formatAuthError(error);
      setAuthError(formatted.message);
      setAuthErrorCode(formatted.code);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAnonymous: Boolean(user?.isAnonymous),
        isConfigured: configured,
        signInWithGoogle,
        signInWithGoogleRedirect,
        signInAsGuest: async () => {},
        signOutUser,
        authError,
        authErrorCode,
        clearAuthError: () => {
          setAuthError(null);
          setAuthErrorCode(null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
