'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isGuest: boolean;
    signInWithEmail: (email: string, password: string) => Promise<string | null>;
    signUpWithEmail: (email: string, password: string) => Promise<string | null>;
    signOut: () => Promise<void>;
    signInAsGuest: () => Promise<string | null>;
    linkGuestAccount: (email: string, password: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error && error.message?.includes('third-party cookies')) {
                console.warn('Third-party cookies disabled; falling back to anonymous session');
                signInAsGuest().catch(() => setLoading(false));
            } else {
                setUser(session?.user ?? null);
                setLoading(false);
            }
        }).catch(err => {
            console.error('Session init error:', err);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const isGuest = user?.is_anonymous === true;

    const signInWithEmail = async (email: string, password: string): Promise<string | null> => {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            return error ? error.message : null;
        } catch (err: unknown) {
            return err instanceof Error ? err.message : String(err);
        }
    };

    const signUpWithEmail = async (email: string, password: string): Promise<string | null> => {
        try {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) return error.message;
            // Auto sign-in immediately — bypasses email confirmation requirement
            const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
            return loginError ? loginError.message : null;
        } catch (err: unknown) {
            return err instanceof Error ? err.message : String(err);
        }
    };

    // Anonymous session — Supabase creates a real user row (is_anonymous: true)
    const signInAsGuest = async (): Promise<string | null> => {
        try {
            const { error } = await supabase.auth.signInAnonymously();
            return error ? error.message : null;
        } catch (err: unknown) {
            return err instanceof Error ? err.message : String(err);
        }
    };

    // Upgrade guest to full account — Supabase preserves all existing data automatically
    const linkGuestAccount = async (email: string, password: string): Promise<string | null> => {
        try {
            const { error } = await supabase.auth.updateUser({ email, password });
            return error ? error.message : null;
        } catch (err: unknown) {
            return err instanceof Error ? err.message : String(err);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, loading, isGuest, signInWithEmail, signUpWithEmail, signOut, signInAsGuest, linkGuestAccount }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside AuthProvider');
    return ctx;
}
