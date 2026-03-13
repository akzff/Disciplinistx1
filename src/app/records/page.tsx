'use client';

import { useState, useEffect } from 'react';
import { storage, DailyChat, formatTime } from '@/lib/storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NavigationBar } from '@/components/NavigationBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cloudStorage } from '@/lib/cloudStorage';
import { useData } from '@/lib/DataContext';
import { useUser } from '@clerk/nextjs';
import { useAuthContext } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { EnhancedExportImport } from '@/lib/enhancedExportImport';

// ── Types ────────────────────────────────────────────────

interface StructuredRecord {
    date: string;
    journal?: string;
    headline: string;
    discipline_score: number;
    score_reason: string;
    mood: string;
    energy_arc: string;
    timeline: Array<{ time: string; event: string; outcome: string; note?: string }>;
    stats: {
        dailies_completed: number;
        dailies_total: number;
        todos_completed: number;
        todos_total: number;
        first_message_time?: string;
        last_message_time?: string;
        session_duration_hours?: number;
    };
    execution_log: Array<{ time: string; activity: string; status: string; quality?: string; detail?: string }>;
    behavioral_analysis: { rights: string[]; wrongs: string[] };
    strategic_refinement: Array<{ priority: number; action: string; reason: string; category: string }>;
    coach_verdict: string;
    financial_report?: {
        total_spent: number;
        audit: string;
        categories: Array<{ name: string; amount: number; note: string }>;
    };
    tomorrow_focus: string;
}

interface DbRecord {
    id: string;
    user_id: string;
    date: string;
    content?: string;
    structured_data?: StructuredRecord | null;
    generation_version?: number;
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

// ── Helper: legacy block parser ───────────────────────────
interface ReportBlocks { execution: string; alignment: string; refinement: string; }
function parseBlocks(summary: string): ReportBlocks {
    // Fix literal \n in summary strings that might come from escaped AI responses
    const cleanedSummary = summary.replace(/\\n/g, '\n');
    const extract = (tag: string) => {
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
        const match = cleanedSummary.match(regex);
        return match ? match[1].trim() : '';
    };
    const b1 = extract('block1'), b2 = extract('block2'), b3 = extract('block3');
    if (!b1 && !b2 && !b3) {
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

// ── Sub-components (all inline styles, no Tailwind) ───────

function scoreColor(score: number) {
    if (score >= 80) return '#34d399';
    if (score >= 60) return '#d4a017';
    if (score >= 40) return '#fbbf24';
    return '#f87171';
}

function StatCard({ label, value, accent, progress, sub }: { label: string; value: string; accent: string; progress?: number; sub?: string }) {
    return (
        <div style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '16px' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px', textTransform: 'uppercase' }}>{label}</p>
            <p style={{ color: '#fff', fontSize: '26px', fontWeight: 900, lineHeight: 1 }}>{value}</p>
            {sub && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', marginTop: '4px' }}>{sub}</p>}
            {progress !== undefined && (
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '10px' }}>
                    <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: accent, borderRadius: '2px', transition: 'width 0.8s ease' }} />
                </div>
            )}
        </div>
    );
}

function TimelineRow({ entry }: { entry: { time: string; event: string; outcome: string; note?: string } }) {
    const colors: Record<string, string> = { COMPLETED: '#34d399', FAILED: '#f87171', PARTIAL: '#fbbf24', NOTE: 'rgba(255,255,255,0.4)' };
    const dotColor = colors[entry.outcome] ?? colors.NOTE;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', minWidth: '70px', paddingTop: '2px', fontFamily: 'monospace' }}>{entry.time}</span>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, marginTop: '5px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{entry.event}</span>
                {entry.note && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>{entry.note}</p>}
            </div>
        </div>
    );
}

function SectionCard({ icon, title, accent, children }: { icon: string; title: string; accent: string; children: React.ReactNode }) {
    return (
        <div style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>{icon}</span>
                <span style={{ color: accent, fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em' }}>{title}</span>
            </div>
            <div style={{ padding: '14px 18px' }}>{children}</div>
        </div>
    );
}

function BulletItem({ text, color }: { text: string; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '4px 0' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, marginTop: '6px', flexShrink: 0 }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: 1.5 }}>{text}</span>
        </div>
    );
}

function RefinementItem({ item, index }: { item: { action: string; reason: string; category: string }; index: number }) {
    const catColors: Record<string, string> = { SLEEP: '#60a5fa', WORK: '#d4a017', HEALTH: '#34d399', MINDSET: '#a78bfa', FINANCE: '#fbbf24' };
    const c = catColors[item.category] ?? '#888';
    return (
        <div style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: '#d4a017', fontWeight: 900, fontSize: '14px', minWidth: '20px' }}>{index}.</span>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 600 }}>{item.action}</span>
                    <span style={{ fontSize: '9px', background: `${c}22`, color: c, border: `1px solid ${c}44`, padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>{item.category}</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.reason}</ReactMarkdown>
                </div>
            </div>
        </div>
    );
}

function FinancialReportView({ fr }: { fr: NonNullable<StructuredRecord['financial_report']> }) {
    if (!fr) return null;
    return (
        <SectionCard icon="💰" title="EXPENSE REPORT" accent="#fbbf24">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                    <div>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Daily Total</p>
                        <p style={{ color: '#fff', fontSize: '24px', fontWeight: 900 }}>₹{fr.total_spent || 0}</p>
                    </div>
                </div>
                
                {fr.audit && (
                    <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.1)', padding: '12px', borderRadius: '10px' }}>
                        <p style={{ color: '#fbbf24', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>Financial Audit</p>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontStyle: 'italic' }}>&quot;{fr.audit}&quot;</p>
                    </div>
                )}

                {fr.categories && fr.categories.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {fr.categories.map((cat: { name: string; amount: number; note: string }, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', padding: '3px 8px', borderRadius: '100px', fontWeight: 800 }}>{cat.name}</span>
                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{cat.note}</span>
                                </div>
                                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>₹{cat.amount}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

function EditRecordModal({ dbRecord, onSave, onClose }: { dbRecord: DbRecord, onSave: (data: Partial<StructuredRecord>) => void, onClose: () => void }) {
    const struct = dbRecord.structured_data;
    const [journal, setJournal] = useState(struct?.journal || '');
    const [verdict, setVerdict] = useState(struct?.coach_verdict || '');
    const [headline, setHeadline] = useState(struct?.headline || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await onSave({ journal, coach_verdict: verdict, headline });
        setIsSaving(false);
        onClose();
    };
    
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', width: '100%', maxWidth: '850px', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                <div style={{ padding: '24px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 900 }}>Edit Record</h3>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>Refine your narrative, Disciple.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#666', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
                <div style={{ padding: '30px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ color: '#d4a017', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', display: 'block', letterSpacing: '0.1em' }}>Daily Headline</label>
                        <input value={headline} onChange={e => setHeadline(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '14px', borderRadius: '12px', fontSize: '16px' }} />
                    </div>
                    <div>
                        <label style={{ color: '#d4a017', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', display: 'block', letterSpacing: '0.1em' }}>Detailed Journal</label>
                        <textarea value={journal} onChange={e => setJournal(e.target.value)} style={{ width: '100%', minHeight: '450px', background: '#111', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '18px', borderRadius: '12px', fontSize: '15px', lineHeight: 1.7, resize: 'vertical' }} />
                    </div>
                    <div>
                        <label style={{ color: '#d4a017', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', display: 'block', letterSpacing: '0.1em' }}>Coach Verdict</label>
                        <textarea value={verdict} onChange={e => setVerdict(e.target.value)} style={{ width: '100%', minHeight: '120px', background: '#111', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '16px', borderRadius: '12px', fontSize: '15px', lineHeight: 1.6, resize: 'vertical' }} />
                    </div>
                </div>
                <div style={{ padding: '24px 30px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '16px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, cursor: 'pointer' }}>Discard</button>
                    <button onClick={handleSave} disabled={isSaving} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#d4a017', color: '#000', fontWeight: 900, border: 'none', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                        {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Structured Record Renderer ────────────────────────────
function StructuredRecordView({ r }: { r: StructuredRecord }) {
    const sortedTimeline = [...(r.timeline ?? [])].sort((a, b) => {
        const toMinutes = (t: string) => {
            const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!m) return 0;
            let h = parseInt(m[1]); const min = parseInt(m[2]); const ampm = m[3].toUpperCase();
            if (ampm === 'PM' && h !== 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            return h * 60 + min;
        };
        return toMinutes(a.time) - toMinutes(b.time);
    });

    const s = r.stats ?? {};
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Headline Card */}
            <div style={{ background: 'linear-gradient(135deg, #1a1500, #0f0f0f)', border: '1px solid rgba(212,160,23,0.25)', borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                    <p style={{ color: '#d4a017', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', marginBottom: '6px' }}>
                        {r.mood} · {(r.energy_arc ?? '').replace(/_/g, ' ')}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '16px', fontWeight: 600, lineHeight: 1.4 }}>
                        &quot;{r.headline}&quot;
                    </p>
                    {r.score_reason && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '8px' }}>{r.score_reason}</p>}
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <p style={{ fontSize: '40px', fontWeight: 900, color: scoreColor(r.discipline_score ?? 0), lineHeight: 1 }}>{r.discipline_score ?? '—'}</p>
                    <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginTop: '2px' }}>DISCIPLINE</p>
                </div>
            </div>

            {/* Journal (Most Important) */}
            {r.journal && (
                <div style={{ background: '#0f0f0f', border: '1px solid rgba(245,200,66,0.15)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(245,200,66,0.03)' }}>
                        <span style={{ fontSize: '20px' }}>📓</span>
                        <span style={{ color: '#f5c842', fontSize: '12px', fontWeight: 900, letterSpacing: '0.15em' }}>DAILY JOURNAL</span>
                    </div>
                    <div style={{ padding: '28px 32px', color: 'rgba(255,255,255,0.85)', fontSize: '15px', lineHeight: 1.8, letterSpacing: '0.01em' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.journal}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <StatCard label="DAILIES" value={`${s.dailies_completed ?? 0}/${s.dailies_total ?? 0}`} accent="#34d399" progress={s.dailies_total ? (s.dailies_completed ?? 0) / s.dailies_total : 0} />
                <StatCard label="TO-DOS" value={`${s.todos_completed ?? 0}/${s.todos_total ?? 0}`} accent="#a78bfa" progress={s.todos_total ? (s.todos_completed ?? 0) / s.todos_total : 0} />
                <StatCard label="SESSION" value={s.session_duration_hours != null ? `${Number(s.session_duration_hours).toFixed(1)}h` : '—'} accent="#d4a017" sub={s.first_message_time && s.last_message_time ? `${s.first_message_time} → ${s.last_message_time}` : undefined} />
            </div>

            {/* Timeline */}
            {sortedTimeline.length > 0 && (
                <SectionCard icon="⏱" title="DAY TIMELINE" accent="#d4a017">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {sortedTimeline.map((entry, i) => <TimelineRow key={i} entry={entry} />)}
                    </div>
                </SectionCard>
            )}

            {/* Execution Log */}
            {(r.execution_log ?? []).length > 0 && (
                <SectionCard icon="📋" title="DAY EXECUTION LOG" accent="#60a5fa">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {r.execution_log.map((item, i) => {
                            const statusColors: Record<string, string> = { COMPLETED: '#34d399', FAILED: '#f87171', PARTIAL: '#fbbf24' };
                            const c = statusColors[item.status] ?? 'rgba(255,255,255,0.4)';
                            return (
                                <div key={i} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.25)', minWidth: '70px', paddingTop: '2px' }}>{item.time}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 600 }}>{item.activity}</span>
                                            <span style={{ fontSize: '9px', color: c, border: `1px solid ${c}66`, padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>{item.status}</span>
                                        </div>
                                        {item.detail && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>{item.detail}</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            )}

            {/* Behavioral Alignment */}
            {((r.behavioral_analysis?.rights?.length ?? 0) > 0 || (r.behavioral_analysis?.wrongs?.length ?? 0) > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {(r.behavioral_analysis?.rights?.length ?? 0) > 0 && (
                        <SectionCard icon="✅" title="WHAT WENT RIGHT" accent="#34d399">
                            {r.behavioral_analysis.rights.map((item, i) => <BulletItem key={i} text={item} color="#34d399" />)}
                        </SectionCard>
                    )}
                    {(r.behavioral_analysis?.wrongs?.length ?? 0) > 0 && (
                        <SectionCard icon="❌" title="WHAT WENT WRONG" accent="#f87171">
                            {r.behavioral_analysis.wrongs.map((item, i) => <BulletItem key={i} text={item} color="#f87171" />)}
                        </SectionCard>
                    )}
                </div>
            )}

            {/* Strategic Refinement */}
            {(r.strategic_refinement ?? []).length > 0 && (
                <SectionCard icon="🎯" title="STRATEGIC REFINEMENT" accent="#d4a017">
                    {r.strategic_refinement.map((item, i) => <RefinementItem key={i} item={item} index={i + 1} />)}
                </SectionCard>
            )}

            {/* Financial Report */}
            {r.financial_report && <FinancialReportView fr={r.financial_report} />}

            {/* Coach Verdict */}
            {r.coach_verdict && (
                <div style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #d4a017', borderRadius: '12px', padding: '16px 20px' }}>
                    <p style={{ color: '#d4a017', fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', marginBottom: '8px' }}>COACH VERDICT</p>
                <div className="block-markdown" style={{ fontSize: '14px', opacity: 0.8 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.coach_verdict || ''}</ReactMarkdown>
                </div>
                </div>
            )}

            {/* Tomorrow Focus */}
            {r.tomorrow_focus && (
                <div style={{ background: 'linear-gradient(135deg, #0f1a0f, #0f0f0f)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>🌅</span>
                    <div>
                        <p style={{ color: '#34d399', fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', marginBottom: '4px' }}>TOMORROW&apos;S FOCUS</p>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: 600 }}>{r.tomorrow_focus}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Legacy Text Renderer ──────────────────────────────────
function LegacyRecordView({ chat }: { chat: DailyChat }) {
    const blocks = chat.aiSummary ? parseBlocks(chat.aiSummary) : null;
    const blockCards = [
        { icon: '📋', label: 'Day Execution Log', sub: 'What actually happened', color: '#a78bfa', content: blocks?.execution || '' },
        { icon: '⚖️', label: 'Behavioral Alignment', sub: 'Right moves & wrong turns', color: '#10b981', content: blocks?.alignment || '' },
        { icon: '🎯', label: 'Strategic Refinement', sub: "Tomorrow's corrections", color: '#f59e0b', content: blocks?.refinement || '' },
    ];

    if (!blocks) {
        return (
            <div style={{ padding: '5rem 0', textAlign: 'center', opacity: 0.3 }}>
                <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌓</p>
                <p style={{ fontWeight: '800', letterSpacing: '0.1em' }}>WAITING FOR END-OF-DAY DEBRIEF</p>
                <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>Generate a report to see the Disciplinist&apos;s assessment of your day.</p>
            </div>
        );
    }

    return (
        <div className="records-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
            <div className="block-card detailed" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: `1px solid ${blockCards[0].color}30` }}>
                    <div style={{ padding: '8px', borderRadius: '12px', background: `${blockCards[0].color}15`, fontSize: '1.4rem' }}>{blockCards[0].icon}</div>
                    <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: '900', color: blockCards[0].color, letterSpacing: '0.1em' }}>{blockCards[0].label.toUpperCase()}</p>
                        <p style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '2px' }}>{blockCards[0].sub}</p>
                    </div>
                </div>
                {blockCards[0].content ? (
                    <div className="block-markdown detailed-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{blockCards[0].content}</ReactMarkdown>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, padding: '3.5rem 2rem' }}>
                        <p style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>No telemetry data for this cycle.</p>
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {[1, 2].map((idx) => (
                    <div key={idx} className="block-card concise" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: `1px solid ${blockCards[idx].color}30` }}>
                            <div style={{ padding: '8px', borderRadius: '12px', background: `${blockCards[idx].color}15`, fontSize: '1.4rem' }}>{blockCards[idx].icon}</div>
                            <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: '900', color: blockCards[idx].color, letterSpacing: '0.1em' }}>{blockCards[idx].label.toUpperCase()}</p>
                                <p style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '2px' }}>{blockCards[idx].sub}</p>
                            </div>
                        </div>
                        {blockCards[idx].content ? (
                            <div className="block-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{blockCards[idx].content}</ReactMarkdown></div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2, padding: '1rem' }}>
                                <p style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>Awaiting sync...</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────
export default function RecordsPage() {
    const { allChats, preferences: globalPrefs, setLocalChat, isSettingsOpen, setIsSettingsOpen } = useData();
    const { user } = useUser();
    const { signOut } = useAuthContext();
    const [selectedDate, setSelectedDate] = useState('');
    const [chat, setChat] = useState<DailyChat | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [dbRecord, setDbRecord] = useState<DbRecord | null>(null);
    const [loadingRecord, setLoadingRecord] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const today = storage.getCurrentDate();
        setSelectedDate(today);
    }, []);

    useEffect(() => {
        if (selectedDate) setChat(allChats[selectedDate] || null);
    }, [selectedDate, allChats]);

    // Fetch structured record from DB when date changes
    useEffect(() => {
        if (!selectedDate || !user?.id) { setDbRecord(null); return; }
        setLoadingRecord(true);
        supabase
            .from('records')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', selectedDate)
            .maybeSingle()
            .then(({ data }) => {
                setDbRecord(data as DbRecord | null);
                setLoadingRecord(false);
            });
    }, [selectedDate, user?.id]);

    const allDates = Object.keys(allChats).sort().reverse();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculateStats = (items: any[]) => {
        if (!items || items.length === 0) return { total: 0, completed: 0, percent: 0 };
        const completed = items.filter(i => i.completed).length;
        return { total: items.length, completed, percent: Math.round((completed / items.length) * 100) };
    };
    const todoStats = calculateStats(chat?.todos || []);
    const dailyStats = calculateStats(chat?.dailies || []);

    const generateReport = async () => {
        if (!chat || !user?.id) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/generate-record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    date: selectedDate,
                    chatData: chat,
                    autoTriggered: false
                })
            });
            if (!res.ok) throw new Error('Generation failed');
            const result = await res.json();

            if (result.structured_data) {
                setDbRecord({ id: '', user_id: user.id, date: selectedDate, structured_data: result.structured_data, generation_version: 2 });
            } else {
                // Legacy fallback
                const fallbackSummary = result.content || '';
                setLocalChat(selectedDate, { aiSummary: fallbackSummary });
                cloudStorage.saveChat(selectedDate, { aiSummary: fallbackSummary }, user.id);
                setChat(prev => prev ? { ...prev, aiSummary: fallbackSummary } : null);
            }
        } catch (error) {
            console.error(error);
            alert('Mission analysis failed. Try again, Disciple.');
        } finally {
            setIsGenerating(false);
        }
    };

    const saveRecordEdit = async (updatedFields: Partial<StructuredRecord>) => {
        if (!dbRecord || !user?.id) return;
        const newStructuredData = {
            ...dbRecord.structured_data,
            ...updatedFields
        };

        const { error } = await supabase
            .from('records')
            .upsert({
                user_id: user.id,
                date: selectedDate,
                structured_data: newStructuredData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,date' });

        if (error) {
            alert('Failed to save edits to the cloud.');
        } else {
            setDbRecord({
                ...dbRecord,
                structured_data: newStructuredData as StructuredRecord
            });
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const exportData = await EnhancedExportImport.exportAllData(user?.id);
            EnhancedExportImport.downloadFile(exportData, EnhancedExportImport.generateFilename());
        } catch (error) {
            alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally { setIsExporting(false); }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        try {
            const content = await file.text();
            const preview: ImportPreview = await EnhancedExportImport.getImportPreview(content);
            const confirmMessage = `Import this data?\n\n📊 Summary:\n• ${preview.preview.totalChats} chats (${preview.preview.dateRange.earliest} to ${preview.preview.dateRange.latest})\n• Preferences: ${preview.preview.hasPreferences ? 'Yes' : 'No'}\n• Version: ${preview.preview.version}\n• Exported: ${new Date(preview.preview.exportDate).toLocaleDateString()}${preview.preview.warnings.length > 0 ? `\n\n⚠️ Warnings:\n${preview.preview.warnings.join('\n')}` : ''}\n\nContinue?`;
            if (!confirm(confirmMessage)) return;
            const result = await EnhancedExportImport.importAllData(content, user?.id);
            if (result.success) { alert(`✅ ${result.message}\n\nPage will reload.`); setTimeout(() => window.location.reload(), 1000); }
            else alert(`❌ Import failed:\n${result.errors.join('\n')}`);
        } catch (error) {
            alert(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally { setIsImporting(false); event.target.value = ''; }
    };

    const isStructured = dbRecord?.generation_version === 2 && dbRecord?.structured_data != null;
    const hasAnyRecord = isStructured || (chat?.aiSummary != null);

    void globalPrefs;
    void isSettingsOpen;
    void setIsSettingsOpen;
    void formatTime;

    return (
        <main>
            <div className="bg-mesh"></div>
            <div className="chat-container" style={{ maxHeight: '95vh', overflow: 'hidden' }}>
                <header className="chat-header">
                    <div className="chat-header__left" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="status-indicator" style={{ '--mood-color': '#6b7280' } as React.CSSProperties}></div>
                        <h1 className="app-title"><span className="app-title__brand">DISCIPLINIST</span></h1>
                    </div>
                    <div className="nav-center-wrapper desktop-only" style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
                        <NavigationBar />
                    </div>
                    <div className="header-controls" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div className="profile-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '900' }}>
                                    {user?.primaryEmailAddress?.emailAddress?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className="mobile-hidden" style={{ fontSize: '0.7rem', opacity: 0.7, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>{user?.primaryEmailAddress?.emailAddress || 'User'}</span>
                                <button onClick={signOut} title="Sign Out" className="logout-btn" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="sidebar-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div className="sidebar-panel" style={{ width: '220px', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '1rem', flexShrink: 0 }}>
                        <h3 style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Day History</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {allDates.map(date => (
                                <button key={date} onClick={() => setSelectedDate(date)} style={{ padding: '10px 12px', borderRadius: '8px', background: selectedDate === date ? '#d4a017' : 'transparent', border: selectedDate === date ? 'none' : '1px solid transparent', color: selectedDate === date ? 'black' : 'white', textAlign: 'left', fontSize: '0.82rem', fontWeight: selectedDate === date ? '900' : '500', cursor: 'pointer', transition: 'all 0.2s', boxShadow: selectedDate === date ? '0 0 12px rgba(212,160,23,0.3)' : 'none' }}>
                                    {date}{date === storage.getCurrentDate() && <span style={{ fontSize: '0.6rem', marginLeft: '6px', opacity: 0.7 }}>TODAY</span>}
                                </button>
                            ))}
                        </div>
                        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h3 style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Data</h3>
                            <button onClick={handleExport} disabled={isExporting} style={{ padding: '9px', borderRadius: '8px', background: isExporting ? 'rgba(212, 160, 23, 0.15)' : 'transparent', border: '1px solid rgba(212, 160, 23, 0.25)', color: 'rgba(212, 160, 23, 0.7)', fontSize: '0.72rem', fontWeight: '800', cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.7 : 1 }}>
                                {isExporting ? '📤 EXPORTING...' : '📤 EXPORT'}
                            </button>
                            <label style={{ padding: '9px', borderRadius: '8px', background: isImporting ? 'rgba(239, 68, 68, 0.2)' : 'transparent', border: '1px solid rgba(212, 160, 23, 0.25)', color: 'rgba(212, 160, 23, 0.7)', fontSize: '0.72rem', fontWeight: '800', cursor: isImporting ? 'not-allowed' : 'pointer', textAlign: 'center', display: 'block', opacity: isImporting ? 0.7 : 1 }}>
                                <input type="file" accept=".json" onChange={handleImport} disabled={isImporting} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: isImporting ? 'not-allowed' : 'pointer' }} />
                                {isImporting ? '📥 IMPORTING...' : '📥 IMPORT'}
                            </label>
                        </div>
                    </div>

                    {/* Report Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
                        {chat ? (
                            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                                {/* Header Row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                                    <div>
                                        <h2 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'white', lineHeight: 1 }}>{selectedDate}</h2>
                                        <p style={{ opacity: 0.4, fontWeight: '600', fontSize: '0.75rem', marginTop: '4px', letterSpacing: '0.1em' }}>
                                            {isStructured ? 'STRUCTURED RECORD v2' : 'DAY SUMMARY'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {isStructured && (
                                            <button 
                                                onClick={() => setIsEditing(true)} 
                                                style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                            >
                                                ✎ EDIT
                                            </button>
                                        )}
                                        <button onClick={generateReport} disabled={isGenerating} className="start-day-btn" style={{ margin: 0, padding: '0.75rem 1.4rem', fontSize: '0.78rem' }}>
                                            {isGenerating ? '⏳ ANALYZING...' : hasAnyRecord ? '↻ RE-GENERATE' : '✦ GENERATE AI REPORT'}
                                        </button>
                                    </div>
                                </div>

                                {/* Quick stats (always shown) */}
                                {!isStructured && (
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
                                )}

                                {/* Completed tasks */}
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

                                {loadingRecord ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.4 }}>
                                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                                            {[0, 1, 2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d4a017', animation: `dot-pulse 1s ${i * 0.2}s infinite` }} />)}
                                        </div>
                                    </div>
                                ) : isStructured ? (
                                    <StructuredRecordView r={dbRecord!.structured_data!} />
                                ) : (
                                    <LegacyRecordView chat={chat} />
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                <p>Select a cycle from the history.</p>
                            </div>
                        )}
                    </div>
                </div>
                <MobileBottomNav />
            </div>

            {isEditing && dbRecord && (
                <EditRecordModal 
                    dbRecord={dbRecord} 
                    onSave={saveRecordEdit} 
                    onClose={() => setIsEditing(false)} 
                />
            )}

            <style jsx>{`
                .stat-box { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; }
                .stat-label { font-size: 0.6rem; font-weight: 900; opacity: 0.5; letter-spacing: 0.12em; text-transform: uppercase; }
                .stat-value { font-size: 1.6rem; font-weight: 900; margin: 0.4rem 0; color: white; }
                .progress-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-top: auto; }
                .progress-fill { height: 100%; transition: width 0.6s ease; background: var(--accent); }
                .block-card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; min-height: 280px; display: flex; flex-direction: column; }
                .block-markdown { font-size: 0.82rem; line-height: 1.7; flex: 1; }
                .detailed-markdown { font-size: 0.88rem; }
                .block-markdown :global(p) { opacity: 0.75; margin-bottom: 0.8rem; }
                .block-markdown :global(ul), .block-markdown :global(ol) { padding-left: 1.2rem; margin: 0.5rem 0; }
                .block-markdown :global(li) { opacity: 0.9; margin-bottom: 0.6rem; font-size: 0.85rem; line-height: 1.6; color: rgba(255,255,255,0.95); }
                .detailed-markdown :global(li) { margin-bottom: 1rem !important; font-weight: 500; }
                .block-markdown :global(strong) { color: white; font-weight: 700; }
                .block-markdown :global(h3), .block-markdown :global(h4) { font-size: 0.75rem; font-weight: 900; color: white; margin: 1rem 0 0.5rem 0; letter-spacing: 0.05em; }
                @keyframes dot-pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
            `}</style>
        </main>
    );
}
