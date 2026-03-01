'use client';

import { useAuth } from '@clerk/nextjs';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import { ReactNode } from 'react';

export default function AuthGate({ children }: { children: ReactNode }) {
    const { isLoaded } = useAuth();

    if (!isLoaded) {
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
                <div className="bg-mesh"></div>
                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '1.5rem'
                }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        border: '3px solid rgba(139, 92, 246, 0.2)',
                        borderTop: '3px solid #8b5cf6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                        Initializing...
                    </p>
                </div>
                <style jsx>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </main>
        );
    }

    return (
        <>
            <SignedIn>
                {children}
            </SignedIn>
            <SignedOut>
                <RedirectToSignIn />
            </SignedOut>
        </>
    );
}
