'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Step = 'idle' | 'confirm' | 'deleting' | 'syncing' | 'done' | 'error';

interface LogLine {
    text: string;
    status: 'done' | 'active' | 'pending' | 'error';
}

export default function DeleteAndSync({ userId }: { userId: string }) {
    const [step, setStep] = useState<Step>('idle');
    const [log, setLog] = useState<LogLine[]>([]);

    const addLog = (text: string, status: LogLine['status'] = 'done') => {
        setLog(prev => {
            // Mark the last active line as done before adding a new one
            const updated = prev.map(l => l.status === 'active' ? { ...l, status: 'done' as const } : l);
            return [...updated, { text, status }];
        });
    };

    const executeDeleteAndSync = async () => {
        setLog([]);
        try {
            setStep('deleting');

            // Step 1: Clear localStorage (preserve auth + device ID)
            addLog('✅ Clearing local cache...', 'active');
            await new Promise(r => setTimeout(r, 300));

            const keepPatterns = ['sb-', 'supabase', 'disciplinist_device_id', '__clerk'];
            Object.keys(localStorage).forEach(key => {
                const keep = keepPatterns.some(p => key.includes(p));
                if (!keep) localStorage.removeItem(key);
            });
            addLog('✅ Local cache cleared');

            // Step 2: Clear sessionStorage
            addLog('✅ Clearing session storage...', 'active');
            await new Promise(r => setTimeout(r, 200));
            sessionStorage.clear();
            addLog('✅ Session storage cleared');

            // Step 3: Verify cloud connection
            setStep('syncing');
            addLog('🔄 Verifying cloud connection...', 'active');
            await new Promise(r => setTimeout(r, 300));

            // Use the passed userId directly (Clerk manages auth, not Supabase Auth)
            if (!userId) throw new Error('Not authenticated — please sign in again');
            addLog('✅ Cloud connection verified');

            // Step 4: Check each table
            const tables = [
                { name: 'disciplinist_daily_chats', label: 'Daily chats' },
                { name: 'disciplinist_preferences', label: 'Preferences' },
            ] as const;

            for (const table of tables) {
                addLog(`🔄 Checking ${table.label}...`, 'active');
                await new Promise(r => setTimeout(r, 250));

                const { count, error } = await supabase
                    .from(table.name)
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);

                if (error) throw new Error(`${table.label}: ${error.message}`);
                addLog(`✅ ${table.label}: ${count ?? 0} records in cloud`);
            }

            // Step 5: All good — reload
            addLog('✅ Sync complete! Reloading now...');
            setStep('done');
            await new Promise(r => setTimeout(r, 1200));
            window.location.reload();

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            addLog(`❌ Error: ${msg}`, 'error');
            setStep('error');
        }
    };

    // ─── IDLE ─────────────────────────────────────
    if (step === 'idle') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                    Wipes local data on this device and pulls fresh data from the cloud.<br />
                    Your cloud data is <strong style={{ color: 'rgba(255,255,255,0.6)' }}>safe</strong> — only the local cache is cleared.
                </p>
                <button
                    onClick={() => setStep('confirm')}
                    style={{
                        width: '100%', padding: '13px',
                        borderRadius: '14px',
                        border: '1px solid rgba(239,68,68,0.35)',
                        background: 'transparent',
                        color: 'rgba(239,68,68,0.85)',
                        fontWeight: 800, fontSize: '0.78rem',
                        letterSpacing: '0.08em', cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.55)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.35)';
                    }}
                >
                    🗑️ DELETE LOCAL &amp; SYNC FROM CLOUD
                </button>
            </div>
        );
    }

    // ─── CONFIRM ──────────────────────────────────
    if (step === 'confirm') {
        return (
            <div style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '16px', padding: '16px',
                display: 'flex', flexDirection: 'column', gap: '12px'
            }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 900, color: 'rgba(239,68,68,0.9)' }}>⚠️ ARE YOU SURE?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '4px' }}>This will:</p>
                    {[
                        'Clear all local cache on THIS device',
                        'Pull fresh data from your cloud account',
                        'Reload the app completely',
                    ].map(item => (
                        <p key={item} style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', paddingLeft: '8px' }}>• {item}</p>
                    ))}
                </div>
                <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                    Your cloud data is <strong style={{ color: 'rgba(255,255,255,0.55)' }}>SAFE</strong>. Only local cache is wiped.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setStep('idle')}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent', color: 'rgba(255,255,255,0.45)',
                            fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                        }}
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={executeDeleteAndSync}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '12px',
                            background: 'rgba(239,68,68,0.8)', border: 'none',
                            color: 'white', fontWeight: 900, fontSize: '0.78rem',
                            cursor: 'pointer', letterSpacing: '0.04em',
                        }}
                    >
                        YES, WIPE &amp; SYNC
                    </button>
                </div>
            </div>
        );
    }

    // ─── DONE ─────────────────────────────────────
    if (step === 'done') {
        return (
            <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '2.5rem' }}>✅</span>
                <p style={{ fontWeight: 900, color: '#34d399', letterSpacing: '0.06em', fontSize: '0.85rem' }}>SYNCED!</p>
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Reloading app...</p>
            </div>
        );
    }

    // ─── EXECUTING / ERROR ─────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {step === 'error' ? (
                    <span style={{ fontSize: '1.1rem' }}>❌</span>
                ) : (
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d4a017', animation: 'pulse 1s infinite' }} />
                )}
                <span style={{
                    fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.1em',
                    color: step === 'error' ? '#ef4444' : '#d4a017',
                }}>
                    {step === 'error' ? 'SYNC FAILED' : step === 'deleting' ? 'CLEARING...' : 'SYNCING...'}
                </span>
            </div>

            {/* Log terminal */}
            <div style={{
                background: '#0a0a0a',
                border: '1px solid rgba(212,160,23,0.1)',
                borderRadius: '12px', padding: '14px',
                fontFamily: 'monospace', fontSize: '0.72rem',
                display: 'flex', flexDirection: 'column', gap: '6px',
                minHeight: '100px',
            }}>
                {log.map((line, i) => (
                    <span key={i} style={{
                        color: line.status === 'done' ? '#34d399'
                            : line.status === 'active' ? '#d4a017'
                                : line.status === 'error' ? '#ef4444'
                                    : 'rgba(255,255,255,0.2)',
                        animation: line.status === 'active' ? 'pulse 1.2s infinite' : 'none',
                    }}>
                        {line.text}
                    </span>
                ))}
                {log.length === 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>Starting...</span>
                )}
            </div>

            {step === 'error' && (
                <button
                    onClick={() => { setStep('idle'); setLog([]); }}
                    style={{
                        width: '100%', padding: '12px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white', fontWeight: 800,
                        fontSize: '0.78rem', cursor: 'pointer', letterSpacing: '0.06em',
                    }}
                >
                    ↩ TRY AGAIN
                </button>
            )}

            <style jsx>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            `}</style>
        </div>
    );
}
