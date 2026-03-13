'use client';

import React, { useState } from 'react';
import { DailyChat } from '@/lib/storage';

interface MissionChecklistProps {
    todos: DailyChat['todos'];
    dailies: DailyChat['dailies'];
    expenses?: DailyChat['expenses'];
    sidebarOpen?: boolean;
    onClose?: () => void;
    onToggleTodo: (id: string) => void;
    onToggleDaily: (id: string) => void;
    onReorderTodo: (newTodos: DailyChat['todos']) => void;
    onReorderDaily: (newDailies: DailyChat['dailies']) => void;
    onStartLiveMission: (name: string) => void;
    onAddExpense?: (amount: number, text: string) => void;
    onRemoveExpense?: (id: string) => void;
    onAddDaily?: (text: string) => void;
    onEditDaily?: (id: string, text: string) => void;
    onDeleteDaily?: (id: string) => void;
    onAddTodo?: (text: string) => void;
    onEditTodo?: (id: string, text: string) => void;
    onDeleteTodo?: (id: string) => void;
}

// ────────────────────────────────────────────────────────────────
// Sub-components — all inline styles, zero Tailwind dependency
// ────────────────────────────────────────────────────────────────

function SectionHeader({
    dot, label, completed, total, onAdd, accentColor = '#d4a017'
}: {
    dot: string; label: string; completed: number; total: number;
    onAdd: () => void; accentColor?: string;
}) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
        <div style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            gap: '8px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        backgroundColor: dot, boxShadow: `0 0 6px ${dot}`, flexShrink: 0,
                    }} />
                    <span style={{
                        color: 'rgba(255,255,255,0.7)', fontWeight: 900, fontSize: '11px',
                        letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                    }}>
                        {label}
                    </span>
                    {total > 0 && (
                        <span style={{
                            fontSize: '10px', background: `${accentColor}1A`, color: accentColor,
                            border: `1px solid ${accentColor}40`, padding: '2px 6px',
                            borderRadius: '20px', fontWeight: 700,
                        }}>
                            {completed}/{total}
                        </span>
                    )}
                </div>
                <button onClick={onAdd} style={{
                    width: '24px', height: '24px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '16px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', lineHeight: 1, flexShrink: 0,
                }}>+</button>
            </div>
            {total > 0 && (
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                        height: '100%', width: `${pct}%`, 
                        background: accentColor, 
                        borderRadius: '4px', transition: 'width 0.5s ease' 
                    }} />
                </div>
            )}
        </div>
    );
}

function CheckItem({
    label, checked, onToggle, onEdit, onDelete, accentColor = '#34d399', date, time, recurring
}: {
    label: string; checked: boolean; onToggle: () => void;
    onEdit?: () => void; onDelete?: () => void; accentColor?: string;
    date?: string; time?: string; recurring?: string;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onClick={onToggle}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                borderRadius: '10px', cursor: 'pointer',
                background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                opacity: checked ? 0.55 : 1,
                transition: 'background 0.15s, opacity 0.15s',
                overflow: 'hidden',
            }}>
            <div style={{
                width: '18px', height: '18px', minWidth: '18px', borderRadius: '5px',
                border: checked ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,0.2)',
                background: checked ? accentColor : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', flexShrink: 0,
            }}>
                {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{
                    fontSize: '13px',
                    color: checked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
                    textDecoration: checked ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const, display: 'block'
                }}>
                    {label}
                </span>
                {(date || time || recurring) && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px', alignItems: 'center' }}>
                        {date && <span style={{ fontSize: '10px', color: accentColor, opacity: 0.8, background: `${accentColor}1A`, padding: '1px 5px', borderRadius: '4px' }}>{date}</span>}
                        {time && <span style={{ fontSize: '10px', color: accentColor, opacity: 0.8, background: `${accentColor}1A`, padding: '1px 5px', borderRadius: '4px' }}>⏰ {time}</span>}
                        {recurring && <span style={{ fontSize: '10px', color: accentColor, opacity: 0.8, background: `${accentColor}1A`, padding: '1px 5px', borderRadius: '4px' }}>↻ {recurring}</span>}
                    </div>
                )}
            </div>
            {hovered && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    {onEdit && (
                        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#3b82f6', opacity: 0.7, padding: '2px',
                            display: 'flex', alignItems: 'center'
                        }} title="Edit">
                            <span style={{ fontSize: '12px' }}>✎</span>
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(248,113,113,0.7)', padding: '2px',
                            display: 'flex', alignItems: 'center'
                        }} title="Delete">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function InlineInput({
    placeholder, value, onChange, onSave, onCancel, accentColor = '#d4a017'
}: {
    placeholder: string; value: string;
    onChange: (v: string) => void;
    onSave: () => void; onCancel: () => void;
    accentColor?: string;
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
            background: '#1a1a1a', borderRadius: '10px',
            border: `1px solid ${accentColor}33`, marginBottom: '4px',
        }}>
            <div style={{
                width: '18px', height: '18px', minWidth: '18px', borderRadius: '5px',
                border: '2px dashed rgba(255,255,255,0.2)', flexShrink: 0,
            }} />
            <input
                autoFocus
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') onSave();
                    if (e.key === 'Escape') onCancel();
                }}
                onBlur={onSave}
                style={{
                    flex: 1, background: 'transparent', border: 'none',
                    outline: 'none', color: 'rgba(255,255,255,0.8)', fontSize: '13px', minWidth: 0,
                }}
            />
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Main — returns a SINGLE root element that IS the sidebar column.
// On mobile it uses a CSS class for the slide-over behaviour.
// On desktop it fills the 300px grid column from page.tsx.
// ────────────────────────────────────────────────────────────────
export default function MissionChecklist({
    todos, dailies, sidebarOpen, onClose,
    onToggleTodo, onToggleDaily, onReorderTodo, onReorderDaily,
    onStartLiveMission,
    onAddDaily, onEditDaily, onDeleteDaily,
    onAddTodo, onEditTodo, onDeleteTodo,
}: MissionChecklistProps) {

    const [dragInfo, setDragInfo] = useState<{ index: number; type: 'DAILIES' | 'TODOS' } | null>(null);
    const [isStartingLive, setIsStartingLive] = useState(false);
    const [liveInput, setLiveInput] = useState('');
    const [addingType, setAddingType] = useState<'DAILIES' | 'TODOS' | null>(null);
    const [addingText, setAddingText] = useState('');
    const [editingItem, setEditingItem] = useState<{ id: string; type: 'DAILIES' | 'TODOS'; text: string } | null>(null);

    const completedDailies = dailies.filter(d => d.completed).length;
    const completedTodos = todos.filter(t => t.completed).length;
    const totalDailies = dailies.length;
    const totalTodos = todos.length;
    const totalAll = totalDailies + totalTodos;
    const completedAll = completedDailies + completedTodos;

    const handleSaveAdd = () => {
        if (!addingText.trim()) { setAddingType(null); return; }
        if (addingType === 'DAILIES' && onAddDaily) onAddDaily(addingText.trim());
        if (addingType === 'TODOS' && onAddTodo) onAddTodo(addingText.trim());
        setAddingType(null); setAddingText('');
    };

    const handleSaveEdit = () => {
        if (!editingItem?.text.trim()) { setEditingItem(null); return; }
        if (editingItem.type === 'DAILIES' && onEditDaily) onEditDaily(editingItem.id, editingItem.text.trim());
        if (editingItem.type === 'TODOS' && onEditTodo) onEditTodo(editingItem.id, editingItem.text.trim());
        setEditingItem(null);
    };

    const handleDragStart = (e: React.DragEvent, index: number, type: 'DAILIES' | 'TODOS') => {
        setDragInfo({ index, type }); e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    const handleDrop = (e: React.DragEvent, targetIndex: number, type: 'DAILIES' | 'TODOS') => {
        e.preventDefault();
        if (!dragInfo || dragInfo.type !== type) return;
        const items = type === 'DAILIES' ? [...dailies] : [...todos];
        const [moved] = items.splice(dragInfo.index, 1);
        items.splice(targetIndex, 0, moved);
        if (type === 'DAILIES') onReorderDaily(items); else onReorderTodo(items);
        setDragInfo(null);
    };

    // The inner content — shared logic, rendered into the right container below
    const renderContent = () => (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
            overflow: 'hidden', padding: '16px', gap: '12px', boxSizing: 'border-box',
        }}>
            {/* ZONE A (Integrated into sections headers) */}

            {/* ZONE B — START TASK */}
            {isStartingLive ? (
                <div style={{
                    flexShrink: 0, background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.25)', borderRadius: '12px',
                    padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#10b981', fontWeight: 900, fontSize: '10px', letterSpacing: '0.12em' }}>⚡ NAME YOUR MISSION</span>
                        <button onClick={() => setIsStartingLive(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                    <input autoFocus placeholder="e.g. Deep work session..." value={liveInput}
                        onChange={(e) => setLiveInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && liveInput.trim()) { onStartLiveMission(liveInput); setIsStartingLive(false); setLiveInput(''); }
                            else if (e.key === 'Escape') setIsStartingLive(false);
                        }}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', color: 'white', padding: '8px', fontSize: '13px',
                            outline: 'none', width: '100%', boxSizing: 'border-box',
                        }}
                    />
                    <button onClick={() => { if (liveInput.trim()) { onStartLiveMission(liveInput); setIsStartingLive(false); setLiveInput(''); } }}
                        style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none',
                            borderRadius: '8px', color: 'white', padding: '8px', fontSize: '10px',
                            fontWeight: 900, letterSpacing: '0.1em', cursor: 'pointer',
                        }}>🔥 LAUNCH MISSION</button>
                </div>
            ) : (
                <button onClick={() => setIsStartingLive(true)} style={{
                    flexShrink: 0, width: '100%', padding: '14px',
                    background: 'linear-gradient(90deg, #d4a017, #c49010)',
                    border: 'none', borderRadius: '12px', color: '#000',
                    fontWeight: 900, fontSize: '13px', letterSpacing: '0.1em',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '8px', boxSizing: 'border-box',
                    transition: 'box-shadow 0.2s, transform 0.1s',
                }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(212,160,23,0.5)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
                    onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                    <span>▶</span> START TASK
                </button>
            )}

            {/* ZONE C — DAILIES */}
            <div style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px', overflow: 'hidden',
            }}>
                <SectionHeader dot="#34d399" label="DAILIES" completed={completedDailies} total={totalDailies}
                    accentColor="#34d399" onAdd={() => { setAddingType('DAILIES'); setAddingText(''); }} />
                <div className="mc-desktop-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px' }}>
                    {addingType === 'DAILIES' && (
                        <InlineInput placeholder="New daily habit..." value={addingText} onChange={setAddingText}
                            onSave={handleSaveAdd} onCancel={() => setAddingType(null)} accentColor="#34d399" />
                    )}
                    {totalDailies === 0 && addingType !== 'DAILIES' && (
                        <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🌅</div>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                                No dailies yet.<br />Add your recurring habits.
                            </p>
                        </div>
                    )}
                    {dailies.map((daily, idx) => (
                        editingItem?.id === daily.id ? (
                            <InlineInput key={daily.id} placeholder="Edit daily..." value={editingItem.text}
                                onChange={(v) => setEditingItem({ ...editingItem, text: v })}
                                onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} accentColor="#34d399" />
                        ) : (
                            <div key={daily.id} draggable
                                onDragStart={(e) => handleDragStart(e, idx, 'DAILIES')}
                                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'DAILIES')}
                                style={{ opacity: dragInfo?.index === idx && dragInfo.type === 'DAILIES' ? 0.4 : 1 }}>
                                <CheckItem label={daily.text} checked={daily.completed} accentColor="#34d399"
                                    recurring={daily.recurringDays ? daily.recurringDays.join(', ') : daily.frequency ? `${daily.frequency.count}x/${daily.frequency.period}` : undefined}
                                    onToggle={() => onToggleDaily(daily.id)}
                                    onEdit={() => setEditingItem({ id: daily.id, type: 'DAILIES', text: daily.text })}
                                    onDelete={onDeleteDaily ? () => onDeleteDaily(daily.id) : undefined} />
                            </div>
                        )
                    ))}
                </div>
            </div>

            {/* ZONE D — TO-DO'S */}
            <div style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px', overflow: 'hidden',
            }}>
                <SectionHeader dot="#a78bfa" label="TO-DO'S" completed={completedTodos} total={totalTodos}
                    accentColor="#a78bfa" onAdd={() => { setAddingType('TODOS'); setAddingText(''); }} />
                <div className="mc-desktop-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px' }}>
                    {addingType === 'TODOS' && (
                        <InlineInput placeholder="New task..." value={addingText} onChange={setAddingText}
                            onSave={handleSaveAdd} onCancel={() => setAddingType(null)} accentColor="#a78bfa" />
                    )}
                    {totalTodos === 0 && addingType !== 'TODOS' && (
                        <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                                No tasks yet.<br />What needs to get done?
                            </p>
                        </div>
                    )}
                    {todos.map((todo, idx) => (
                        editingItem?.id === todo.id ? (
                            <InlineInput key={todo.id} placeholder="Edit task..." value={editingItem.text}
                                onChange={(v) => setEditingItem({ ...editingItem, text: v })}
                                onSave={handleSaveEdit} onCancel={() => setEditingItem(null)} accentColor="#a78bfa" />
                        ) : (
                            <div key={todo.id} draggable
                                onDragStart={(e) => handleDragStart(e, idx, 'TODOS')}
                                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'TODOS')}
                                style={{ opacity: dragInfo?.index === idx && dragInfo.type === 'TODOS' ? 0.4 : 1 }}>
                                <CheckItem label={todo.text} checked={todo.completed} accentColor="#a78bfa"
                                    date={todo.date} time={todo.isTimed ? todo.time : undefined}
                                    onToggle={() => onToggleTodo(todo.id)}
                                    onEdit={() => setEditingItem({ id: todo.id, type: 'TODOS', text: todo.text })}
                                    onDelete={onDeleteTodo ? () => onDeleteTodo(todo.id) : undefined} />
                            </div>
                        )
                    ))}
                </div>
            </div>
        </div>
    );

    // ── SINGLE ROOT ELEMENT ──────────────────────────────────────
    // On desktop (inside the 300px grid column from page.tsx):
    //   display: flex — occupies the full column, fully contained.
    // On mobile: hidden via .mc-desktop-only CSS class.
    //
    // The mobile slide-over (aside.mission-checklist) is rendered
    // separately inside the mobile-only layout in page.tsx (md:hidden).
    // MissionChecklist itself only needs to be the desktop column.
    return (
        <>
            {/* Global style for custom scrollbars */}
            <style>{`
                .mc-desktop-scroll::-webkit-scrollbar { width: 4px; }
                .mc-desktop-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
                .mc-desktop-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}</style>

            {/* Mobile backdrop — only visible when sidebar is open on mobile */}
            {sidebarOpen && (
                <div
                    className="mc-backdrop md:hidden"
                    onClick={onClose}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.6)', zIndex: 40,
                    }}
                />
            )}

            {/* Mobile drawer — slides in from left, hidden on desktop */}
            <aside
                className={`mission-checklist md:hidden no-scrollbar${sidebarOpen ? ' sidebar-open' : ''}`}
                style={{ zIndex: 41 }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px 16px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>MISSIONS</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '20px', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>

                <div className="mc-start-section">
                    {isStartingLive ? (
                        <div className="mc-task-input-box">
                            <div className="mc-task-input-header">
                                <span>⚡ NAME YOUR MISSION</span>
                                <button onClick={() => setIsStartingLive(false)} className="mc-task-cancel">✕</button>
                            </div>
                            <input autoFocus placeholder="e.g. Deep work session..." value={liveInput}
                                onChange={(e) => setLiveInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && liveInput.trim()) { onStartLiveMission(liveInput); setIsStartingLive(false); setLiveInput(''); }
                                    else if (e.key === 'Escape') setIsStartingLive(false);
                                }}
                                className="mc-task-input" />
                            <button onClick={() => { if (liveInput.trim()) { onStartLiveMission(liveInput); setIsStartingLive(false); setLiveInput(''); } }}
                                className="mc-task-start-btn">🔥 LAUNCH MISSION</button>
                        </div>
                    ) : (
                        <button onClick={() => setIsStartingLive(true)} className="mc-start-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            START TASK
                        </button>
                    )}
                </div>

                <section className="mc-section">
                    <div className="mc-section__header">
                        <div className="mc-section__title" style={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="mc-section__dot mc-section__dot--daily" />
                                    <span>DAILIES</span>
                                    {totalDailies > 0 && <span className="mc-section__count" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>{completedDailies}/{totalDailies}</span>}
                                </div>
                            </div>
                            {totalDailies > 0 && (
                                <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', width: '100%' }}>
                                    <div style={{ height: '100%', width: `${Math.round((completedDailies / totalDailies) * 100)}%`, background: '#34d399', transition: 'width 0.5s' }} />
                                </div>
                            )}
                        </div>
                        <button onClick={() => { setAddingType('DAILIES'); setAddingText(''); }} className="mc-add-btn" aria-label="Add daily">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                    </div>
                    {addingType === 'DAILIES' && (
                        <div className="mc-add-row">
                            <input autoFocus value={addingText} onChange={(e) => setAddingText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAdd(); else if (e.key === 'Escape') setAddingType(null); }}
                                placeholder="New daily habit..." className="mc-add-input mc-add-input--daily" />
                            <button onClick={handleSaveAdd} className="mc-add-confirm mc-add-confirm--daily">ADD</button>
                        </div>
                    )}
                    <div className="mc-item-list">
                        {dailies.length === 0 && <p className="mc-empty">No dailies yet.</p>}
                        {dailies.map((daily, idx) => (
                            <div key={daily.id} draggable onDragStart={(e) => handleDragStart(e, idx, 'DAILIES')}
                                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'DAILIES')}
                                className={`mc-item${dragInfo?.index === idx && dragInfo.type === 'DAILIES' ? ' mc-item--dragging' : ''}`}>
                                <div className="mc-item__drag">⋮⋮</div>
                                <div className="mc-item__content">
                                    {editingItem?.id === daily.id ? (
                                        <input autoFocus value={editingItem.text}
                                            onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                            onBlur={handleSaveEdit} className="mc-item__edit-input" />
                                    ) : (
                                        <span onClick={() => onToggleDaily(daily.id)}
                                            className={`mc-item__text${daily.completed ? ' mc-item__text--done' : ''}`}>
                                            {daily.text}
                                        </span>
                                    )}
                                </div>
                                {onDeleteDaily && (
                                    <button onClick={() => onDeleteDaily(daily.id)} className="mc-item__delete" aria-label="Delete">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mc-section">
                    <div className="mc-section__header">
                        <div className="mc-section__title" style={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="mc-section__dot mc-section__dot--todo" />
                                    <span>TO-DO&apos;S</span>
                                    {totalTodos > 0 && <span className="mc-section__count" style={{ background: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.2)' }}>{completedTodos}/{totalTodos}</span>}
                                </div>
                            </div>
                            {totalTodos > 0 && (
                                <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', width: '100%' }}>
                                    <div style={{ height: '100%', width: `${Math.round((completedTodos / totalTodos) * 100)}%`, background: '#a78bfa', transition: 'width 0.5s' }} />
                                </div>
                            )}
                        </div>
                        <button onClick={() => { setAddingType('TODOS'); setAddingText(''); }} className="mc-add-btn" aria-label="Add todo">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                    </div>
                    {addingType === 'TODOS' && (
                        <div className="mc-add-row">
                            <input autoFocus value={addingText} onChange={(e) => setAddingText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAdd(); else if (e.key === 'Escape') setAddingType(null); }}
                                placeholder="New task..." className="mc-add-input mc-add-input--todo" />
                            <button onClick={handleSaveAdd} className="mc-add-confirm mc-add-confirm--todo">ADD</button>
                        </div>
                    )}
                    <div className="mc-item-list">
                        {todos.length === 0 && <p className="mc-empty">No tasks yet.</p>}
                        {todos.map((todo, idx) => (
                            <div key={todo.id} draggable onDragStart={(e) => handleDragStart(e, idx, 'TODOS')}
                                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'TODOS')}
                                className={`mc-item${dragInfo?.index === idx && dragInfo.type === 'TODOS' ? ' mc-item--dragging' : ''}`}>
                                <div className="mc-item__drag">⋮⋮</div>
                                <div className="mc-item__content">
                                    {editingItem?.id === todo.id ? (
                                        <input autoFocus value={editingItem.text}
                                            onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                            onBlur={handleSaveEdit} className="mc-item__edit-input" />
                                    ) : (
                                        <span onClick={() => onToggleTodo(todo.id)}
                                            className={`mc-item__text${todo.completed ? ' mc-item__text--done' : ''}`}>
                                            {todo.text}
                                        </span>
                                    )}
                                </div>
                                {onDeleteTodo && (
                                    <button onClick={() => onDeleteTodo(todo.id)} className="mc-item__delete" aria-label="Delete">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </aside>

            {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────
                This is the ONLY desktop render. It sits as the first child
                of the CSS grid (300px column) defined in page.tsx.
                It is hidden on mobile by the media query below.
                NO other component should render <MissionChecklist> on desktop.
            ─────────────────────────────────────────────────────────────── */}
            <div className="mc-desktop-only" style={{
                width: '300px', minWidth: '300px', maxWidth: '300px',
                height: '100%', overflow: 'hidden',
                borderRight: '1px solid rgba(212,160,23,0.1)',
                backgroundColor: '#0a0a0a',
                display: 'flex', flexDirection: 'column',
                position: 'relative', zIndex: 1,
                boxSizing: 'border-box',
                /* hidden on mobile — shown on desktop */
            }}>
                {renderContent()}
            </div>

            {/* Media query: hide desktop sidebar on mobile, hide mobile aside on desktop */}
            <style>{`
                @media (max-width: 767px) {
                    .mc-desktop-only { display: none !important; }
                }
                @media (min-width: 768px) {
                    .mission-checklist { display: none !important; }
                    .mc-backdrop { display: none !important; }
                }
            `}</style>
        </>
    );
}
