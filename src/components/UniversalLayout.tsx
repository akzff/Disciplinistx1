'use client';

import React, { useState, ReactNode } from 'react';
import { DailyChat } from '@/lib/storage';
import { useData } from '@/lib/DataContext';
import { useUser, SignOutButton } from '@clerk/nextjs';
import MissionChecklist from './MissionChecklist';
import { NavigationBar } from './NavigationBar';

interface UniversalLayoutProps {
    children: ReactNode;
    showTaskSidebar?: boolean;
    showNavigationBar?: boolean;
    taskSidebarProps?: {
        todos: DailyChat['todos'];
        dailies: DailyChat['dailies'];
        onToggleTodo: (id: string) => void;
        onToggleDaily: (id: string) => void;
        onReorderTodo: (newTodos: DailyChat['todos']) => void;
        onReorderDaily: (newDailies: DailyChat['dailies']) => void;
        onStartLiveMission: (name: string) => void;
    };
}

export default function UniversalLayout({ 
    children, 
    showTaskSidebar = false, 
    showNavigationBar = true,
    taskSidebarProps 
}: UniversalLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const { preferences, updatePreferences } = useData();
    const { user } = useUser();

    const updateProfile = (updates: Partial<typeof preferences>) => {
        if (updatePreferences && updates) {
            updatePreferences(updates);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            {/* Universal Header with Navigation and Settings */}
            <header style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '1rem',
                background: 'rgba(0, 0, 0, 0.2)',
                borderBottom: '1px solid var(--border)',
                backdropFilter: 'blur(10px)',
                zIndex: 10
            }}>
                {/* Navigation Bar */}
                {showNavigationBar && (
                    <div style={{ flex: 1 }}>
                        <NavigationBar />
                    </div>
                )}

                {/* Universal Settings/Account/Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        style={{
                            background: 'rgba(139, 92, 246, 0.2)',
                            border: '1px solid var(--accent)',
                            color: 'var(--accent)',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        ⚙️ Settings
                    </button>

                    {user && (
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: '700'
                            }}>
                                {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0] || 'U'}
                            </div>
                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                {user.firstName || user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'User'}
                            </span>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content Area */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
                {/* Task Sidebar (when enabled) */}
                {showTaskSidebar && taskSidebarProps && (
                    <>
                        {/* Mobile backdrop */}
                        {sidebarOpen && (
                            <div 
                                className="sidebar-backdrop" 
                                onClick={() => setSidebarOpen(false)}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(0, 0, 0, 0.5)',
                                    zIndex: 5,
                                    display: 'none'
                                }}
                            />
                        )}

                        {/* Task Sidebar */}
                        <div style={{
                            width: '320px',
                            borderRight: '1px solid var(--border)',
                            overflowY: 'auto',
                            flexShrink: 0,
                            background: 'rgba(0, 0, 0, 0.2)',
                            backdropFilter: 'blur(10px)',
                            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                            transition: 'transform 0.3s ease',
                            position: 'relative',
                            zIndex: 6
                        }}>
                            <MissionChecklist
                                todos={taskSidebarProps.todos}
                                dailies={taskSidebarProps.dailies}
                                sidebarOpen={sidebarOpen}
                                onClose={() => setSidebarOpen(false)}
                                onToggleTodo={taskSidebarProps.onToggleTodo}
                                onToggleDaily={taskSidebarProps.onToggleDaily}
                                onReorderTodo={taskSidebarProps.onReorderTodo}
                                onReorderDaily={taskSidebarProps.onReorderDaily}
                                onStartLiveMission={taskSidebarProps.onStartLiveMission}
                            />
                        </div>

                        {/* Sidebar Toggle Button */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            style={{
                                position: 'absolute',
                                left: sidebarOpen ? '320px' : '0',
                                top: '1rem',
                                width: '32px',
                                height: '32px',
                                background: 'var(--accent)',
                                border: 'none',
                                borderRadius: '0 8px 8px 0',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 7,
                                transition: 'left 0.3s ease',
                                boxShadow: '2px 0 10px rgba(0, 0, 0, 0.3)'
                            }}
                        >
                            {sidebarOpen ? '◀' : '▶'}
                        </button>
                    </>
                )}

                {/* Page Content */}
                <div style={{ 
                    flex: 1, 
                    overflow: 'hidden',
                    marginLeft: showTaskSidebar && taskSidebarProps ? (sidebarOpen ? '0' : '0') : '0',
                    transition: 'margin-left 0.3s ease'
                }}>
                    {children}
                </div>
            </div>

            {/* Universal Settings Modal */}
            {showSettings && (
                <div 
                    className="settings-modal-backdrop"
                    onClick={() => setShowSettings(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.8)',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div 
                        className="settings-modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--glass)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '90%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent)' }}>Settings</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    opacity: 0.6
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Profile Section */}
                        <div className="setting-item" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent)', display: 'block', marginBottom: '8px' }}>PROFILE</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <input
                                    className="settings-input"
                                    style={{ marginBottom: '8px', fontSize: '1rem', fontWeight: '900' }}
                                    placeholder="Your Name"
                                    value={preferences?.name || ''}
                                    onChange={(e) => updateProfile({ name: e.target.value })}
                                />
                                <input
                                    className="settings-input"
                                    style={{ fontSize: '0.75rem', opacity: 0.6 }}
                                    placeholder="Add a bio..."
                                    value={preferences?.bio || ''}
                                    onChange={(e) => updateProfile({ bio: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Account Actions */}
                        <div className="setting-item">
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ef4444', display: 'block', marginBottom: '8px' }}>ACCOUNT</label>
                            <SignOutButton>
                                <button
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.2)',
                                        border: '1px solid #ef4444',
                                        color: '#ef4444',
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        width: '100%'
                                    }}
                                >
                                    Sign Out
                                </button>
                            </SignOutButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Responsive Styles */}
            <style jsx>{`
                @media (max-width: 768px) {
                    .sidebar-backdrop {
                        display: block !important;
                    }
                }
            `}</style>
        </div>
    );
}
