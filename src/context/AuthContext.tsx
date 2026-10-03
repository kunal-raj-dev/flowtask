import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
export interface AuthContextType {
  user: User | null; loading: boolean; isAnonymous: boolean; isConfigured: boolean;
  signInWithGoogle: () => Promise<void>; signInAsGuest: () => Promise<void>; signOutUser: () => Promise<void>;
  authError: string | null; clearAuthError: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const configured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here');
const connectionKey = 'flowtask_cloud_connected';
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [enabled, setEnabled] = useState(() => configured && localStorage.getItem(connectionKey) === 'true');
  const [loading, setLoading] = useState(enabled);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void Promise.all([import('firebase/auth'), import('../lib/firebase')]).then(([sdk, config]) => {
      if (cancelled || !config.auth) return;
      stop = sdk.onAuthStateChanged(config.auth!, current => { setUser(current); setLoading(false); });
    }).catch(error => { if (!cancelled) { setAuthError(String(error.message || error)); setLoading(false); } });
    return () => { cancelled = true; stop?.(); };
  }, [enabled]);
  async function signInWithGoogle() {
    if (!configured) { setAuthError('Cloud sync is not configured for this installation.'); return; }
    setLoading(true); setAuthError(null);
    try {
      const [sdk, config] = await Promise.all([import('firebase/auth'), import('../lib/firebase')]);
      if (!config.auth || !config.googleProvider) throw new Error('Cloud connection is unavailable.');
      await config.auth!.authStateReady();
      let account: User;
      if (config.auth!.currentUser?.isAnonymous) {
        const guest = config.auth!.currentUser;
        try { account = (await sdk.linkWithPopup(guest, config.googleProvider!)).user; }
        catch (error) {
          if ((error as { code?: string }).code !== 'auth/credential-already-in-use') throw error;
          localStorage.setItem('flowtask_previous_guest_workspace', guest.uid);
          account = (await sdk.signInWithPopup(config.auth!, config.googleProvider!)).user;
        }
      } else account = (await sdk.signInWithPopup(config.auth!, config.googleProvider!)).user;
      localStorage.setItem(connectionKey, 'true'); setEnabled(true); setUser(account);
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Could not connect your account.'); }
    finally { setLoading(false); }
  }
  async function signOutUser() {
    setAuthError(null);
    try {
      const [sdk, config] = await Promise.all([import('firebase/auth'), import('../lib/firebase')]);
      if (config.auth) await sdk.signOut(config.auth!);
      localStorage.removeItem(connectionKey); setEnabled(false); setUser(null);
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Could not disconnect.'); }
  }
  return <AuthContext.Provider value={{ user, loading, isAnonymous: user?.isAnonymous ?? true, isConfigured: configured, signInWithGoogle, signInAsGuest: async () => {}, signOutUser, authError, clearAuthError: () => setAuthError(null) }}>{children}</AuthContext.Provider>;
};
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within an AuthProvider'); return context; }
