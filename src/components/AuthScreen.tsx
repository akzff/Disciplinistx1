'use client';

import { useState } from 'react';
import { 
    SignIn, 
    SignUp, 
    useUser
} from '@clerk/nextjs';

export default function AuthScreen() {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const { isSignedIn } = useUser();

    if (isSignedIn) {
        return null; // User is already signed in
    }

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="mesh-grid"></div>
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>
            
            <div className="auth-panel glass-panel">
                <div className="auth-header">
                    <h1 className="auth-title">DISCIPLINIST</h1>
                    <p className="auth-subtitle">Your Personal AI Coach</p>
                </div>

                <div className="auth-content">
                    {mode === 'signin' ? (
                        <div className="auth-form">
                            <SignIn 
                                path="/sign-in"
                                routing="path"
                                signUpUrl="/sign-up"
                                redirectUrl="/"
                                appearance={{
                                    elements: {
                                        rootBox: "w-full",
                                        card: "glass-panel border-0 shadow-none bg-transparent",
                                        headerTitle: "hidden",
                                        headerSubtitle: "hidden",
                                        socialButtonsBlockButton: "glass-panel border border-white/10 hover:border-white/20 transition-all duration-300",
                                        formButtonPrimary: "w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105",
                                        formFieldInput: "glass-panel border border-white/10 bg-white/5 text-white placeholder-white/50 focus:border-purple-500 focus:outline-none",
                                        footerActionLink: "text-purple-400 hover:text-purple-300 transition-colors",
                                        dividerLine: "border-white/10",
                                        dividerText: "text-white/50 text-sm"
                                    }
                                }}
                            />
                            <div className="auth-switch">
                                <p className="text-white/70">
                                    Don&apos;t have an account?{' '}
                                    <button 
                                        onClick={() => setMode('signup')}
                                        className="text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        Sign up
                                    </button>
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="auth-form">
                            <SignUp 
                                path="/sign-up"
                                routing="path"
                                signInUrl="/sign-in"
                                redirectUrl="/"
                                appearance={{
                                    elements: {
                                        rootBox: "w-full",
                                        card: "glass-panel border-0 shadow-none bg-transparent",
                                        headerTitle: "hidden",
                                        headerSubtitle: "hidden",
                                        socialButtonsBlockButton: "glass-panel border border-white/10 hover:border-white/20 transition-all duration-300",
                                        formButtonPrimary: "w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105",
                                        formFieldInput: "glass-panel border border-white/10 bg-white/5 text-white placeholder-white/50 focus:border-purple-500 focus:outline-none",
                                        footerActionLink: "text-purple-400 hover:text-purple-300 transition-colors",
                                        dividerLine: "border-white/10",
                                        dividerText: "text-white/50 text-sm"
                                    }
                                }}
                            />
                            <div className="auth-switch">
                                <p className="text-white/70">
                                    Already have an account?{' '}
                                    <button 
                                        onClick={() => setMode('signin')}
                                        className="text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        Sign in
                                    </button>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
