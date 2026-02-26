'use client';

import { useState, useEffect } from 'react';
import { storage, DailyChat, UserPreferences } from '@/lib/storage';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const puter: any;

interface ReportBlocks {
    execution: string;
    alignment: string;
    refinement: string;
}

function parseBlocks(summary: string): ReportBlocks {
    const extract = (tag: string) => {
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
        const match = summary.match(regex);
        return match ? match[1].trim() : '';
    };

    const b1 = extract('block1');
    const b2 = extract('block2');
    const b3 = extract('block3');

    if (!b1 && !b2 && !b3) {
        // Fallback for older formats
        const b1Match = summary.match(/BLOCK 1[\s\S]*?(?=BLOCK 2|$)/i);
        const b2Match = summary.match(/BLOCK 2[\s\S]*?(?=BLOCK 3|$)/i);
        const b3Match = summary.match(/BLOCK 3[\s\S]*/i);
        return {
            execution: b1Match ? b1Match[0].replace(/BLOCK 1[^\n]*\n?/i, '').replace(/\[ARTIFACT_PROMPT[\s\S]*/i, '').trim() : summary.replace(/\[ARTIFACT_PROMPT[\s\S]*/i, '').trim(),
            alignment: b2Match ? b2Match[0].replace(/BLOCK 2[^\n]*\n?/i, '').replace(/\[ARTIFACT_PROMPT[\s\S]*/i, '').trim() : '',
            refinement: b3Match ? b3Match[0].replace(/BLOCK 3[^\n]*\n?/i, '').replace(/\[ARTIFACT_PROMPT[\s\S]*/i, '').trim() : '',
        };
    }

    return { execution: b1, alignment: b2, refinement: b3 };
}

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
                completedTasks: chat.completedTasks,
                messages: chat.messages,
                habits: preferences.habitNotes,
                vision: preferences.dayVision,
                ambition: preferences.ambition
            };

            const prompt = `Generate a structured intelligence report for ${chat.date}. You MUST use the exact XML tags specified below. Output ONLY bullet points inside the blocks. No conversational text, no intro, no outro, no thinking text.

<block1>
(DAY EXECUTION LOG: Comprehensive, detailed bullet points. Pull from EVERY available source: todos, dailies, completed missions, and especially the chat history. Include timestamps (e.g., 7:00 AM) and specific details like what you ate, thought, or felt. Be exhaustive but keep it in points. Max 15 bullets.)
</block1>

<block2>
(BEHAVIORAL ALIGNMENT: 1-2 bullets for RIGHT (✅) and 1-2 bullets for WRONG (❌). Be extremely concise.)
</block2>

<block3>
(STRATEGIC REFINEMENT: 2-3 short bullets. Tomorrow's pivot.)
</block3>

<artifact>
(IMAGE PROMPT: Describe a CINEMATIC PORTRAIT COLLAGE in manhwa sketch style — young Indian man with curly hair and gold aviator glasses as centerpiece face, with 2 small film-still scenes from today's key moments overlaid via double exposure. Dark moody background. Movie poster aesthetics.)
</artifact>

Context: ${JSON.stringify({ ...context, messages: undefined })}
Recent Chat: ${JSON.stringify(context.messages?.slice(-10))}`;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    systemPrompt: "You are a tactical intelligence analyzer. Output exact XML tags as requested. Output ONLY bullet points. Add nothing else. Be extremely brief."
                }),
            });

            if (!response.ok) throw new Error('Failed to generate report');
            const data = await response.json();
            const fullContent = data.choices[0].message.content;

            const artifactMatch = fullContent.match(/<artifact>([\s\S]+?)<\/artifact>/i) || fullContent.match(/\[ARTIFACT_PROMPT:?([\s\S]+?)\]/i);
            const artifactPrompt = artifactMatch
                ? artifactMatch[1].trim()
                : `Cinematic portrait collage: young Indian man with curly hair and gold aviator glasses as large centerpiece face, manhwa sketch style, dark moody double exposure, two film stills of disciplined work overlaid around him, movie poster composition.`;

            const summary = fullContent.replace(/<artifact>([\s\S]+?)<\/artifact>/gi, '').replace(/\[ARTIFACT_PROMPT:?([\s\S]+?)\]/gi, '').trim();

            let artifactUrl = '';
            try {
                const imageElement = await puter.ai.txt2img(artifactPrompt, {
                    model: 'black-forest-labs/FLUX.1-schnell'
                });
                artifactUrl = imageElement.src;
            } catch (imgError) {
                console.error('Image generation failed:', imgError);
            }

            storage.saveChat(selectedDate, { aiSummary: summary, artifactUrl });
            setChat({ ...chat, aiSummary: summary, artifactUrl });
        } catch (error) {
            console.error(error);
            alert('Mission analysis failed. Try again, Disciple.');
        } finally {
            setIsGenerating(false);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculateStats = (items: any[]) => {
        if (!items || items.length === 0) return { total: 0, completed: 0, percent: 0 };
        const completed = items.filter(i => i.completed).length;
        return { total: items.length, completed, percent: Math.round((completed / items.length) * 100) };
    };

    const todoStats = calculateStats(chat?.todos || []);
    const dailyStats = calculateStats(chat?.dailies || []);
    const blocks = chat?.aiSummary ? parseBlocks(chat.aiSummary) : null;

    const blockCards = [
        {
            icon: '📋',
            label: 'Day Execution Log',
            sub: 'What actually happened',
            color: '#a78bfa',
            content: blocks?.execution || ''
        },
        {
            icon: '⚖️',
            label: 'Behavioral Alignment',
            sub: 'Right moves & wrong turns',
            color: '#10b981',
            content: blocks?.alignment || ''
        },
        {
            icon: '🎯',
            label: 'Strategic Refinement',
            sub: 'Tomorrow\'s corrections',
            color: '#f59e0b',
            content: blocks?.refinement || ''
        },
    ];

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
                        <Link href="/expenses" className="nav-link">Expenses</Link>
                        <Link href="/analytics" className="nav-link">Analytics</Link>
                        <Link href="/records" className="nav-link active">Records</Link>
                    </nav>
                </header>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div style={{ width: '220px', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '1rem', flexShrink: 0 }}>
                        <h3 style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mission History</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {allDates.map(date => (
                                <button
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        background: selectedDate === date ? 'var(--accent)' : 'transparent',
                                        border: 'none',
                                        color: 'white',
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

                        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h3 style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Data</h3>
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
                                style={{ padding: '9px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer' }}
                            >
                                📤 EXPORT
                            </button>
                            <label style={{ padding: '9px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', textAlign: 'center' }}>
                                📥 IMPORT
                                <input type="file" accept=".json" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        const content = event.target?.result as string;
                                        if (storage.importData(content)) {
                                            alert('Data Protocol Restored.');
                                            window.location.reload();
                                        } else {
                                            alert('Import Failed.');
                                        }
                                    };
                                    reader.readAsText(file);
                                }} style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>

                    {/* Report Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
                        {chat ? (
                            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                                {/* Header Row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                                    <div>
                                        <h2 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'white', lineHeight: 1 }}>{selectedDate}</h2>
                                        <p style={{ opacity: 0.4, fontWeight: '600', fontSize: '0.75rem', marginTop: '4px', letterSpacing: '0.1em' }}>MISSION PERFORMANCE DATA</p>
                                    </div>
                                    <button
                                        onClick={generateReport}
                                        disabled={isGenerating}
                                        className="start-day-btn"
                                        style={{ margin: 0, padding: '0.75rem 1.4rem', fontSize: '0.78rem' }}
                                    >
                                        {isGenerating ? '⏳ ANALYZING...' : chat.aiSummary ? '↻ RE-GENERATE' : '✦ GENERATE AI REPORT'}
                                    </button>
                                </div>

                                {/* Stats Row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
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
                                    <div className="stat-box" style={{ background: 'var(--accent)' }}>
                                        <span className="stat-label" style={{ color: 'rgba(255,255,255,0.7)' }}>DISCIPLINE SCORE</span>
                                        <span className="stat-value">{Math.round((todoStats.percent + dailyStats.percent) / 2)}%</span>
                                        <p style={{ fontSize: '0.6rem', fontWeight: '800', opacity: 0.8 }}>OVERALL LEVEL</p>
                                    </div>
                                </div>

                                {/* Live Mission History */}
                                {chat.completedTasks && chat.completedTasks.length > 0 && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h3 style={{ fontSize: '0.65rem', fontWeight: '900', letterSpacing: '0.2em', opacity: 0.4, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Live Mission History</h3>
                                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                            {chat.completedTasks.map((task, i) => (
                                                <div key={i} style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', padding: '10px 14px', borderRadius: '10px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }}></div>
                                                    <div>
                                                        <p style={{ fontWeight: '800', fontSize: '0.85rem' }}>{task.name}</p>
                                                        <p style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '2px' }}>⏱ {Math.floor(task.activeTime / 60000)}m {Math.floor((task.activeTime % 60000) / 1000)}s</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Artifact + 3 Block Cards */}
                                {chat.aiSummary ? (
                                    <div>
                                        {/* Cover Image */}
                                        {chat.artifactUrl && (
                                            <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', marginBottom: '2rem', border: '1px solid var(--border)' }}>
                                                <img src={chat.artifactUrl} alt="Mission Artifact" style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }} />
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2rem 1.5rem 1rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
                                                    <p style={{ fontSize: '0.6rem', fontWeight: '900', letterSpacing: '0.15em', color: 'var(--accent)' }}>MISSION ARTIFACT</p>
                                                    <p style={{ fontSize: '1.1rem', fontWeight: '900', color: 'white' }}>{selectedDate}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* 1st Column (Detailed) vs 2nd Column (Concise) Layout */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
                                            {/* Detailed Execution Log */}
                                            <div className="block-card detailed" style={{
                                                display: 'flex',
                                                flexDirection: 'column'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: `1px solid ${blockCards[0].color}30` }}>
                                                    <div style={{ padding: '8px', borderRadius: '12px', background: `${blockCards[0].color}15`, fontSize: '1.4rem' }}>{blockCards[0].icon}</div>
                                                    <div>
                                                        <p style={{ fontSize: '0.75rem', fontWeight: '900', color: blockCards[0].color, letterSpacing: '0.1em' }}>{blockCards[0].label.toUpperCase()}</p>
                                                        <p style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '2px' }}>{blockCards[0].sub}</p>
                                                    </div>
                                                </div>
                                                {blockCards[0].content ? (
                                                    <div className="block-markdown detailed-markdown">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {blockCards[0].content}
                                                        </ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, padding: '3.5rem 2rem' }}>
                                                        <p style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>No telemetry data for this cycle.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Alignment & Refinement Sidebar */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                                {[1, 2].map((idx) => (
                                                    <div key={idx} className="block-card concise" style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        flexDirection: 'column'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: `1px solid ${blockCards[idx].color}30` }}>
                                                            <div style={{ padding: '8px', borderRadius: '12px', background: `${blockCards[idx].color}15`, fontSize: '1.4rem' }}>{blockCards[idx].icon}</div>
                                                            <div>
                                                                <p style={{ fontSize: '0.75rem', fontWeight: '900', color: blockCards[idx].color, letterSpacing: '0.1em' }}>{blockCards[idx].label.toUpperCase()}</p>
                                                                <p style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '2px' }}>{blockCards[idx].sub}</p>
                                                            </div>
                                                        </div>
                                                        {blockCards[idx].content ? (
                                                            <div className="block-markdown">
                                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                    {blockCards[idx].content}
                                                                </ReactMarkdown>
                                                            </div>
                                                        ) : (
                                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2, padding: '1rem' }}>
                                                                <p style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>Awaiting sync...</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ padding: '5rem 0', textAlign: 'center', opacity: 0.3 }}>
                                        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌓</p>
                                        <p style={{ fontWeight: '800', letterSpacing: '0.1em' }}>WAITING FOR END-OF-DAY DEBRIEF</p>
                                        <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>Generate a report to see the Disciplinist&apos;s assessment of your day.</p>
                                    </div>
                                )}
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
                    border-radius: 14px;
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                }
                .stat-label { font-size: 0.6rem; font-weight: 900; opacity: 0.5; letter-spacing: 0.12em; text-transform: uppercase; }
                .stat-value { font-size: 1.6rem; font-weight: 900; margin: 0.4rem 0; color: white; }
                .progress-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-top: auto; }
                .progress-fill { height: 100%; transition: width 0.6s ease; background: var(--accent); }
                
                .block-card {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 1.25rem;
                    min-height: 280px;
                    display: flex;
                    flex-direction: column;
                }
                .block-markdown {
                    font-size: 0.82rem;
                    line-height: 1.7;
                    flex: 1;
                }
                .detailed-markdown {
                    font-size: 0.88rem;
                }
                .detailed-markdown :global(li) {
                    margin-bottom: 0.8rem !important;
                    font-weight: 500;
                    color: rgba(255,255,255,0.9);
                }
                .block-markdown p {
                    opacity: 0.75;
                    margin-bottom: 0.5rem;
                }
                .block-markdown ul, .block-markdown ol {
                    padding-left: 1.2rem;
                    margin: 0;
                }
                .block-markdown li {
                    opacity: 0.8;
                    margin-bottom: 0.4rem;
                    font-size: 0.8rem;
                    line-height: 1.5;
                }
                .block-markdown strong {
                    color: white;
                    font-weight: 700;
                }
                .block-markdown h3, .block-markdown h4 {
                    font-size: 0.75rem;
                    font-weight: 900;
                    color: white;
                    margin: 0.75rem 0 0.4rem 0;
                    letter-spacing: 0.05em;
                }
            `}</style>
        </main>
    );
}
