'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isGuest: boolean;
    signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUpWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    signInAsGuest: () => Promise<{ success: boolean; error?: string }>;
    linkGuestAccount: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    triggerHaptic: (pattern: 'light' | 'medium' | 'heavy') => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Haptic feedback for mobile
    const triggerHaptic = (pattern: 'light' | 'medium' | 'heavy') => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            const patterns = {
                light: [10],
                medium: [50],
                heavy: [100, 50, 100]
            };
            navigator.vibrate(patterns[pattern]);
        }
    };

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

    const signInWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                // Sanitize errors for mobile
                if (error.message.includes('Invalid login credentials')) {
                    return { success: false, error: 'Invalid credentials. Check your email and password.' };
                } else if (error.message.includes('Email not confirmed')) {
                    return { success: false, error: 'Please verify your email before signing in.' };
                } else if (error.message.includes('network') || error.message.includes('fetch')) {
                    return { success: false, error: 'Network error. Check your connection.' };
                } else {
                    return { success: false, error: error.message };
                }
            }
            triggerHaptic('medium');
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    };

    const signUpWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                if (error.message.includes('User already registered')) {
                    return { success: false, error: 'This email is already registered. Try signing in.' };
                } else if (error.message.includes('weak_password')) {
                    return { success: false, error: 'Password must be at least 6 characters.' };
                } else {
                    return { success: false, error: error.message };
                }
            }
            
            // Auto sign-in immediately for seamless experience
            const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
            if (loginError) {
                return { success: false, error: 'Account created but sign-in failed. Please try signing in manually.' };
            }
            
            triggerHaptic('heavy');
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    };

    const signInAsGuest = async (): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.auth.signInAnonymously();
            if (error) {
                return { success: false, error: error.message };
            }
            triggerHaptic('light');
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    };

    const linkGuestAccount = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.auth.updateUser({ email, password });
            if (error) {
                if (error.message.includes('User already registered')) {
                    return { success: false, error: 'This email is already in use by another account.' };
                } else {
                    return { success: false, error: error.message };
                }
            }
            triggerHaptic('heavy');
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    };

    const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`
            });
            if (error) {
                if (error.message.includes('User not found')) {
                    return { success: false, error: 'No account found with this email address.' };
                } else {
                    return { success: false, error: error.message };
                }
            }
            triggerHaptic('light');
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    };

    const signOut = async () => {
        triggerHaptic('light');
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            loading, 
            isGuest, 
            signInWithEmail, 
            signUpWithEmail, 
            signOut, 
            signInAsGuest, 
            linkGuestAccount, 
            resetPassword,
            triggerHaptic
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside AuthProvider');
    return ctx;
}
