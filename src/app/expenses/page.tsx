'use client';

import { useState, useEffect, useMemo } from 'react';
import { storage, DailyChat } from '@/lib/storage';
import Link from 'next/link';

export default function ExpensesPage() {
    const [allChats, setAllChats] = useState<Record<string, DailyChat>>({});
    const [currentDate, setCurrentDate] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDesc, setExpenseDesc] = useState('');

    useEffect(() => {
        setAllChats(storage.getChats());
        setCurrentDate(storage.getCurrentDate());
    }, []);

    const allExpenses = useMemo(() => {
        const list: { id: string; amount: number; text: string; date: string }[] = [];
        Object.entries(allChats).sort(([a], [b]) => b.localeCompare(a)).forEach(([date, chat]) => {
            if (chat.expenses) {
                chat.expenses.forEach(exp => {
                    list.push({ ...exp, date });
                });
            }
        });
        return list;
    }, [allChats]);

    const stats = useMemo(() => {
        const total = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const today = allExpenses
            .filter(exp => exp.date === currentDate)
            .reduce((sum, exp) => sum + exp.amount, 0);

        // Group by day for the chart/list
        const dailyTotals: Record<string, number> = {};
        allExpenses.forEach(exp => {
            dailyTotals[exp.date] = (dailyTotals[exp.date] || 0) + exp.amount;
        });

        const sortedDays = Object.entries(dailyTotals).sort(([a], [b]) => b.localeCompare(a));

        return { total, today, sortedDays };
    }, [allExpenses, currentDate]);

    const handleAddExpense = () => {
        if (!expenseAmount || !expenseDesc) return;
        const amount = parseFloat(expenseAmount);
        if (isNaN(amount)) return;

        const chat = storage.getChat(currentDate) || storage.initializeNewDay(currentDate);
        const newExpense = {
            id: Date.now().toString(),
            amount,
            text: expenseDesc
        };

        const updatedExpenses = [...(chat.expenses || []), newExpense];
        storage.saveChat(currentDate, { expenses: updatedExpenses });

        // Refresh local state
        setAllChats(storage.getChats());
        setExpenseAmount('');
        setExpenseDesc('');
    };

    const removeExpense = (date: string, id: string) => {
        if (!confirm('Delete this expense record?')) return;
        const chat = storage.getChat(date);
        if (chat && chat.expenses) {
            const updated = chat.expenses.filter(e => e.id !== id);
            storage.saveChat(date, { expenses: updated });
            setAllChats(storage.getChats());
        }
    };

    return (
        <main>
            <div className="bg-mesh"></div>

            <div className="chat-container" style={{ maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <header className="chat-header">
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.1em', color: '#f59e0b' }}>RESOURCES & FLOW</h1>
                        <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>FINANCIAL DISCIPLINE & EXPENDITURE LOG</p>
                    </div>
                    <nav style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link href="/" className="nav-link">Chat</Link>
                        <Link href="/expenses" className="nav-link active">Expenses</Link>
                        <Link href="/records" className="nav-link">Records</Link>
                    </nav>
                </header>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Left Panel: Add & Quick Stats */}
                    <div style={{ width: '320px', borderRight: '1px solid var(--border)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', flexShrink: 0 }}>
                        <section>
                            <h3 style={{ fontSize: '0.7rem', fontWeight: '900', color: '#f59e0b', letterSpacing: '0.1em', marginBottom: '1rem', textTransform: 'uppercase' }}>Log Expenditure</h3>
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

                        <section style={{ marginTop: 'auto' }}>
                            <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <p style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.5, letterSpacing: '0.1em' }}>TOTAL SPENT</p>
                                    <p style={{ fontSize: '2rem', fontWeight: '900', color: 'white' }}>${stats.total.toFixed(2)}</p>
                                </div>
                                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <div>
                                    <p style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.5, letterSpacing: '0.1em' }}>TODAY</p>
                                    <p style={{ fontSize: '1.2rem', fontWeight: '900', color: '#f59e0b' }}>${stats.today.toFixed(2)}</p>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Main Content: Expense List */}
                    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
                        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '2rem', color: 'white' }}>Transaction History</h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {stats.sortedDays.length === 0 && (
                                    <div style={{ textAlign: 'center', py: '5rem', opacity: 0.3 }}>
                                        <p style={{ fontSize: '3rem' }}>💸</p>
                                        <p style={{ fontWeight: '800', marginTop: '1rem' }}>NO FINANCIAL DATA YET</p>
                                    </div>
                                )}

                                {stats.sortedDays.map(([date, dayTotal]) => (
                                    <div key={date}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: '900', color: date === currentDate ? '#f59e0b' : 'white' }}>
                                                {date} {date === currentDate && <span style={{ fontSize: '0.6rem', marginLeft: '8px', opacity: 0.5 }}>TODAY</span>}
                                            </h3>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '800', opacity: 0.7 }}>DAY TOTAL: ${dayTotal.toFixed(2)}</span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                            {allChats[date].expenses?.map((exp) => (
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
                                                        <p style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '2px' }}>UUID: {exp.id.slice(-8)}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <p style={{ fontSize: '1.1rem', fontWeight: '900', color: '#f59e0b' }}>${exp.amount.toFixed(2)}</p>
                                                        <button
                                                            onClick={() => removeExpense(date, exp.id)}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.3, fontSize: '1.2rem', padding: '4px' }}
                                                            className="delete-hover"
                                                        >×</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
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
            `}</style>
        </main>
    );
}
