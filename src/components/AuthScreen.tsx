'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function AuthScreen() {
    const { signInWithEmail, signUpWithEmail, sendMagicLink } = useAuth();

    const [mode, setMode] = useState<'login' | 'signup' | 'magic'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setInfo('');
        setLoading(true);

        let errMsg: string | null = null;

        if (mode === 'magic') {
            errMsg = await sendMagicLink(email);
            if (!errMsg) setInfo('Magic link sent — check your email inbox.');
        } else if (mode === 'signup') {
            errMsg = await signUpWithEmail(email, password);
            if (!errMsg) setInfo('Account created. Check your email to confirm, then log in.');
        } else {
            errMsg = await signInWithEmail(email, password);
        }

        if (errMsg) setError(errMsg);
        setLoading(false);
    };

    return (
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div className="bg-mesh"></div>

            <div style={{
                width: '100%',
                maxWidth: '400px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '24px',
                padding: '2.5rem',
                backdropFilter: 'blur(30px)',
                boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
                position: 'relative',
                zIndex: 1
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.5))' }}>⚡</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', letterSpacing: '0.15em', color: 'white' }}>DISCIPLINIST</h1>
                    <p style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '4px', letterSpacing: '0.1em' }}>DISCIPLINE ENGINE v1.0</p>
                </div>

                {/* Mode Tabs */}
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '100px', padding: '4px', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {[
                        { id: 'login', label: 'LOG IN' },
                        { id: 'signup', label: 'SIGN UP' },
                        { id: 'magic', label: '✉ MAGIC' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { setMode(tab.id as typeof mode); setError(''); setInfo(''); }}
                            style={{
                                flex: 1,
                                padding: '8px 4px',
                                borderRadius: '100px',
                                border: 'none',
                                background: mode === tab.id ? 'rgba(139,92,246,0.3)' : 'transparent',
                                color: mode === tab.id ? '#d8b4fe' : 'rgba(255,255,255,0.35)',
                                fontSize: '0.65rem',
                                fontWeight: '900',
                                cursor: 'pointer',
                                transition: 'all 0.25s',
                                letterSpacing: '0.05em',
                                boxShadow: mode === tab.id ? 'inset 0 0 20px rgba(139,92,246,0.15)' : 'none',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Email field */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', opacity: 0.4, marginBottom: '8px', letterSpacing: '0.1em' }}>EMAIL ADDRESS</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '14px',
                                color: 'white',
                                fontSize: '0.9rem',
                                fontFamily: 'inherit',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                boxSizing: 'border-box',
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* Password field (not for magic link) */}
                    {mode !== 'magic' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', opacity: 0.4, marginBottom: '8px', letterSpacing: '0.1em' }}>PASSWORD</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '14px',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'}
                                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                            />
                        </div>
                    )}

                    {/* Error / Info messages */}
                    {error && (
                        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '0.78rem' }}>
                            {error}
                        </div>
                    )}
                    {info && (
                        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', fontSize: '0.78rem' }}>
                            {info}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '16px',
                            background: loading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                            border: 'none',
                            borderRadius: '14px',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: '900',
                            letterSpacing: '0.1em',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: loading ? 'none' : '0 8px 25px rgba(139,92,246,0.35)',
                            transition: 'all 0.3s',
                            textTransform: 'uppercase',
                            marginTop: '0.5rem'
                        }}
                    >
                        {loading ? '...' : mode === 'login' ? 'ENTER THE SYSTEM' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SEND MAGIC LINK'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.65rem', opacity: 0.25, letterSpacing: '0.05em' }}>
                    Your data is stored securely and linked to your account.
                </p>
            </div>
        </main>
    );
}
