'use client';

import { useState, useEffect } from 'react';
import { storage, DailyChat, formatTime } from '@/lib/storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NavigationBar } from '@/components/NavigationBar';
import { cloudStorage } from '@/lib/cloudStorage';
import { useData } from '@/lib/DataContext';
import { useUser } from '@clerk/nextjs';
import { useAuthContext } from '@/lib/AuthContext';
import Image from 'next/image';
import { EnhancedExportImport } from '@/lib/enhancedExportImport';


interface ReportBlocks {
    execution: string;
    alignment: string;
    refinement: string;
}

interface ImportPreview {
    canImport: boolean;
    preview: {
        totalChats: number;
        dateRange: { earliest: string; latest: string };
        hasPreferences: boolean;
        version: string;
        exportDate: string;
        warnings: string[];
    };
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
    const { allChats, preferences, setLocalChat, isSettingsOpen, setIsSettingsOpen } = useData();
    const { user } = useUser();
    const { signOut } = useAuthContext();
    const [selectedDate, setSelectedDate] = useState('');
    const [chat, setChat] = useState<DailyChat | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        const today = storage.getCurrentDate();
        setSelectedDate(today);
    }, []);

    useEffect(() => {
        if (selectedDate) {
            setChat(allChats[selectedDate] || null);
        }
    }, [selectedDate, allChats]);

    const allDates = Object.keys(allChats).sort().reverse();

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

            const prompt = `Generate a structured intelligence report for ${chat.date}. You MUST use the exact XML tags below. All content goes inside the XML tags. Output text and bullet points only — DO NOT include any XML tag descriptions or parenthetical instructions in the output.

<block1>
(DAY EXECUTION LOG: A detailed, comprehensive timeline of the day. Each bullet = one real moment with a timestamp. Include wake-up time, meals, every activity, how the user felt, what they were doing at college/gym/home. Pull from ALL sources: todos, dailies, completed missions, and especially every message in the chat history. Be exhaustive — every meaningful moment gets a bullet. No cap on bullets.

CRITICAL: When you detect task abandonment, distraction, or context switching, ALWAYS include the specific reason or trigger. Examples:
- "Abandoned studying because felt mentally exhausted and couldn't focus"
- "Switched to football betting after seeing notification on phone"
- "Stopped coding to watch YouTube due to boredom"
- "Left workout early because of headache"

Look for explicit reasons in messages and infer from context. Never just say "abandoned X" without explaining WHY.)
</block1>

<block2>
✅ RIGHT:
- (accomplished action aligned with their goals)
- (another right action)
❌ WRONG:
- (specific failure or distraction)
- (another wrong move)
</block2>

<block3>
(STRATEGIC REFINEMENT: 3 concrete, numbered action items for tomorrow. Specific and actionable.)
</block3>

<artifact>
(IMAGE PROMPT ONLY: Pick ONE specific, vivid moment from today's activities and describe it as a cinematic wide-angle film still. Focus on the environment, mood, lighting, and action — not faces. Examples: a lone figure hunched over a laptop in dim light, a dark gym with iron weights and dramatic shadows, rain-streaked windows at night with open books. Style: anamorphic lens flare, cinematic color grading, 35mm film. Be specific to what actually happened today. Output the image prompt text only.)
</artifact>

Context: ${JSON.stringify({ ...context, messages: undefined })}
Recent Chat: ${JSON.stringify(context.messages?.slice(-15))}

IMPORTANT: For each completed task, check if there's an abandonmentReason. If present, include it in the execution log like: "• [TIME]: Abandoned [task name] - [reason]". If no reason is given but the task was short or context suggests abandonment, infer the likely reason from the chat messages.`;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    maxTokens: 3000,
                    systemPrompt: "You are a tactical intelligence analyzer. Output exact XML tags as instructed. Fill each block with real content from the user's context. Be comprehensive on execution log, concise on alignment and refinement."
                }),
            });

            if (!response.ok) throw new Error('Failed to generate report');
            const data = await response.json();
            // Strip think tags that reasoning models emit before parsing
            const fullContent = (data.choices[0].message.content as string)
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
                .trim();

            const artifactMatch = fullContent.match(/<artifact>([\s\S]+?)<\/artifact>/i) || fullContent.match(/\[ARTIFACT_PROMPT:?([\s\S]+?)\]/i);
            const artifactPrompt = artifactMatch
                ? artifactMatch[1].trim()
                : `Cinematic wide-angle film still: a lone figure studying late at night, desk lamp casting warm amber light on open books, rain-streaked window in background, anamorphic lens flare, dark moody color grading, 35mm film aesthetic.`;

            const summary = fullContent.replace(/<artifact>([\s\S]+?)<\/artifact>/gi, '').replace(/\[ARTIFACT_PROMPT:?([\s\S]+?)\]/gi, '').trim();

            let artifactUrl = '';
            try {
                const imgRes = await fetch('/api/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: artifactPrompt })
                });
                if (imgRes.ok) {
                    const imgData = await imgRes.json();
                    artifactUrl = imgData.imageUrl;
                } else {
                    console.error('Image generation failed:', await imgRes.text());
                }
            } catch (imgError) {
                console.error('Image generation failed:', imgError);
            }

            setLocalChat(selectedDate, { aiSummary: summary, artifactUrl });
            cloudStorage.saveChat(selectedDate, { aiSummary: summary, artifactUrl }, user?.id);
            setChat(prev => prev ? { ...prev, aiSummary: summary, artifactUrl } : null);
        } catch (error) {
            console.error(error);
            alert('Mission analysis failed. Try again, Disciple.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Enhanced export functionality
    const handleExport = async () => {
        setIsExporting(true);
        try {
            const exportData = await EnhancedExportImport.exportAllData(user?.id);
            const filename = EnhancedExportImport.generateFilename();
            EnhancedExportImport.downloadFile(exportData, filename);
        } catch (error) {
            console.error('Export failed:', error);
            alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsExporting(false);
        }
    };

    // Enhanced import functionality
    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const content = await file.text();

            // Show preview first
            const preview: ImportPreview = await EnhancedExportImport.getImportPreview(content);

            const confirmMessage = `Import this data?
            
📊 Summary:
• ${preview.preview.totalChats} chats (${preview.preview.dateRange.earliest} to ${preview.preview.dateRange.latest})
• Preferences: ${preview.preview.hasPreferences ? 'Yes' : 'No'}
• Version: ${preview.preview.version}
• Exported: ${new Date(preview.preview.exportDate).toLocaleDateString()}

${preview.preview.warnings.length > 0 ? `⚠️ Warnings:\n${preview.preview.warnings.join('\n')}` : ''}

This will ${user?.id ? 'sync to cloud storage' : 'import to local storage'}. Continue?`;

            if (!confirm(confirmMessage)) {
                return;
            }

            const result = await EnhancedExportImport.importAllData(content, user?.id);

            if (result.success) {
                alert(`✅ ${result.message}\n\nPage will reload to show imported data.`);
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                alert(`❌ Import failed:\n${result.errors.join('\n')}`);
            }
        } catch (error) {
            console.error('Import failed:', error);
            alert(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsImporting(false);
            // Reset file input
            event.target.value = '';
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
                    <div className="chat-header__left" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div
                            className="status-indicator"
                            style={{
                                '--mood-color': selectedDate === storage.getCurrentDate() ? (chat?.botMood === 'DISAPPOINTED' ? '#ef4444' : chat?.botMood === 'HOPEFUL' ? '#10b981' : chat?.botMood === 'DOMINATOR' ? '#8b5cf6' : '#6b7280') : '#6b7280'
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
                    {/* Sidebar */}
                    <div className="sidebar-panel" style={{ width: '220px', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '1rem', flexShrink: 0 }}>
                        <h3 style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Day History</h3>
                        <div className="sidebar-panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {allDates.map(date => (
                                <button
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        background: selectedDate === date ? '#d4a017' : 'transparent',
                                        border: selectedDate === date ? 'none' : '1px solid transparent',
                                        color: selectedDate === date ? 'black' : 'white',
                                        textAlign: 'left',
                                        fontSize: '0.82rem',
                                        fontWeight: selectedDate === date ? '900' : '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: selectedDate === date ? '0 0 12px rgba(212,160,23,0.3)' : 'none'
                                    }}
                                >
                                    {date}{date === storage.getCurrentDate() && <span style={{ fontSize: '0.6rem', marginLeft: '6px', opacity: 0.7 }}>TODAY</span>}
                                </button>
                            ))}
                        </div>

                        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h3 style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Data</h3>
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                style={{
                                    padding: '9px',
                                    borderRadius: '8px',
                                    background: isExporting ? 'rgba(212, 160, 23, 0.15)' : 'transparent',
                                    border: '1px solid rgba(212, 160, 23, 0.25)',
                                    color: 'rgba(212, 160, 23, 0.7)',
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    cursor: isExporting ? 'not-allowed' : 'pointer',
                                    opacity: isExporting ? 0.7 : 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isExporting ? '📤 EXPORTING...' : '📤 EXPORT'}
                            </button>
                            <label style={{
                                padding: '9px',
                                borderRadius: '8px',
                                background: isImporting ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                border: '1px solid rgba(212, 160, 23, 0.25)',
                                color: 'rgba(212, 160, 23, 0.7)',
                                fontSize: '0.72rem',
                                fontWeight: '800',
                                cursor: isImporting ? 'not-allowed' : 'pointer',
                                textAlign: 'center',
                                display: 'block',
                                opacity: isImporting ? 0.7 : 1,
                                transition: 'all 0.2s'
                            }}>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImport}
                                    disabled={isImporting}
                                    style={{
                                        position: 'absolute',
                                        opacity: 0,
                                        width: '100%',
                                        height: '100%',
                                        cursor: isImporting ? 'not-allowed' : 'pointer'
                                    }}
                                />
                                {isImporting ? '📥 IMPORTING...' : '📥 IMPORT'}
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
                                        <p style={{ opacity: 0.4, fontWeight: '600', fontSize: '0.75rem', marginTop: '4px', letterSpacing: '0.1em' }}>DAY SUMMARY</p>
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
                                        <span className="stat-label">DAILIES</span>
                                        <span className="stat-value">{dailyStats.completed}/{dailyStats.total}</span>
                                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${dailyStats.percent}%`, background: '#10b981' }}></div></div>
                                    </div>
                                    <div className="stat-box">
                                        <span className="stat-label">TO-DOS DONE</span>
                                        <span className="stat-value">{todoStats.completed}/{todoStats.total}</span>
                                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${todoStats.percent}%` }}></div></div>
                                    </div>
                                    <div className="stat-box" style={{ background: 'linear-gradient(135deg, #d4a017 0%, #8b6508 100%)' }}>
                                        <span className="stat-label" style={{ color: 'rgba(0,0,0,0.6)' }}>DISCIPLINE SCORE</span>
                                        <span className="stat-value" style={{ color: 'black' }}>{Math.round((todoStats.percent + dailyStats.percent) / 2)}%</span>
                                        <p style={{ fontSize: '0.6rem', fontWeight: '900', color: 'rgba(0,0,0,0.5)' }}>OVERALL LEVEL</p>
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
                                                        <p style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '2px' }}>⏱ {formatTime(task.activeTime)}</p>
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
                                                <Image src={chat.artifactUrl} alt="Mission Artifact" style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }} width={800} height={420} />
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2rem 1.5rem 1rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
                                                    <p style={{ fontSize: '0.6rem', fontWeight: '900', letterSpacing: '0.15em', color: 'var(--accent)' }}>MISSION ARTIFACT</p>
                                                    <p style={{ fontSize: '1.1rem', fontWeight: '900', color: 'white' }}>{selectedDate}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* 1st Column (Detailed) vs 2nd Column (Concise) Layout */}
                                        <div className="records-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
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
