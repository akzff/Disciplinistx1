'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DailyChat } from '@/lib/storage';
import { MissionCheckbox } from '@/components/Checkbox';
import TaskDetailDrawer from '@/components/TaskDetailDrawer';
import { IMPORTANCE, TIME_SLOTS } from '@/utils/taskConstants';
import { formatDueDate, formatRecurrence, formatHour } from '@/utils/taskFormatters';
import { isBefore, isToday, parseISO, startOfDay } from 'date-fns';

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
    onAddExpense?: (amount: number, text: string) => void;
    onRemoveExpense?: (id: string) => void;
    onAddDaily?: (text: string) => void;
    onEditDaily?: (id: string, text: string) => void;
    onDeleteDaily?: (id: string) => void;
    onAddTodo?: (text: string) => void;
    onEditTodo?: (id: string, text: string) => void;
    onDeleteTodo?: (id: string) => void;
}

type Todo = DailyChat['todos'][number];
type Daily = DailyChat['dailies'][number];

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
    onAddDaily, onDeleteDaily,
    onAddTodo, onDeleteTodo,
}: MissionChecklistProps) {

    const mobileSidebarRef = useRef<HTMLElement>(null);
    const [dragInfo, setDragInfo] = useState<{ index: number; type: 'DAILIES' | 'TODOS' } | null>(null);
    const [addingType, setAddingType] = useState<'DAILIES' | 'TODOS' | null>(null);
    const [addingText, setAddingText] = useState('');
    const [justCompletedTodos, setJustCompletedTodos] = useState<string[]>([]);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerTask, setDrawerTask] = useState<Todo | Daily | null>(null);
    const [drawerType, setDrawerType] = useState<'todo' | 'daily'>('todo');

    useEffect(() => {
        if (!sidebarOpen || !onClose) return;
        if (typeof window !== 'undefined' && window.innerWidth >= 768) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (mobileSidebarRef.current && mobileSidebarRef.current.contains(target)) return;
            onClose();
        };

        document.addEventListener('pointerdown', handlePointerDown, { capture: true });
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
        };
    }, [sidebarOpen, onClose]);

    const completedDailies = dailies.filter(d => d.completed).length;
    const completedTodos = todos.filter(t => t.completed).length;
    const totalDailies = dailies.length;
    const totalTodos = todos.length;
    const handleSaveAdd = () => {
        if (!addingText.trim()) { setAddingType(null); return; }
        if (addingType === 'DAILIES' && onAddDaily) onAddDaily(addingText.trim());
        if (addingType === 'TODOS' && onAddTodo) onAddTodo(addingText.trim());
        setAddingType(null); setAddingText('');
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

    const openDrawer = (task: Todo | Daily, type: 'todo' | 'daily') => {
        setDrawerTask(task);
        setDrawerType(type);
        setDrawerOpen(true);
    };

    const updateTodo = (updated: Todo) => {
        const next = todos.map(t => t.id === updated.id ? updated : t);
        onReorderTodo(next);
    };

    const updateDaily = (updated: Daily) => {
        const next = dailies.map(d => d.id === updated.id ? updated : d);
        onReorderDaily(next);
    };

    const removeTodo = (id: string) => {
        if (onDeleteTodo) onDeleteTodo(id);
        else onReorderTodo(todos.filter(t => t.id !== id));
    };

    const removeDaily = (id: string) => {
        if (onDeleteDaily) onDeleteDaily(id);
        else onReorderDaily(dailies.filter(d => d.id !== id));
    };

    const triggerCompletionFlash = (id: string) => {
        setJustCompletedTodos(prev => [...prev, id]);
        setTimeout(() => {
            setJustCompletedTodos(prev => prev.filter(tid => tid !== id));
        }, 2000);
    };

    const handleToggleTodoClick = (todo: Todo) => {
        if (todo.recurrence?.type && todo.recurrence.type !== 'once') {
            triggerCompletionFlash(todo.id);
        }
        onToggleTodo(todo.id);
    };

    const groupedDailies = useMemo(() => {
        const groups: Record<string, { item: Daily; index: number }[]> = {
            morning: [],
            noon: [],
            afternoon: [],
            evening: [],
            night: [],
            anytime: []
        };
        dailies.forEach((daily, index) => {
            const slot = daily.time_slot && daily.time_slot !== 'anytime' ? daily.time_slot : 'anytime';
            if (!groups[slot]) groups[slot] = [];
            groups[slot].push({ item: daily, index });
        });
        return groups;
    }, [dailies]);

    const isOverdue = (todo: Todo) => {
        if (!todo.due_date) return false;
        return isBefore(parseISO(todo.due_date), startOfDay(new Date()));
    };

    const renderTodoItem = (todo: Todo, idx: number) => {
        const importance = IMPORTANCE[todo.importance ?? 0] || IMPORTANCE[0];
        const overdue = isOverdue(todo);
        const emergency = overdue && !!todo.emergency_date;
        const isSelectedFlash = justCompletedTodos.includes(todo.id);
        const recurrenceType = todo.recurrence?.type;
        const seasonal = todo.visibility?.type === 'seasonal';

        return (
            <div key={todo.id} draggable
                onDragStart={(e) => handleDragStart(e, idx, 'TODOS')}
                onDragEnd={() => setDragInfo(null)}
                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'TODOS')}
                style={{ opacity: dragInfo?.index === idx && dragInfo.type === 'TODOS' ? 0.4 : 1 }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: emergency
                        ? 'rgba(249,115,22,0.05)'
                        : overdue
                            ? 'rgba(239,68,68,0.05)'
                            : isSelectedFlash ? 'rgba(16,185,129,0.08)' : 'transparent',
                    border: emergency
                        ? '1px solid rgba(249,115,22,0.2)'
                        : '1px solid transparent'
                }}>
                    <MissionCheckbox
                        checked={todo.completed}
                        onChange={() => handleToggleTodoClick(todo)}
                        variant="todo"
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {(todo.importance ?? 0) > 0 && (
                                <div style={{
                                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                                    background: importance.color,
                                    boxShadow: `0 0 4px ${importance.color}`
                                }} />
                            )}
                            <span style={{
                                fontSize: '13px',
                                color: todo.completed ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)',
                                textDecoration: todo.completed ? 'line-through' : 'none',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {todo.text}
                            </span>
                        </div>

                        {(todo.due_date || recurrenceType) && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {todo.due_date && (
                                    <span style={{
                                        fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
                                        background: overdue
                                            ? 'rgba(239,68,68,0.15)'
                                            : isToday(parseISO(todo.due_date))
                                                ? 'rgba(251,191,36,0.15)'
                                                : 'rgba(255,255,255,0.06)',
                                        color: overdue
                                            ? '#ef4444'
                                            : isToday(parseISO(todo.due_date))
                                                ? '#fbbf24'
                                                : 'rgba(255,255,255,0.3)',
                                        display: 'flex', alignItems: 'center', gap: '3px'
                                    }}>
                                        📅 {formatDueDate(todo.due_date)}
                                        {todo.due_time && ` ${formatHour(todo.due_time)}`}
                                    </span>
                                )}

                                {overdue && todo.emergency_date && (
                                    <span style={{
                                        fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
                                        background: 'rgba(239,68,68,0.2)',
                                        color: '#ef4444',
                                        fontWeight: 700,
                                        display: 'flex', alignItems: 'center', gap: '3px'
                                    }}>
                                        ⚠️ DEADLINE {formatDueDate(todo.emergency_date)}
                                    </span>
                                )}

                                {recurrenceType && recurrenceType !== 'once' && (
                                    <span style={{
                                        fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
                                        background: 'rgba(212,160,23,0.1)',
                                        color: 'rgba(212,160,23,0.7)',
                                        display: 'flex', alignItems: 'center', gap: '3px'
                                    }}>
                                        🔄 {formatRecurrence(todo.recurrence)}
                                    </span>
                                )}

                                {seasonal && (
                                    <span style={{
                                        fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
                                        background: 'rgba(167,139,250,0.1)',
                                        color: 'rgba(167,139,250,0.7)'
                                    }}>
                                        📆 every {todo.visibility?.every_months}mo
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => openDrawer(todo, 'todo')}
                        style={{
                            color: 'rgba(255,255,255,0.2)',
                            fontSize: '12px',
                            padding: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                    >
                        ✏️
                    </button>
                </div>
            </div>
        );
    };

    const renderDailyItem = (daily: Daily, idx: number) => {
        const importance = IMPORTANCE[daily.importance ?? 0] || IMPORTANCE[0];
        const slot = TIME_SLOTS.find(s => s.id === (daily.time_slot || 'anytime'));
        return (
            <div key={daily.id} draggable
                onDragStart={(e) => handleDragStart(e, idx, 'DAILIES')}
                onDragEnd={() => setDragInfo(null)}
                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'DAILIES')}
                style={{ opacity: dragInfo?.index === idx && dragInfo.type === 'DAILIES' ? 0.4 : 1 }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px'
                }}>
                    <MissionCheckbox
                        checked={daily.completed}
                        onChange={() => onToggleDaily(daily.id)}
                        variant="daily"
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {(daily.importance ?? 0) > 0 && (
                                <div style={{
                                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                                    background: importance.color,
                                    boxShadow: `0 0 4px ${importance.color}`
                                }} />
                            )}
                            <span style={{
                                fontSize: '13px',
                                color: daily.completed ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)',
                                textDecoration: daily.completed ? 'line-through' : 'none',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {daily.text}
                            </span>
                        </div>
                        {slot && slot.id !== 'anytime' && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'rgba(255,255,255,0.3)'
                                }}>
                                    {slot.icon} {slot.label}
                                    {daily.time_slot_time ? ` ${daily.time_slot_time}` : ''}
                                </span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => openDrawer(daily, 'daily')}
                        style={{
                            color: 'rgba(255,255,255,0.2)',
                            fontSize: '12px',
                            padding: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                    >
                        ✏️
                    </button>
                </div>
            </div>
        );
    };
    // The inner content — shared logic, rendered into the right container below
    const renderContent = () => (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
            overflow: 'hidden', padding: '16px', gap: '12px', boxSizing: 'border-box',
        }}>
            {/* ZONE A (Integrated into sections headers) */}

            {/* ZONE C — DAILIES */}
            <div style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px', overflow: 'hidden',
            }}>
                <SectionHeader dot="#34d399" label="DAILIES" completed={completedDailies} total={totalDailies}
                    accentColor="#34d399" onAdd={() => { setAddingType('DAILIES'); setAddingText(''); }} />
                <div className="mc-desktop-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px' }}>
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
                    {Object.entries(groupedDailies)
                        .filter((entry) => entry[1].length > 0)
                        .map(([slot, tasks]) => (
                            <div key={slot}>
                                <p style={{
                                    fontSize: '9px', color: 'rgba(255,255,255,0.2)',
                                    letterSpacing: '0.1em', fontWeight: 700,
                                    padding: '4px 10px', marginTop: '8px'
                                }}>
                                    {TIME_SLOTS.find(s => s.id === slot)?.icon} {slot.toUpperCase()}
                                </p>
                                {tasks.map(({ item, index }) => renderDailyItem(item, index))}
                            </div>
                        ))}
                </div>
            </div>

            {/* ZONE D — TO-DOS */}
            <div style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px', overflow: 'hidden',
            }}>
                <SectionHeader dot="#a78bfa" label="TO-DOS" completed={completedTodos} total={totalTodos}
                    accentColor="#a78bfa" onAdd={() => { setAddingType('TODOS'); setAddingText(''); }} />
                <div className="mc-desktop-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px' }}>
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
                    {todos.map((todo, idx) => renderTodoItem(todo, idx))}
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
                    className="mc-backdrop"
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 3999,
                        display: 'block'
                    }}
                />
            )}

            {/* Mobile drawer — slides in from left, hidden on desktop */}
            <aside
                className={`mission-checklist no-scrollbar${sidebarOpen ? ' sidebar-open' : ''}`}
                ref={mobileSidebarRef}
                style={{ zIndex: 4000 }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px 16px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>MISSIONS</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '20px', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {renderContent()}
                </div>
            </aside>

            {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────
                This is the ONLY desktop render. It sits as the first child
                of the CSS grid (300px column) defined in page.tsx.
                It is hidden on mobile by the media query below.
                NO other component should render <MissionChecklist> on desktop.
            ─────────────────────────────────────────────────────────────── */}
            <div className="mc-desktop-only" style={{
                width: '300px', minWidth: '300px', maxWidth: '300px',
                height: '100%', maxHeight: '100%', overflow: 'hidden',
                borderRight: '1px solid rgba(212,160,23,0.1)',
                backgroundColor: '#0a0a0a',
                display: 'flex', flexDirection: 'column',
                position: 'relative', zIndex: 1,
                boxSizing: 'border-box',
                /* hidden on mobile — shown on desktop */
            }}>
                {renderContent()}
            </div>

            <TaskDetailDrawer
                open={drawerOpen}
                type={drawerType}
                task={drawerTask}
                onClose={() => setDrawerOpen(false)}
                onUpdate={(task) => {
                    if (drawerType === 'todo') updateTodo(task as Todo);
                    else updateDaily(task as Daily);
                    setDrawerTask(task);
                }}
                onDelete={(task) => {
                    if (drawerType === 'todo') removeTodo((task as Todo).id);
                    else removeDaily((task as Daily).id);
                    setDrawerOpen(false);
                }}
            />

            {/* Media query: hide desktop sidebar on mobile, hide mobile aside on desktop */}
            <style>{`
                @media (max-width: 767px) {
                    .mc-desktop-only { display: none !important; }
                    .mission-checklist {
                        position: fixed;
                        top: 0;
                        left: -100%;
                        width: 85%;
                        height: 100%;
                        background: #08080a;
                        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 20px 0 50px rgba(0,0,0,0.5);
                        display: flex;
                        flex-direction: column;
                    }
                    .mission-checklist.sidebar-open {
                        transform: translateX(100%);
                    }
                }
                @media (min-width: 768px) {
                    .mission-checklist { display: none !important; }
                    .mc-backdrop { display: none !important; }
                }
                @keyframes wiggle {
                    0% { transform: rotate(0deg); }
                    25% { transform: rotate(1.5deg); }
                    50% { transform: rotate(0deg); }
                    75% { transform: rotate(-1.5deg); }
                    100% { transform: rotate(0deg); }
                }
                .wiggle {
                    animation: wiggle 0.25s infinite;
                }
            `}</style>
        </>
    );
}



