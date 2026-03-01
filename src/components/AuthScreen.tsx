'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function AuthScreen() {
    const { signInWithEmail, signUpWithEmail, signInAsGuest, resetPassword, triggerHaptic } = useAuth();

    const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [guestLoading, setGuestLoading] = useState(false);

    // Dynamic background animation
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            let result;

            if (mode === 'signup') {
                result = await signUpWithEmail(email, password);
                if (result.success) {
                    setSuccess('Account created successfully. Welcome to the Discipline Engine.');
                }
            } else if (mode === 'forgot') {
                result = await resetPassword(email);
                if (result.success) {
                    setSuccess('Password reset link sent to your email.');
                    setMode('login');
                }
            } else {
                result = await signInWithEmail(email, password);
                if (result.success) {
                    setSuccess('Authentication successful. Initializing systems...');
                }
            }

            if (!result.success && result.error) {
                setError(result.error);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleGuest = async () => {
        setError('');
        setGuestLoading(true);
        try {
            const result = await signInAsGuest();
            if (!result.success && result.error) {
                setError(result.error);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setGuestLoading(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '18px 20px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        color: 'white',
        fontSize: '0.95rem',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxSizing: 'border-box',
        backdropFilter: 'blur(10px)',
    };

    const buttonStyle: React.CSSProperties = {
        width: '100%',
        padding: '18px',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #c084fc 100%)',
        border: 'none',
        borderRadius: '16px',
        color: 'white',
        fontSize: '0.9rem',
        fontWeight: '900',
        letterSpacing: '0.15em',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        textTransform: 'uppercase',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
    };

    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            position: 'relative',
            overflow: 'hidden',
            background: '#050505'
        }}>
            {/* Dynamic Background */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `
                    radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, 
                    rgba(139, 92, 246, 0.15) 0%, 
                    transparent 50%),
                    radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 80% 70%, rgba(168, 85, 247, 0.1) 0%, transparent 50%),
                    linear-gradient(180deg, #050505 0%, #0a0a0a 100%)
                `,
                zIndex: 0
            }} />

            {/* Mesh Grid */}
            <div className="bg-mesh" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
                opacity: 0.3
            }} />

            {/* Auth Container */}
            <div style={{
                width: '100%',
                maxWidth: '440px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '32px',
                padding: '3rem',
                backdropFilter: 'blur(40px)',
                boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02)',
                position: 'relative',
                zIndex: 2,
                transition: 'all 0.3s ease'
            }}>
                {/* Logo Section */}
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{
                        fontSize: '3rem',
                        marginBottom: '1rem',
                        filter: 'drop-shadow(0 0 30px rgba(139,92,246,0.6))',
                        animation: 'pulse 2s infinite'
                    }}>⚡</div>
                    <h1 style={{
                        fontSize: '1.8rem',
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
                        fontSize: '0.7rem',
                        opacity: 0.4,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase'
                    }}>Discipline Engine v2.0</p>
                </div>

                {/* Mode Tabs */}
                {mode !== 'forgot' && (
                    <div style={{
                        display: 'flex',
                        background: 'rgba(0,0,0,0.4)',
                        borderRadius: '100px',
                        padding: '6px',
                        marginBottom: '2.5rem',
                        border: '1px solid rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(20px)'
                    }}>
                        {[
                            { id: 'login', label: 'ACCESS' },
                            { id: 'signup', label: 'ENLIST' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setMode(tab.id as typeof mode);
                                    setError('');
                                    setSuccess('');
                                    triggerHaptic('light');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px 8px',
                                    borderRadius: '100px',
                                    border: 'none',
                                    background: mode === tab.id ? 'rgba(139,92,246,0.4)' : 'transparent',
                                    color: mode === tab.id ? '#d8b4fe' : 'rgba(255,255,255,0.3)',
                                    fontSize: '0.7rem',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    letterSpacing: '0.1em',
                                    boxShadow: mode === tab.id ? 'inset 0 0 20px rgba(139,92,246,0.2)' : 'none',
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Email */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.7rem',
                            fontWeight: '900',
                            opacity: 0.4,
                            marginBottom: '12px',
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase'
                        }}>
                            {mode === 'forgot' ? 'EMAIL ADDRESS' : 'AUTHENTICATION EMAIL'}
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="agent@disciplinist.com"
                            style={inputStyle}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)';
                                e.currentTarget.style.background = 'rgba(139,92,246,0.05)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                            }}
                        />
                    </div>

                    {/* Password (not for forgot mode) */}
                    {mode !== 'forgot' && (
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '0.7rem',
                                fontWeight: '900',
                                opacity: 0.4,
                                marginBottom: '12px',
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase'
                            }}>
                                ACCESS CODE
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    style={{ ...inputStyle, paddingRight: '56px' }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)';
                                        e.currentTarget.style.background = 'rgba(139,92,246,0.05)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPassword(v => !v);
                                        triggerHaptic('light');
                                    }}
                                    style={{
                                        position: 'absolute',
                                        right: '18px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'rgba(255,255,255,0.3)',
                                        fontSize: '1.2rem',
                                        padding: '8px',
                                        lineHeight: 1,
                                        transition: 'all 0.2s',
                                    }}
                                    title={showPassword ? 'Hide access code' : 'Show access code'}
                                >
                                    {showPassword ? '🙈' : '👁'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error / Success Messages */}
                    {error && (
                        <div style={{
                            padding: '16px 20px',
                            borderRadius: '16px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#fca5a5',
                            fontSize: '0.85rem',
                            backdropFilter: 'blur(10px)'
                        }}>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{
                            padding: '16px 20px',
                            borderRadius: '16px',
                            background: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            color: '#6ee7b7',
                            fontSize: '0.85rem',
                            backdropFilter: 'blur(10px)'
                        }}>
                            {success}
                        </div>
                    )}

                    {/* Primary Action */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...buttonStyle,
                            opacity: loading ? 0.7 : 1,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transform: loading ? 'scale(0.98)' : 'scale(1)',
                        }}
                    >
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                                AUTHENTICATING...
                            </span>
                        ) : mode === 'login' ? 'ENTER THE SYSTEM' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SEND RESET LINK'}
                    </button>
                </form>

                {/* Forgot Password Link */}
                {mode === 'login' && (
                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <button
                            onClick={() => {
                                setMode('forgot');
                                setError('');
                                setSuccess('');
                                triggerHaptic('light');
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(139,92,246,0.8)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                letterSpacing: '0.05em',
                                transition: 'all 0.2s'
                            }}
                        >
                            Lost access code?
                        </button>
                    </div>
                )}

                {/* Divider */}
                {mode !== 'forgot' && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        margin: '2rem 0'
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                        <span style={{ fontSize: '0.65rem', opacity: 0.3, letterSpacing: '0.1em' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                    </div>
                )}

                {/* Guest Access */}
                {mode !== 'forgot' && (
                    <button
                        onClick={handleGuest}
                        disabled={guestLoading}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '16px',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            letterSpacing: '0.1em',
                            cursor: guestLoading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            textTransform: 'uppercase',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        {guestLoading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid rgba(255,255,255,0.8)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                                INITIALIZING...
                            </span>
                        ) : '👤 GUEST ACCESS'}
                    </button>
                )}

                {mode !== 'forgot' && (
                    <p style={{
                        textAlign: 'center',
                        marginTop: '1.5rem',
                        fontSize: '0.65rem',
                        opacity: 0.2,
                        letterSpacing: '0.05em',
                        lineHeight: '1.4'
                    }}>
                        Guest data persists during session.<br />
                        Link account later for permanent storage.
                    </p>
                )}

                {/* Back to Login */}
                {mode === 'forgot' && (
                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <button
                            onClick={() => {
                                setMode('login');
                                setError('');
                                setSuccess('');
                                triggerHaptic('light');
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(139,92,246,0.8)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                letterSpacing: '0.05em',
                                transition: 'all 0.2s'
                            }}
                        >
                            ← Return to access
                        </button>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </main>
    );
}
