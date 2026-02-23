'use client';

import { useState, useEffect } from 'react';
import { storage, DailyChat, UserPreferences } from '@/lib/storage';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function RecordsPage() {
    const [selectedDate, setSelectedDate] = useState('');
    const [chat, setChat] = useState<DailyChat | null>(null);
    const [allDates, setAllDates] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);

    useEffect(() => {
        const chats = storage.getChats();
        const dates = Object.keys(chats).sort().reverse();
        setAllDates(dates);
        const today = storage.getCurrentDate();
        setSelectedDate(today);
        setChat(storage.getChat(today));
        setPreferences(storage.getUserPreferences());
    }, []);

    useEffect(() => {
        if (selectedDate) {
            setChat(storage.getChat(selectedDate));
        }
    }, [selectedDate]);

    const generateReport = async () => {
        if (!chat || !preferences) return;
        setIsGenerating(true);

        try {
            const context = {
                date: chat.date,
                todos: chat.todos,
                dailies: chat.dailies,
                messages: chat.messages,
                habits: preferences.habitNotes,
                vision: preferences.dayVision,
                ambition: preferences.ambition
            };

            const prompt = `Provide a brief, factual summary of the user's day on ${chat.date} based on their chat context and checklist data. 
            Summarize exactly what was accomplished and what was missed. 
            Do NOT provide advice, feedback, or coaching. Just the data-driven summary.
            Context: ${JSON.stringify(context)}`;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    systemPrompt: "You are a factual data analyzer. Provide a concise summary of the day's events based on the provided data. No advice. No conversational filler."
                }),
            });

            if (!response.ok) throw new Error('Failed to generate report');
            const data = await response.json();
            const summary = data.choices[0].message.content;

            storage.saveChat(selectedDate, { aiSummary: summary });
            setChat({ ...chat, aiSummary: summary });
        } catch (error) {
            console.error(error);
            alert('Mission analysis failed. Try again, Disciple.');
        } finally {
            setIsGenerating(false);
        }
    };

    const calculateStats = (items: any[]) => {
        if (!items || items.length === 0) return { total: 0, completed: 0, percent: 0 };
        const completed = items.filter(i => i.completed).length;
        return { total: items.length, completed, percent: Math.round((completed / items.length) * 100) };
    };

    const todoStats = calculateStats(chat?.todos || []);
    const dailyStats = calculateStats(chat?.dailies || []);

    return (
        <main>
            <div className="bg-mesh"></div>

            <div className="chat-container" style={{ maxHeight: '95vh', overflow: 'hidden' }}>
                <header className="chat-header">
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.1em', color: 'var(--accent)' }}>THE ARCHIVES</h1>
                        <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>PREVIOUS MISSIONS & AI INTELLIGENCE</p>
                    </div>
                    <nav style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link href="/" className="nav-link">Chat</Link>
                        <Link href="/records" className="nav-link active">Records</Link>
                    </nav>
                </header>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar Dates */}
                    <div style={{ width: '240px', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '1rem' }}>
                        <h3 style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '1rem', textTransform: 'uppercase' }}>Mission History</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {allDates.map(date => (
                                <button
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        background: selectedDate === date ? 'var(--accent)' : 'transparent',
                                        border: 'none',
                                        color: 'white',
                                        textAlign: 'left',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {date} {date === storage.getCurrentDate() && ' (Today)'}
                                </button>
                            ))}
                        </div>

                        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h3 style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Data Intelligence</h3>
                            <button
                                onClick={() => {
                                    const data = storage.exportData();
                                    const blob = new Blob([data], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `deciplinist_backup_${new Date().toISOString().split('T')[0]}.json`;
                                    a.click();
                                }}
                                style={{
                                    padding: '10px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border)',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: '800',
                                    cursor: 'pointer'
                                }}
                            >
                                📤 EXPORT BACKUP
                            </button>
                            <label style={{
                                padding: '10px',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border)',
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                textAlign: 'center'
                            }}>
                                📥 IMPORT BACKUP
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            const content = event.target?.result as string;
                                            if (storage.importData(content)) {
                                                alert('Data Protocol Restored. Refreshing system...');
                                                window.location.reload();
                                            } else {
                                                alert('Import Failed. Corrupted data signature.');
                                            }
                                        };
                                        reader.readAsText(file);
                                    }}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Report Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
                        {chat ? (
                            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                                    <div>
                                        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white' }}>{selectedDate}</h2>
                                        <p style={{ opacity: 0.5, fontWeight: '600' }}>MISSION PERFORMANCE DATA</p>
                                    </div>
                                    <button
                                        onClick={generateReport}
                                        disabled={isGenerating}
                                        className="start-day-btn"
                                        style={{ margin: 0, padding: '0.8rem 1.5rem', fontSize: '0.8rem' }}
                                    >
                                        {isGenerating ? 'ANALYZING...' : chat.aiSummary ? 'RE-GENERATE REPORT' : 'GENERATE AI REPORT'}
                                    </button>
                                </div>

                                {/* Summary Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
                                    <div className="stat-box">
                                        <span className="stat-label">DAILY RITES</span>
                                        <span className="stat-value">{dailyStats.completed}/{dailyStats.total}</span>
                                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${dailyStats.percent}%`, background: '#10b981' }}></div></div>
                                    </div>
                                    <div className="stat-box">
                                        <span className="stat-label">MISSIONS MET</span>
                                        <span className="stat-value">{todoStats.completed}/{todoStats.total}</span>
                                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${todoStats.percent}%` }}></div></div>
                                    </div>
                                    <div className="stat-box" style={{ background: 'var(--accent)', color: 'white' }}>
                                        <span className="stat-label" style={{ color: 'rgba(255,255,255,0.7)' }}>OVERALL LEVEL</span>
                                        <span className="stat-value">{Math.round((todoStats.percent + dailyStats.percent) / 2)}%</span>
                                        <p style={{ fontSize: '0.6rem', marginTop: '4px', fontWeight: '800' }}>DISCIPLINE SCORE</p>
                                    </div>
                                </div>

                                {/* AI Content */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid var(--border)', padding: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧘</div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '0.05em' }}>DISCIPLINIST INTELLIGENCE REPORT</h3>
                                    </div>

                                    {chat.aiSummary ? (
                                        <div className="report-markdown">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {chat.aiSummary}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '4rem 0', textAlign: 'center', opacity: 0.3 }}>
                                            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌓</p>
                                            <p style={{ fontWeight: '800', letterSpacing: '0.1em' }}>WAITING FOR END-OF-DAY DEBRIEF</p>
                                            <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>Generate a report to see the Disciplinist's assessment of your day.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                <p>Select a cycle from the history.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .stat-box {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                }
                .stat-label { font-size: 0.65rem; font-weight: 900; opacity: 0.5; letter-spacing: 0.1em; }
                .stat-value { font-size: 1.8rem; font-weight: 900; margin: 0.5rem 0; }
                .progress-bar { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
                .progress-fill { height: 100%; transition: width 0.5s ease; background: var(--accent); }
                .report-markdown {
                    line-height: 1.8;
                    font-size: 1rem;
                }
                .report-markdown h2, .report-markdown h3 {
                    color: white;
                    margin: 2rem 0 1rem 0;
                    letter-spacing: -0.02em;
                }
                .report-markdown p {
                    margin-bottom: 1.2rem;
                    opacity: 0.8;
                }
                .report-markdown table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1.5rem 0;
                    background: rgba(255,255,255,0.03);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .report-markdown th {
                    background: rgba(255,255,255,0.05);
                    color: var(--accent);
                    text-align: left;
                    padding: 1rem;
                    font-size: 0.75rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }
                .report-markdown td {
                    padding: 1rem;
                    border-top: 1px solid var(--border);
                    font-size: 0.9rem;
                    opacity: 0.9;
                }
                .report-markdown ul, .report-markdown ol {
                    margin-bottom: 1.2rem;
                    padding-left: 1.5rem;
                }
                .report-markdown li {
                    margin-bottom: 0.5rem;
                    opacity: 0.8;
                }
                .report-markdown strong {
                    color: white;
                    font-weight: 700;
                }
                .report-markdown blockquote {
                    border-left: 4px solid var(--accent);
                    padding-left: 1.5rem;
                    margin: 1.5rem 0;
                    font-style: italic;
                    opacity: 0.8;
                }
            `}</style>
        </main>
    );
}
