'use client';

import { useAuth } from '@/lib/AuthContext';
import AuthScreen from './AuthScreen';
import { ReactNode } from 'react';

export default function AuthGate({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                <div className="bg-mesh"></div>
                <div style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.5))' }}>⚡</div>
                <p style={{ fontSize: '0.75rem', opacity: 0.4, letterSpacing: '0.15em', fontWeight: '700' }}>INITIALIZING SYSTEM...</p>
            </main>
        );
    }

    if (!user) {
        return <AuthScreen />;
    }

    return <>{children}</>;
}
