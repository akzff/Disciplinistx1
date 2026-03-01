'use client';

import { useAuth } from '@/lib/AuthContext';
import AuthScreen from './AuthScreen';
import { ReactNode } from 'react';

export default function AuthGate({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <main style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '1.5rem',
                background: '#050505',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background */}
                <div className="bg-mesh" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: 0.3
                }} />
                
                {/* Content */}
                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    textAlign: 'center'
                }}>
                    <div style={{
                        fontSize: '3rem',
                        marginBottom: '1.5rem',
                        filter: 'drop-shadow(0 0 30px rgba(139,92,246,0.6))',
                        animation: 'pulse 2s infinite'
                    }}>⚡</div>
                    <h1 style={{
                        fontSize: '1.2rem',
                        fontWeight: '900',
                        letterSpacing: '0.2em',
                        color: 'white',
                        marginBottom: '0.5rem',
                        background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>DISCIPLINIST</h1>
                    <p style={{
                        fontSize: '0.8rem',
                        opacity: 0.4,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        animation: 'fadeInOut 2s infinite'
                    }}>INITIALIZING SYSTEMS...</p>
                </div>

                <style jsx>{`
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.05); opacity: 0.8; }
                    }
                    @keyframes fadeInOut {
                        0%, 100% { opacity: 0.4; }
                        50% { opacity: 0.8; }
                    }
                `}</style>
            </main>
        );
    }

    if (!user) {
        return <AuthScreen />;
    }

    return <>{children}</>;
}
