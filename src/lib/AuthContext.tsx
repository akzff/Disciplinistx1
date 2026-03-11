'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

interface AuthContextType {
    user: { id: string } | null;
    loading: boolean;
    isGuest: boolean;
    signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUpWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    triggerHaptic: (pattern: 'light' | 'medium' | 'heavy') => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { isLoaded, userId, signOut: clerkSignOut } = useAuth();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<{ id: string } | null>(null);

    // Haptic feedback for mobile
    const triggerHaptic = useCallback((pattern: 'light' | 'medium' | 'heavy') => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            const patterns = {
                light: [10],
                medium: [50],
                heavy: [100, 50, 100]
            };
            navigator.vibrate(patterns[pattern]);
        }
    }, []);

    useEffect(() => {
        if (isLoaded) {
            setUser(userId ? { id: userId } : null);
            setLoading(false);
        }
    }, [isLoaded, userId]);

    const signInWithEmail = async (): Promise<{ success: boolean; error?: string }> => {
        try {
            // Clerk handles sign-in through their components
            // This is a placeholder for the actual Clerk sign-in flow
            triggerHaptic('medium');
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    };

    const signUpWithEmail = async (): Promise<{ success: boolean; error?: string }> => {
        try {
            // Clerk handles sign-up through their components
            // This is a placeholder for the actual Clerk sign-up flow
            triggerHaptic('heavy');
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    };

    const signOut = async (): Promise<void> => {
        try {
            await clerkSignOut();
            triggerHaptic('light');
        } catch (err: unknown) {
            console.error('Sign out error:', err);
        }
    };

    const isGuest = !userId;

    const value = {
        user,
        loading,
        isGuest,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        triggerHaptic,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
}
