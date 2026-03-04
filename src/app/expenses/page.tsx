'use client';

import { useState, useEffect, useMemo } from 'react';
import { storage } from '@/lib/storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NavigationBar } from '@/components/NavigationBar';
import { cloudStorage } from '@/lib/cloudStorage';
import { useData } from '@/lib/DataContext';
import { useUser } from '@clerk/nextjs';
import { useAuthContext } from '@/lib/AuthContext';

// Strip model's internal reasoning tags before displaying
function cleanBotMessage(text: string): string {
    let cleaned = text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    if (cleaned.includes('<think>')) cleaned = cleaned.split('<think>')[0];
    if (cleaned.includes('<thinking>')) cleaned = cleaned.split('<thinking>')[0];

    return cleaned.trim();
}

export default function ExpensesPage() {
    const { allChats, setLocalChat, isSettingsOpen, setIsSettingsOpen } = useData();
    const { user } = useUser();
    const { signOut } = useAuthContext();
    const [selectedDate, setSelectedDate] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDesc, setExpenseDesc] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const today = storage.getCurrentDate();
        setSelectedDate(today);
    }, []);

    const allDates = useMemo(() => {
        return Object.keys(allChats).sort().reverse();
    }, [allChats]);

    const activeChat = useMemo(() => {
        return allChats[selectedDate] || null;
    }, [allChats, selectedDate]);

    const stats = useMemo(() => {
        const allExpenses: { amount: number; date: string }[] = [];
        Object.entries(allChats).forEach(([date, chat]) => {
            chat.expenses?.forEach(exp => allExpenses.push({ amount: exp.amount, date }));
        });

        const total = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const dayTotal = activeChat?.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;

        return { total, dayTotal };
    }, [allChats, activeChat]);

    const handleAddExpense = async () => {
        if (!expenseAmount || !expenseDesc) return;
        const amount = parseFloat(expenseAmount);
        if (isNaN(amount)) return;

        const updatedExpenses = [
            ...((activeChat?.expenses) || []),
            { id: Date.now().toString(), amount, text: expenseDesc }
        ];

        setLocalChat(selectedDate, { expenses: updatedExpenses });
        cloudStorage.saveChat(selectedDate, { expenses: updatedExpenses });

        setExpenseAmount('');
        setExpenseDesc('');
    };

    const removeExpense = async (id: string) => {
        if (!confirm('Delete this expense record?')) return;
        if (activeChat && activeChat.expenses) {
            const updated = activeChat.expenses.filter(e => e.id !== id);
            setLocalChat(selectedDate, { expenses: updated });
            cloudStorage.saveChat(selectedDate, { expenses: updated });
        }
    };

    const generateAudit = async () => {
        if (!activeChat || ((activeChat.expenses?.length || 0) === 0 && (activeChat.messages?.length || 0) === 0)) {
            alert("No data to audit for this cycle.");
            return;
        }
        setIsGenerating(true);

        try {
            const chatLog = (activeChat.messages || []).map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n');
            const prompt = `Analyze the financial data for ${selectedDate}.
            Logged Transactions: ${JSON.stringify(activeChat.expenses || [])}
            Today's Chat Log:
            ${chatLog}
            
            Find all expenses (both explicitly logged ones and any mentioned within the chat log).
            
            Simply list how much was spent and where it was spent using bullet points. Do NOT add any extra commentary, judgment, or advice.
            Example format:
            - $15 at Starbucks
            - $50 for Groceries
            
            NOTHING MORE. No "BLOCKs", no reflection, no protocol correction, no greeting. Just the raw list of what was spent and where.`;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    systemPrompt: "You are a raw data extractor. You only list expenses accurately. You never lecture, judge, or add conversational filler."
                }),
            });

            if (!response.ok) throw new Error('Audit protocol failed');
            const data = await response.json();
            const audit = data.choices[0].message.content;

            setLocalChat(selectedDate, { financialAudit: audit });
            cloudStorage.saveChat(selectedDate, { financialAudit: audit });
        } catch (error) {
            console.error(error);
            alert('Financial audit failed.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <main>
            <div className="bg-mesh"></div>

            <div className="chat-container" style={{ maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <header className="chat-header">
                    <div className="chat-header__left" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div
                            className="status-indicator"
                            style={{
                                '--mood-color': activeChat?.botMood === 'DISAPPOINTED' ? '#ef4444' : activeChat?.botMood === 'HOPEFUL' ? '#10b981' : activeChat?.botMood === 'DOMINATOR' ? '#8b5cf6' : '#6b7280'
                            } as React.CSSProperties}
                        ></div>
                        <h1 className="app-title">
                            <span className="app-title__brand">DISCIPLINIST</span>
                        </h1>
                    </div>

                    <div className="nav-center-wrapper desktop-only" style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
                        <NavigationBar />
                    </div>

                    <div className="header-controls" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className="header-action-btn"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 1 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </button>

                            <div className="profile-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '900', boxShadow: '0 2px 10px rgba(139, 92, 246, 0.3)' }}>
                                    {user?.primaryEmailAddress?.emailAddress?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className="mobile-hidden" style={{ fontSize: '0.7rem', opacity: 0.7, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>{user?.primaryEmailAddress?.emailAddress || 'User'}</span>
                                <button
                                    onClick={signOut}
                                    title="Sign Out"
                                    className="logout-btn"
                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px', transition: 'color 0.2s' }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="sidebar-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar: Date History */}
                    <div className="no-scrollbar sidebar-panel" style={{ width: '220px', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '1rem', flexShrink: 0 }}>
                        <h3 style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cycle History</h3>
                        <div className="sidebar-panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {allDates.map(date => (
                                <button
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        background: selectedDate === date ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                                        border: selectedDate === date ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                                        color: selectedDate === date ? '#f59e0b' : 'white',
                                        textAlign: 'left',
                                        fontSize: '0.82rem',
                                        fontWeight: selectedDate === date ? '800' : '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {date}{date === storage.getCurrentDate() && <span style={{ fontSize: '0.6rem', marginLeft: '6px', opacity: 0.7 }}>TODAY</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Left Column: Form & Stats */}
                        <div style={{ width: '340px', borderRight: '1px solid var(--border)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', flexShrink: 0, overflowY: 'auto' }} className="no-scrollbar">
                            <section>
                                <h3 style={{ fontSize: '0.7rem', fontWeight: '900', color: '#f59e0b', letterSpacing: '0.1em', marginBottom: '1.25rem', textTransform: 'uppercase' }}>Log Expenditure</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '4px', display: 'block' }}>AMOUNT ($)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={expenseAmount}
                                            onChange={e => setExpenseAmount(e.target.value)}
                                            className="settings-input"
                                            style={{ minHeight: 'auto', padding: '12px', fontSize: '1.2rem', fontWeight: '900' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '4px', display: 'block' }}>DESCRIPTION</label>
                                        <input
                                            type="text"
                                            placeholder="What did you buy?"
                                            value={expenseDesc}
                                            onChange={e => setExpenseDesc(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                                            className="settings-input"
                                            style={{ minHeight: 'auto', padding: '12px' }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddExpense}
                                        className="start-day-btn"
                                        style={{ margin: 0, padding: '12px', fontSize: '0.8rem', width: '100%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 10px 20px rgba(245, 158, 11, 0.2)' }}
                                    >
                                        CONFIRM TRANSACTION
                                    </button>
                                </div>
                            </section>

                            <section>
                                <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.5, letterSpacing: '0.1em' }}>TOTAL SPENT (ALL TIME)</p>
                                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'white' }}>${stats.total.toFixed(2)}</p>
                                    </div>
                                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                    <div>
                                        <p style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.5, letterSpacing: '0.1em' }}>THIS CYCLE ({selectedDate})</p>
                                        <p style={{ fontSize: '1.2rem', fontWeight: '900', color: '#f59e0b' }}>${stats.dayTotal.toFixed(2)}</p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Transaction List & Audit */}
                        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
                            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: 'white' }}>{selectedDate}</h2>
                                    <button
                                        onClick={generateAudit}
                                        disabled={isGenerating}
                                        className="start-day-btn"
                                        style={{ margin: 0, padding: '10px 20px', fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)' }}
                                    >
                                        {isGenerating ? '⏳ AUDITING...' : activeChat?.financialAudit ? '↻ RE-AUDIT' : '✦ GENERATE FINANCIAL AUDIT'}
                                    </button>
                                </div>

                                {activeChat?.financialAudit && (
                                    <div style={{ marginBottom: '3rem', padding: '1.5rem', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                            <span style={{ fontSize: '1.2rem' }}>⚖️</span>
                                            <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: '#f59e0b', letterSpacing: '0.1em' }}>DISCIPLINIST AUDIT</h3>
                                        </div>
                                        <div className="audit-content">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {cleanBotMessage(activeChat.financialAudit)}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                <h3 style={{ fontSize: '0.7rem', fontWeight: '900', opacity: 0.4, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>Transactions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {(!activeChat || (activeChat.expenses?.length || 0) === 0) && (
                                        <div style={{ textAlign: 'center', padding: '3rem 0', opacity: 0.3 }}>
                                            <p style={{ fontSize: '2rem' }}>💸</p>
                                            <p style={{ fontWeight: '800', marginTop: '1rem', fontSize: '0.75rem' }}>NO EXPLICIT TRANSACTIONS LOGGED</p>
                                            <p style={{ fontSize: '0.65rem', marginTop: '0.5rem' }}>The Disciplinist will audit your chat dialog if no explicit entries exist.</p>
                                        </div>
                                    )}

                                    {activeChat?.expenses?.map((exp) => (
                                        <div key={exp.id} className="expense-card" style={{
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '12px',
                                            padding: '1.25rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            transition: 'all 0.2s'
                                        }}>
                                            <div>
                                                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white' }}>{exp.text}</p>
                                                <p style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '2px' }}>{exp.id.slice(-8)}</p>
                                            </div>
                                            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                                <p style={{ fontSize: '1.1rem', fontWeight: '900', color: '#f59e0b' }}>${exp.amount.toFixed(2)}</p>
                                                <button
                                                    onClick={() => removeExpense(exp.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.3, fontSize: '1.2rem', padding: '4px' }}
                                                    className="delete-hover"
                                                >×</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .expense-card:hover {
                    background: rgba(255,255,255,0.04) !important;
                    border-color: rgba(245, 158, 11, 0.3) !important;
                    transform: translateY(-2px);
                }
                .delete-hover:hover {
                    opacity: 1 !important;
                }
                .nav-link.active {
                    color: #f59e0b !important;
                }
                .audit-content {
                    font-size: 0.85rem;
                    line-height: 1.6;
                    color: rgba(255,255,255,0.8);
                }
                .audit-content :global(ul) {
                    padding-left: 1.2rem;
                    margin: 0;
                }
                .audit-content :global(li) {
                    margin-bottom: 0.5rem;
                }
                .audit-content :global(strong) {
                    color: white;
                }
            `}</style>
        </main>
    );
}
