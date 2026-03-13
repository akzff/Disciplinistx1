'use client';

import { useAuth } from '@clerk/nextjs';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import { ReactNode } from 'react';

export default function AuthGate({ children }: { children: ReactNode }) {
    const { isLoaded } = useAuth();

    if (!isLoaded) {
        return (
            <main className="auth-loading">
                <div className="bg-mesh"></div>
                <div className="dragon-loader" role="status" aria-live="polite">
                    <div className="dragon-orbit" aria-hidden="true">
                        <svg className="dragon-svg" viewBox="0 0 240 160">
                            <defs>
                                <linearGradient id="dragonGlow" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="rgba(251, 191, 36, 0.95)" />
                                    <stop offset="55%" stopColor="rgba(14, 165, 233, 0.9)" />
                                    <stop offset="100%" stopColor="rgba(52, 211, 153, 0.9)" />
                                </linearGradient>
                            </defs>
                            <path
                                className="dragon-path"
                                d="M18 118
                                   Q32 78 68 70
                                   Q98 62 124 78
                                   Q140 88 156 80
                                   Q184 65 190 40
                                   Q195 18 172 16
                                   Q150 14 140 34
                                   Q132 52 150 62
                                   Q176 78 200 80
                                   Q220 82 226 64
                                   Q232 46 214 38
                                   Q198 30 206 18"
                            />
                            <path
                                className="dragon-wing"
                                d="M92 92
                                   Q112 70 134 72
                                   Q122 96 96 108"
                            />
                            <circle className="dragon-heart" cx="92" cy="88" r="6" />
                        </svg>
                        <div className="dragon-core" />
                    </div>
                    <div className="dragon-copy">
                        <p className="dragon-title">Dragon is recharging</p>
                        <p className="dragon-sub">Forging heat and syncing the realm.</p>
                    </div>
                    <div className="dragon-charge" aria-hidden="true">
                        <span />
                    </div>
                </div>
                <style jsx>{`
                    .auth-loading {
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        gap: 2rem;
                        background: #050505;
                        position: relative;
                        overflow: hidden;
                        padding: 2rem;
                        color: rgba(255, 255, 255, 0.9);
                    }

                    .dragon-loader {
                        position: relative;
                        z-index: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        gap: 1.5rem;
                        text-align: center;
                    }

                    .dragon-orbit {
                        position: relative;
                        width: 220px;
                        height: 160px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        animation: float 3.8s ease-in-out infinite;
                        filter: drop-shadow(0 12px 40px rgba(14, 165, 233, 0.25));
                    }

                    .dragon-svg {
                        width: 220px;
                        height: 160px;
                    }

                    .dragon-path {
                        fill: none;
                        stroke: url(#dragonGlow);
                        stroke-width: 3;
                        stroke-linecap: round;
                        stroke-linejoin: round;
                        stroke-dasharray: 8 10;
                        animation: dash 2.6s linear infinite;
                    }

                    .dragon-wing {
                        fill: none;
                        stroke: rgba(251, 191, 36, 0.7);
                        stroke-width: 2;
                        stroke-linecap: round;
                        stroke-linejoin: round;
                        opacity: 0.9;
                        animation: wing 2.8s ease-in-out infinite;
                    }

                    .dragon-heart {
                        fill: rgba(251, 191, 36, 0.95);
                        filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.6));
                        animation: heartbeat 1.6s ease-in-out infinite;
                    }

                    .dragon-core {
                        position: absolute;
                        width: 90px;
                        height: 90px;
                        border-radius: 50%;
                        background: radial-gradient(circle, rgba(14, 165, 233, 0.28), rgba(14, 165, 233, 0) 60%);
                        animation: pulse 2.8s ease-in-out infinite;
                        z-index: -1;
                    }

                    .dragon-copy {
                        display: flex;
                        flex-direction: column;
                        gap: 0.35rem;
                    }

                    .dragon-title {
                        font-size: 1.1rem;
                        letter-spacing: 0.12em;
                        text-transform: uppercase;
                        font-weight: 700;
                        color: rgba(255, 255, 255, 0.92);
                    }

                    .dragon-sub {
                        font-size: 0.85rem;
                        color: rgba(255, 255, 255, 0.6);
                    }

                    .dragon-charge {
                        width: min(260px, 80vw);
                        height: 8px;
                        border-radius: 999px;
                        overflow: hidden;
                        background: rgba(255, 255, 255, 0.08);
                        border: 1px solid rgba(255, 255, 255, 0.12);
                    }

                    .dragon-charge span {
                        display: block;
                        height: 100%;
                        width: 45%;
                        border-radius: inherit;
                        background: linear-gradient(90deg, rgba(251, 191, 36, 0.9), rgba(14, 165, 233, 0.9), rgba(52, 211, 153, 0.9));
                        animation: charge 2s ease-in-out infinite;
                    }

                    @keyframes dash {
                        0% { stroke-dashoffset: 0; }
                        100% { stroke-dashoffset: -54; }
                    }

                    @keyframes float {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-8px); }
                    }

                    @keyframes pulse {
                        0%, 100% { transform: scale(0.85); opacity: 0.55; }
                        50% { transform: scale(1.1); opacity: 0.85; }
                    }

                    @keyframes heartbeat {
                        0%, 100% { transform: scale(0.95); }
                        50% { transform: scale(1.2); }
                    }

                    @keyframes wing {
                        0%, 100% { opacity: 0.5; transform: translateY(0); }
                        50% { opacity: 1; transform: translateY(-6px); }
                    }

                    @keyframes charge {
                        0% { transform: translateX(-40%); opacity: 0.4; }
                        50% { transform: translateX(55%); opacity: 0.95; }
                        100% { transform: translateX(120%); opacity: 0.4; }
                    }

                    @media (max-width: 480px) {
                        .dragon-orbit {
                            width: 180px;
                            height: 130px;
                        }

                        .dragon-svg {
                            width: 180px;
                            height: 130px;
                        }

                        .dragon-title {
                            font-size: 1rem;
                            letter-spacing: 0.1em;
                        }
                    }

                    @media (prefers-reduced-motion: reduce) {
                        .dragon-orbit,
                        .dragon-path,
                        .dragon-wing,
                        .dragon-heart,
                        .dragon-core,
                        .dragon-charge span {
                            animation: none;
                        }
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
