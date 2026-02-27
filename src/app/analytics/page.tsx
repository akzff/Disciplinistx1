'use client';

import { useState, useEffect, useMemo } from 'react';
import { storage, DailyChat } from '@/lib/storage';
import Link from 'next/link';
import { NavigationBar } from '@/components/NavigationBar';

export default function AnalyticsPage() {
    const [allChats, setAllChats] = useState<Record<string, DailyChat>>({});
    const [selectedStrategy, setSelectedStrategy] = useState<string>('');
    const [strategyType, setStrategyType] = useState<'todo' | 'daily'>('daily');

    useEffect(() => {
        const chats = storage.getChats();
        setAllChats(chats);

        // Pick a default strategy if none selected
        const allStrategies = getAllUniqueStrategies(chats, strategyType);
        if (allStrategies.length > 0 && !selectedStrategy) {
            setSelectedStrategy(allStrategies[0]);
        }
    }, [strategyType]);

    function getAllUniqueStrategies(chats: Record<string, DailyChat>, type: 'todo' | 'daily') {
        const names = new Set<string>();
        Object.values(chats).forEach(chat => {
            const list = type === 'todo' ? chat.todos : chat.dailies;
            list.forEach(item => {
                if (item.text) names.add(item.text.trim());
            });
        });
        return Array.from(names).sort();
    }

    const uniqueStrategies = useMemo(() => getAllUniqueStrategies(allChats, strategyType), [allChats, strategyType]);

    const stats = useMemo(() => {
        if (!selectedStrategy) return null;

        const dates = Object.keys(allChats).sort();
        const history: { date: string; completed: boolean; found: boolean }[] = [];
        let totalOccurrences = 0;
        let totalCompleted = 0;
        let currentStreak = 0;
        let lastSuccess = true;

        dates.forEach(date => {
            const chat = allChats[date];
            const list = strategyType === 'todo' ? chat.todos : chat.dailies;
            const item = list.find(i => i.text.trim() === selectedStrategy);

            if (item) {
                history.push({ date, completed: item.completed, found: true });
                totalOccurrences++;
                if (item.completed) {
                    totalCompleted++;
                    if (lastSuccess) currentStreak++;
                    else currentStreak = 1;
                    lastSuccess = true;
                } else {
                    lastSuccess = false;
                    currentStreak = 0;
                }
            } else {
                history.push({ date, completed: false, found: false });
            }
        });

        const successRate = totalOccurrences > 0 ? (totalCompleted / totalOccurrences) * 100 : 0;

        return {
            history: history.slice(-14), // Last 14 days
            totalOccurrences,
            totalCompleted,
            successRate: Math.round(successRate),
            currentStreak
        };
    }, [allChats, selectedStrategy, strategyType]);

    return (
        <main>
            <div className="bg-mesh"></div>

            <div className="chat-container">
                <header className="chat-header">
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.1em', color: '#10b981' }}>STRATEGIC ANALYTICS</h1>
                        <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>LONG-TERM PERFORMANCE & CONSISTENCY METER</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <NavigationBar />
                    </div>
                </header>

                <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

                        {/* Selector Section */}
                        <div className="block-card" style={{
                            padding: '2.5rem',
                            marginBottom: '2rem',
                            display: 'flex',
                            gap: '3rem',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            background: 'rgba(255,255,255,0.03)'
                        }}>
                            <div style={{ flex: 1, minWidth: '350px' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '900', opacity: 0.4, marginBottom: '12px', letterSpacing: '0.15em' }}>MISSION PARAMETERS</label>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                                    {[
                                        { id: 'daily', label: 'DAILY RITES', color: '#10b981' },
                                        { id: 'todo', label: 'ONE-OFFS', color: '#8b5cf6' }
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                setStrategyType(t.id as 'todo' | 'daily');
                                                setSelectedStrategy(''); // Reset to let useEffect pick first of new type
                                            }}
                                            style={{
                                                flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,b255,255,0.1)', cursor: 'pointer',
                                                background: strategyType === t.id ? t.color : 'rgba(255,255,255,0.05)',
                                                color: strategyType === t.id ? 'black' : 'rgba(255,255,255,0.6)',
                                                fontWeight: '900', fontSize: '0.7rem', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                letterSpacing: '0.05em'
                                            }}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                                <select
                                    value={selectedStrategy}
                                    onChange={(e) => setSelectedStrategy(e.target.value)}
                                    style={{
                                        width: '100%', padding: '18px', borderRadius: '16px', background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '1.1rem', fontWeight: '700',
                                        outline: 'none', cursor: 'pointer', appearance: 'none'
                                    }}
                                >
                                    {uniqueStrategies.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                    {uniqueStrategies.length === 0 && <option>No data patterns detected...</option>}
                                </select>
                            </div>

                            {stats && (
                                <div style={{ display: 'flex', gap: '1.5rem' }}>
                                    <div className="stat-card-deep" style={{ borderLeft: '4px solid #10b981' }}>
                                        <p style={{ fontSize: '0.65rem', fontWeight: '900', color: '#10b981', opacity: 0.8 }}>SUCCESS PROBABILITY</p>
                                        <h2 style={{ fontSize: '3.2rem', fontWeight: '900', color: 'white' }}>{stats.successRate}%</h2>
                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', marginTop: '10px', borderRadius: '2px' }}>
                                            <div style={{ width: `${stats.successRate}%`, height: '100%', background: '#10b981', borderRadius: '2px' }} />
                                        </div>
                                    </div>
                                    <div className="stat-card-deep" style={{ borderLeft: '4px solid #8b5cf6' }}>
                                        <p style={{ fontSize: '0.65rem', fontWeight: '900', color: '#8b5cf6', opacity: 0.8 }}>CURRENT STREAK</p>
                                        <h2 style={{ fontSize: '3.2rem', fontWeight: '900', color: 'white' }}>{stats.currentStreak}</h2>
                                        <p style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: '4px' }}>CYCLES COMPLETED</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Main Chart Section */}
                        {stats && (
                            <div className="block-card" style={{ padding: '3rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '900', letterSpacing: '0.1em' }}>CONSISTENCY TIMELINE</h3>
                                        <p style={{ fontSize: '0.75rem', opacity: 0.4 }}>Execution density across last 14 active cycles</p>
                                    </div>
                                    <div style={{ padding: '8px 16px', borderRadius: '100px', background: stats.successRate > 70 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${stats.successRate > 70 ? '#10b98130' : '#ef444430'}` }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: '900', color: stats.successRate > 70 ? '#10b981' : '#ef4444' }}>
                                            {stats.successRate > 70 ? '● HIGH PERFORMANCE' : '● VOLATILE TREND'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '220px', paddingBottom: '2.5rem' }}>
                                    {stats.history.map((day, i) => (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', height: '100%' }}>
                                            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                                                <div style={{
                                                    width: '100%',
                                                    height: day.found ? (day.completed ? '100%' : '15%') : '0%',
                                                    background: day.completed ? 'linear-gradient(to top, #10b981, #34d399)' : 'rgba(239, 68, 68, 0.2)',
                                                    borderRadius: '8px',
                                                    transition: 'height 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                                                    opacity: day.found ? 1 : 0.05,
                                                    boxShadow: day.completed ? '0 0 25px rgba(16, 185, 129, 0.15)' : 'none'
                                                }} />
                                            </div>
                                            <span style={{ fontSize: '0.65rem', opacity: 0.3, transform: 'rotate(-45deg)', marginTop: '8px', whiteSpace: 'nowrap', fontWeight: '700' }}>
                                                {day.date.split('-').slice(1).join('/')}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: '4rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
                                    {[
                                        { label: 'TOTAL MISSION ATTEMPTS', value: stats.totalOccurrences, color: 'white' },
                                        { label: 'SUCCESSFUL SYNCED CORES', value: stats.totalCompleted, color: 'white' },
                                        { label: 'SYSTEM RELIABILITY', value: stats.successRate > 70 ? 'OPTIMIZED' : 'NEEDS CALIBRATION', color: stats.successRate > 70 ? '#10b981' : '#ef4444' }
                                    ].map((item, i) => (
                                        <div key={i} style={{ padding: '1.75rem', background: 'rgba(255,255,255,0.01)', borderRadius: '18px', border: '1px solid rgba(255,b255,255,0.05)' }}>
                                            <p style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.3, marginBottom: '0.75rem', letterSpacing: '0.05em' }}>{item.label}</p>
                                            <p style={{ fontSize: '1.75rem', fontWeight: '900', color: item.color }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!stats && (
                            <div className="block-card" style={{ textAlign: 'center', padding: '12rem 0', background: 'transparent', opacity: 0.15 }}>
                                <p style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>📊</p>
                                <p style={{ fontWeight: '900', fontSize: '1.2rem', letterSpacing: '0.4em' }}>DATA SYNC REQUIRED</p>
                                <p style={{ fontSize: '0.9rem', marginTop: '1rem', opacity: 0.6 }}>SELECT A VALID STRATEGY CORE TO PROCEED</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .stat-card-deep {
                    padding: 2rem;
                    background: rgba(255,255,255,0.02);
                    border-radius: 20px;
                    min-width: 220px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
            `}</style>
        </main>
    );
}
