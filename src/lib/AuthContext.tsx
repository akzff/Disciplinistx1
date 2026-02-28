'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithEmail: (email: string, password: string) => Promise<string | null>;
    signUpWithEmail: (email: string, password: string) => Promise<string | null>;
    signOut: () => Promise<void>;
    sendMagicLink: (email: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithEmail = async (email: string, password: string): Promise<string | null> => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? error.message : null;
    };

    const signUpWithEmail = async (email: string, password: string): Promise<string | null> => {
        const { error } = await supabase.auth.signUp({ email, password });
        return error ? error.message : null;
    };

    const sendMagicLink = async (email: string): Promise<string | null> => {
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: true }
        });
        return error ? error.message : null;
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, signOut, sendMagicLink }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside AuthProvider');
    return ctx;
}
