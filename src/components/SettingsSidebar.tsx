'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { UserPreferences } from '@/lib/storage';
import { useData } from '@/lib/DataContext';
import { useAuthContext } from '@/lib/AuthContext';

// ─── Force Sync Step type ─────────────────────────
type SyncStep = 'idle' | 'confirming' | 'wiping' | 'fetching' | 'done' | 'error';

// ─── Step pill component ──────────────────────────
function StepPill({ label, state }: { label: string; state: 'done' | 'active' | 'pending' }) {
    const styles: Record<typeof state, React.CSSProperties> = {
        done: { background: '#d4a017', color: 'black', fontWeight: 900, padding: '4px 12px', borderRadius: '100px', fontSize: '0.65rem', letterSpacing: '0.06em' },
        active: { border: '1px solid #d4a017', color: '#d4a017', fontWeight: 800, padding: '4px 12px', borderRadius: '100px', fontSize: '0.65rem', letterSpacing: '0.06em', animation: 'pulse 1.5s infinite' },
        pending: { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.2)', fontWeight: 700, padding: '4px 12px', borderRadius: '100px', fontSize: '0.65rem', letterSpacing: '0.06em' },
    };
    return <span style={styles[state]}>{state === 'done' ? '✅ ' : ''}{label}</span>;
}

export default function SettingsSidebar() {
    const { preferences, updatePreferences, isSettingsOpen, setIsSettingsOpen } = useData();
    const { user } = useAuthContext();

    // ─── Account ID ───────────────────────────────
    const [copied, setCopied] = useState(false);

    // ─── Force Sync ───────────────────────────────
    const [targetId, setTargetId] = useState('');
    const [syncStep, setSyncStep] = useState<SyncStep>('idle');
    const [syncProgress, setSyncProgress] = useState('');

    // ─── Preferences (local draft) ────────────────
    const [draft, setDraft] = useState<Partial<UserPreferences>>({});

    useEffect(() => {
        if (preferences) setDraft({});
    }, [isSettingsOpen, preferences]);

    if (!isSettingsOpen) return null;

    const updateProfile = (updates: Partial<UserPreferences>) => {
        updatePreferences(updates);
    };

    const handlePfpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => updateProfile({ pfp: reader.result as string });
        reader.readAsDataURL(file);
    };

    const handleCopyId = async () => {
        if (!user?.id) return;
        await navigator.clipboard.writeText(user.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const isValidUUID = (val: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const handleForceSyncClick = () => {
        if (!targetId.trim()) { alert('Please paste an Account ID first.'); return; }
        if (!isValidUUID(targetId.trim())) { alert('Invalid Account ID format. Must be a UUID like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'); return; }
        setSyncStep('confirming');
    };

    const executeForceSync = async () => {
        try {
            setSyncStep('wiping');
            setSyncProgress('Wiping local device data...');

            const res = await fetch('/api/force-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetAccountId: targetId.trim(),
                    requestingUserId: user?.id ?? '',
                }),
            });

            if (!res.ok) throw new Error(await res.text());

            setSyncStep('fetching');
            setSyncProgress('Pulling data from target account...');

            // Small delay to show fetching state
            await new Promise(r => setTimeout(r, 800));

            setSyncStep('done');
            setSyncProgress('Sync complete! Reloading in 1 second...');

            setTimeout(() => {
                localStorage.setItem('force_sync_account_id', targetId.trim());
                window.location.reload();
            }, 1500);

        } catch {
            setSyncStep('error');
            setSyncProgress('Sync failed. Check the Account ID and try again.');
        }
    };

    // ─── Sync Progress UI ─────────────────────────
    if (syncStep === 'wiping' || syncStep === 'fetching' || syncStep === 'done' || syncStep === 'error') {
        return (
            <>
                {/* Backdrop */}
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
                    onClick={() => syncStep === 'error' && setSyncStep('idle')}
                >
                    <div style={{ background: '#0f0f0f', borderTop: '1px solid rgba(212,160,23,0.2)', borderRadius: '24px 24px 0 0', padding: '2rem', maxHeight: '88vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '48px', height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', margin: '0 auto 1.5rem' }} />
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            {syncStep !== 'error' ?
                                <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚡</p> :
                                <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>❌</p>
                            }
                            <h3 style={{ fontWeight: 900, fontSize: '1.2rem', color: syncStep === 'error' ? '#ff4444' : '#d4a017', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                                {syncStep === 'done' ? '✅ SYNC COMPLETE' : syncStep === 'error' ? 'SYNC FAILED' : '⚡ SYNCING...'}
                            </h3>
                            <p style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '2rem' }}>{syncProgress}</p>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                <StepPill label="WIPING" state={syncStep === 'wiping' ? 'active' : syncStep === 'fetching' || syncStep === 'done' ? 'done' : 'pending'} />
                                <StepPill label="FETCHING" state={syncStep === 'fetching' ? 'active' : syncStep === 'done' ? 'done' : 'pending'} />
                                <StepPill label="DONE" state={syncStep === 'done' ? 'done' : 'pending'} />
                            </div>
                            {syncStep === 'error' && (
                                <button onClick={() => setSyncStep('idle')} style={{ background: '#d4a017', color: 'black', border: 'none', borderRadius: '100px', padding: '10px 28px', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.08em' }}>TRY AGAIN</button>
                            )}
                        </div>
                    </div>
                </div>
                <style jsx>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }`}</style>
            </>
        );
    }

    // ─── Confirmation gate ────────────────────────
    if (syncStep === 'confirming') {
        return (
            <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
                    onClick={() => setSyncStep('idle')}>
                    <div style={{ background: '#0f0f0f', borderTop: '1px solid rgba(212,160,23,0.2)', borderRadius: '24px 24px 0 0', padding: '2rem', maxHeight: '88vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '48px', height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', margin: '0 auto 1.5rem' }} />
                        <h3 style={{ fontWeight: 900, color: '#d4a017', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>⚠️ ARE YOU ABSOLUTELY SURE?</h3>
                        <p style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '1rem' }}>Syncing to:</p>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#f5c842', background: '#0a0a0a', border: '1px solid rgba(212,160,23,0.15)', borderRadius: '10px', padding: '10px 14px', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
                            {targetId.trim()}
                        </div>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>This will:</p>
                        <ul style={{ fontSize: '0.78rem', opacity: 0.65, paddingLeft: '1.2rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <li>Delete all your todos on this device</li>
                            <li>Delete all your dailies on this device</li>
                            <li>Delete all your records on this device</li>
                            <li>Delete all your chat history here</li>
                            <li>Pull fresh data from the target account</li>
                        </ul>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => { setSyncStep('idle'); setTargetId(''); }} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '14px', padding: '14px', fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem' }}>CANCEL</button>
                            <button onClick={executeForceSync} style={{ flex: 1, background: '#d4a017', color: 'black', border: 'none', borderRadius: '14px', padding: '14px', fontWeight: 900, cursor: 'pointer', fontSize: '0.82rem', letterSpacing: '0.05em', boxShadow: '0 0 24px rgba(212,160,23,0.4)' }}>YES, WIPE &amp; SYNC</button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // ─── Main Settings Panel ──────────────────────
    const forceSyncBannerActive = typeof window !== 'undefined' && localStorage.getItem('force_sync_account_id');

    return (
        <>
            {/* Backdrop */}
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
                onClick={() => setIsSettingsOpen(false)}
            >
                {/* Bottom Sheet */}
                <div
                    style={{ background: '#0f0f0f', borderTop: '1px solid rgba(212,160,23,0.2)', borderRadius: '24px 24px 0 0', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1)' }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Drag handle */}
                    <div style={{ width: '48px', height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', margin: '12px auto 4px', flexShrink: 0 }} />

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                        <span style={{ fontWeight: 900, color: 'white', letterSpacing: '0.1em', fontSize: '0.85rem' }}>SETTINGS</span>
                        <button onClick={() => setIsSettingsOpen(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', transition: 'color 0.2s' }}>✕</button>
                    </div>

                    {/* Scrollable content */}
                    <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>

                        {/* Force Sync Banner */}
                        {forceSyncBannerActive && (
                            <div style={{ background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.3)', borderRadius: '14px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ fontSize: '0.75rem', color: '#d4a017', fontWeight: 700 }}>⚡ Viewing synced data from another account</p>
                                <button onClick={() => { localStorage.removeItem('force_sync_account_id'); window.location.reload(); }} style={{ background: '#d4a017', border: 'none', color: 'black', borderRadius: '100px', padding: '4px 12px', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: '8px' }}>RESTORE</button>
                            </div>
                        )}

                        {/* — PROFILE CARD — */}
                        <div style={{ background: '#141414', border: '1px solid rgba(212,160,23,0.15)', borderRadius: '20px', padding: '16px' }}>
                            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#d4a017', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Profile</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    {preferences?.pfp ? (
                                        <Image src={preferences.pfp} alt="pfp" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(212,160,23,0.4)' }} width={56} height={56} />
                                    ) : (
                                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #d4a017, #b8860b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 900, color: 'black' }}>
                                            {preferences?.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                    <label style={{ position: 'absolute', bottom: -2, right: -2, width: '22px', height: '22px', borderRadius: '50%', background: '#d4a017', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'black', fontSize: '0.7rem', fontWeight: 900 }}>
                                        <input type="file" hidden onChange={handlePfpUpload} accept="image/*" />
                                        +
                                    </label>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <input className="settings-input" style={{ fontSize: '0.95rem', fontWeight: 900, width: '100%', marginBottom: '6px' }} placeholder="Your Name" value={preferences?.name ?? ''} onChange={e => updateProfile({ name: e.target.value })} />
                                    <input className="settings-input" style={{ fontSize: '0.75rem', opacity: 0.55, width: '100%' }} placeholder="Add a bio..." value={preferences?.bio ?? ''} onChange={e => updateProfile({ bio: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* — MENTORING INTENSITY — */}
                        <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#d4a017', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Mentoring Intensity</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {([1, 2, 3] as const).map(lvl => {
                                    const active = preferences?.mentorLevel === lvl;
                                    return (
                                        <button key={lvl} onClick={() => updateProfile({ mentorLevel: lvl })} style={{ padding: '12px', borderRadius: '14px', border: active ? 'none' : '1px solid rgba(255,255,255,0.1)', background: active ? '#d4a017' : 'transparent', color: active ? 'black' : 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: active ? 900 : 700, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: active ? '0 0 16px rgba(212,160,23,0.4)' : 'none', letterSpacing: '0.04em' }}>
                                            {lvl === 1 ? 'NOVICE' : lvl === 2 ? 'ELITE' : 'BEAST'}
                                        </button>
                                    );
                                })}
                            </div>
                            <p style={{ fontSize: '0.7rem', opacity: 0.4, lineHeight: 1.5 }}>
                                {preferences?.mentorLevel === 1 && 'Supportive coaching for starting out.'}
                                {preferences?.mentorLevel === 2 && 'Strict discipline for high performance.'}
                                {preferences?.mentorLevel === 3 && 'Ruthless intensity for the top 1%.'}
                            </p>
                        </div>

                        {/* — DAILY MODEL — */}
                        <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#d4a017', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Detailed Daily Model</p>
                            <textarea className="settings-input" placeholder="Describe your ideal daily routine..." style={{ minHeight: '120px', width: '100%', lineHeight: 1.6, resize: 'vertical' }} value={preferences?.dailyModel ?? ''} onChange={e => updateProfile({ dailyModel: e.target.value })} />
                        </div>

                        {/* — YOUR MOTIVATION — */}
                        <div style={{ background: '#141414', border: '1px solid rgba(212,160,23,0.2)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#d4a017', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Your Motivation</p>
                            <textarea className="settings-input" placeholder="Why are you working this hard?" style={{ minHeight: '90px', width: '100%', borderLeft: '2px solid rgba(212,160,23,0.4)', lineHeight: 1.6, resize: 'vertical' }} value={preferences?.ambition ?? ''} onChange={e => updateProfile({ ambition: e.target.value })} />
                        </div>

                        {/* — IDENTIFIED HABITS — */}
                        {preferences?.habitNotes && preferences.habitNotes.length > 0 && (
                            <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ff4444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Identified Habits</p>
                                {preferences.habitNotes.map(n => (
                                    <div key={n.id} style={{ fontSize: '0.75rem', padding: '8px', background: 'rgba(255,0,0,0.08)', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.15)' }}>
                                        <p style={{ fontWeight: 700, color: '#ff8888' }}>{n.issue}</p>
                                        <p style={{ opacity: 0.5, fontSize: '0.65rem', marginTop: '2px' }}>Detected on {n.date}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ════ CROSS-PLATFORM SYNC SECTION ════ */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>CROSS-PLATFORM SYNC</p>

                            {/* — MY ACCOUNT ID — */}
                            <div style={{ background: '#141414', border: '1px solid rgba(212,160,23,0.15)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white', marginBottom: '3px' }}>Your Account ID</p>
                                    <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>Share this with your other devices to sync data</p>
                                </div>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#f5c842', background: '#0a0a0a', border: '1px solid rgba(212,160,23,0.2)', borderRadius: '10px', padding: '10px 14px', wordBreak: 'break-all', userSelect: 'all', lineHeight: 1.5 }}>
                                    {user?.id ?? 'Sign in to see your ID'}
                                </div>
                                {user?.id && (
                                    <button onClick={handleCopyId} style={{ background: copied ? 'rgba(212,160,23,0.15)' : '#d4a017', color: copied ? '#d4a017' : 'black', border: copied ? '1px solid rgba(212,160,23,0.4)' : 'none', borderRadius: '12px', padding: '10px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', letterSpacing: '0.06em', transition: 'all 0.25s', boxShadow: copied ? 'none' : '0 0 20px rgba(212,160,23,0.3)' }}>
                                        {copied ? '✅ COPIED!' : '📋 COPY ACCOUNT ID'}
                                    </button>
                                )}
                                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>⚠️ Never share this with anyone you do not trust.</p>
                            </div>

                            {/* — FORCE SYNC — */}
                            <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white', marginBottom: '3px' }}>🔁 Force Cross-Platform Sync</p>
                                    <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>Paste an Account ID to pull all data from that account onto this device</p>
                                </div>
                                <input
                                    value={targetId}
                                    onChange={e => setTargetId(e.target.value)}
                                    placeholder="Paste Account ID here..."
                                    style={{ background: '#0a0a0a', border: '1px solid rgba(212,160,23,0.15)', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '0.78rem', fontFamily: 'monospace', outline: 'none', width: '100%', transition: 'border-color 0.2s' }}
                                />
                                <button onClick={handleForceSyncClick} style={{ background: targetId.trim() ? '#d4a017' : 'rgba(255,255,255,0.05)', color: targetId.trim() ? 'black' : 'rgba(255,255,255,0.3)', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 900, fontSize: '0.78rem', cursor: targetId.trim() ? 'pointer' : 'not-allowed', letterSpacing: '0.06em', transition: 'all 0.2s', boxShadow: targetId.trim() ? '0 0 20px rgba(212,160,23,0.3)' : 'none' }}>
                                    ⚡ FORCE SYNC NOW
                                </button>
                                <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.15)', borderRadius: '12px', padding: '12px' }}>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ff6666', marginBottom: '6px' }}>⚠️ WARNING</p>
                                    <p style={{ fontSize: '0.68rem', opacity: 0.6, lineHeight: 1.6 }}>This will permanently delete ALL local data on this device and replace it with data from the pasted account. This cannot be undone.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sticky save button */}
                    <div style={{ flexShrink: 0, padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#0f0f0f', paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 12px)' }}>
                        <button onClick={() => setIsSettingsOpen(false)} style={{ width: '100%', padding: '16px', borderRadius: '18px', background: '#d4a017', color: 'black', border: 'none', fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer', letterSpacing: '0.1em', boxShadow: '0 0 24px rgba(212,160,23,0.35)', transition: 'all 0.2s' }}>
                            SAVE SETTINGS
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                .settings-input {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 10px 14px;
                    color: white;
                    font-family: inherit;
                    font-size: 0.85rem;
                    outline: none;
                    transition: border-color 0.2s;
                    resize: none;
                }
                .settings-input:focus {
                    border-color: rgba(212, 160, 23, 0.4);
                }
            `}</style>
        </>
    );
}
