'use client';

import { useState } from 'react';
import { DailyChat } from '@/lib/storage';

interface MissionsBoardProps {
    chat: DailyChat;
    onUpdate: (updates: Partial<DailyChat>) => void;
    onClose: () => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MissionsBoard({ chat, onUpdate, onClose }: MissionsBoardProps) {
    const [activeTab, setActiveTab] = useState<'DAILIES' | 'TODOS'>('DAILIES');
    const [newText, setNewText] = useState('');
    const [newTime, setNewTime] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [isTimed, setIsTimed] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    // Daily specific state
    const [dailyScheduleType, setDailyScheduleType] = useState<'EVERYDAY' | 'DAYS' | 'FREQUENCY'>('EVERYDAY');
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [freqCount, setFreqCount] = useState(1);
    const [freqPeriod, setFreqPeriod] = useState<'WEEK' | 'MONTH'>('WEEK');

    const addTodo = () => {
        if (!newText.trim()) return;
        const colors = ['#f97316', '#3b82f6', '#8b5cf6', '#ef4444', '#10b981'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        // Convert YYYY-MM-DD back to DD/MM/YYYY for consistency with existing app format
        const dateParts = newDate.split('-');
        const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

        const newItem = {
            id: Date.now().toString(),
            text: newText,
            completed: false,
            color: randomColor,
            date: formattedDate,
            time: isTimed ? newTime : undefined,
            isTimed,
            subtasks: []
        };
        onUpdate({ todos: [...(chat.todos || []), newItem] });
        setNewText('');
        setNewTime('');
        setIsTimed(false);
    };

    const addDaily = () => {
        if (!newText.trim()) return;
        const colors = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const newItem: any = {
            id: Date.now().toString(),
            text: newText,
            completed: false,
            color: randomColor,
            subtasks: []
        };

        if (dailyScheduleType === 'DAYS') {
            newItem.recurringDays = selectedDays;
        } else if (dailyScheduleType === 'FREQUENCY') {
            newItem.frequency = { count: freqCount, period: freqPeriod };
        }

        onUpdate({ dailies: [...(chat.dailies || []), newItem] });
        setNewText('');
        setDailyScheduleType('EVERYDAY');
        setSelectedDays([]);
    };

    const toggleTodo = (id: string) => {
        const updated = chat.todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        onUpdate({ todos: updated });
    };

    const toggleDaily = (id: string) => {
        const updated = chat.dailies.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        onUpdate({ dailies: updated });
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (dragIndex === null) return;

        const type = activeTab === 'DAILIES' ? 'dailies' : 'todos';
        const items = [...(chat[type] || [])];
        const [reorderedItem] = items.splice(dragIndex, 1);
        items.splice(targetIndex, 0, reorderedItem);

        onUpdate({ [type]: items });
        setDragIndex(null);
    };

    const editItem = (id: string, type: 'DAILIES' | 'TODOS') => {
        const items = type === 'DAILIES' ? chat.dailies : chat.todos;
        const item = items.find(i => i.id === id);
        if (!item) return;

        const newText = prompt('Edit task:', item.text);
        if (newText === null || newText.trim() === '') return;

        if (type === 'DAILIES') {
            const updated = chat.dailies.map(d => d.id === id ? { ...d, text: newText } : d);
            onUpdate({ dailies: updated });
        } else {
            const updated = chat.todos.map(t => t.id === id ? { ...t, text: newText } : t);
            onUpdate({ todos: updated });
        }
    };

    const toggleTodoTime = (id: string) => {
        const updated = chat.todos.map(t => {
            if (t.id === id) {
                const nextIsTimed = !t.isTimed;
                let nextTime = t.time;
                let nextDate = t.date;

                if (nextIsTimed) {
                    if (!nextTime) {
                        nextTime = prompt('Enter schedule time (e.g. 09:00 AM):') || '';
                    }
                    const userDate = prompt('Enter schedule date (DD/MM/YYYY):', t.date || new Date().toLocaleDateString('en-GB'));
                    if (userDate) nextDate = userDate;
                }

                return { ...t, isTimed: nextIsTimed, time: nextTime, date: nextDate };
            }
            return t;
        });
        onUpdate({ todos: updated });
    };

    const deleteItem = (id: string, type: 'DAILIES' | 'TODOS') => {
        if (!confirm('Are you sure you want to delete this?')) return;

        if (type === 'DAILIES') {
            const updated = chat.dailies.filter(d => d.id !== id);
            onUpdate({ dailies: updated });
        } else {
            const updated = chat.todos.filter(t => t.id !== id);
            onUpdate({ todos: updated });
        }
    };

    const addSubtask = (parentId: string, type: 'DAILIES' | 'TODOS') => {
        const text = prompt('Enter subtask:');
        if (!text) return;

        if (type === 'TODOS') {
            const updated = chat.todos.map(t => {
                if (t.id === parentId) {
                    return { ...t, subtasks: [...(t.subtasks || []), { id: Date.now().toString(), text, completed: false }] };
                }
                return t;
            });
            onUpdate({ todos: updated });
        } else {
            const updated = chat.dailies.map(d => {
                if (d.id === parentId) {
                    return { ...d, subtasks: [...(d.subtasks || []), { id: Date.now().toString(), text, completed: false }] };
                }
                return d;
            });
            onUpdate({ dailies: updated });
        }
    };

    const editSubtask = (parentId: string, subId: string, type: 'DAILIES' | 'TODOS') => {
        const items = type === 'DAILIES' ? chat.dailies : chat.todos;
        const parent = items.find(i => i.id === parentId);
        const sub = parent?.subtasks?.find(s => s.id === subId);
        if (!sub) return;

        const newText = prompt('Edit subtask:', sub.text);
        if (newText === null || newText.trim() === '') return;

        if (type === 'DAILIES') {
            const updated = chat.dailies.map(d => {
                if (d.id === parentId) {
                    return { ...d, subtasks: d.subtasks?.map(s => s.id === subId ? { ...s, text: newText } : s) };
                }
                return d;
            });
            onUpdate({ dailies: updated });
        } else {
            const updated = chat.todos.map(t => {
                if (t.id === parentId) {
                    return { ...t, subtasks: t.subtasks?.map(s => s.id === subId ? { ...s, text: newText } : s) };
                }
                return t;
            });
            onUpdate({ todos: updated });
        }
    };

    const deleteSubtask = (parentId: string, subId: string, type: 'DAILIES' | 'TODOS') => {
        if (!confirm('Delete subtask?')) return;

        if (type === 'DAILIES') {
            const updated = chat.dailies.map(d => {
                if (d.id === parentId) {
                    return { ...d, subtasks: d.subtasks?.filter(s => s.id !== subId) };
                }
                return d;
            });
            onUpdate({ dailies: updated });
        } else {
            const updated = chat.todos.map(t => {
                if (t.id === parentId) {
                    return { ...t, subtasks: t.subtasks?.filter(s => s.id !== subId) };
                }
                return t;
            });
            onUpdate({ todos: updated });
        }
    };

    const toggleSubtask = (parentId: string, subId: string, type: 'DAILIES' | 'TODOS') => {
        if (type === 'TODOS') {
            const updated = chat.todos.map(t => {
                if (t.id === parentId) {
                    return { ...t, subtasks: t.subtasks?.map(s => s.id === subId ? { ...s, completed: !s.completed } : s) };
                }
                return t;
            });
            onUpdate({ todos: updated });
        } else {
            const updated = chat.dailies.map(d => {
                if (d.id === parentId) {
                    return { ...d, subtasks: d.subtasks?.map(s => s.id === subId ? { ...s, completed: !s.completed } : s) };
                }
                return d;
            });
            onUpdate({ dailies: updated });
        }
    };

    const toggleDay = (day: string) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    return (
        <div className="missions-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(20px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div className="missions-modal" style={{
                width: '100%',
                maxWidth: '1000px',
                background: 'var(--surface)',
                borderRadius: '24px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                overflow: 'hidden'
            }}>
                <header style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <button
                            onClick={() => setActiveTab('DAILIES')}
                            style={{ background: 'none', border: 'none', color: activeTab === 'DAILIES' ? 'var(--accent)' : 'white', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer', opacity: activeTab === 'DAILIES' ? 1 : 0.5 }}
                        >
                            DAILIES <span style={{ fontSize: '0.8rem', verticalAlign: 'middle', padding: '2px 8px', background: 'var(--accent)', borderRadius: '20px', color: 'white', marginLeft: '8px' }}>{chat.dailies?.length || 0}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('TODOS')}
                            style={{ background: 'none', border: 'none', color: activeTab === 'TODOS' ? 'var(--accent)' : 'white', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer', opacity: activeTab === 'TODOS' ? 1 : 0.5 }}
                        >
                            TO-DO'S <span style={{ fontSize: '0.8rem', verticalAlign: 'middle', padding: '2px 8px', background: 'var(--accent)', borderRadius: '20px', color: 'white', marginLeft: '8px' }}>{chat.todos?.length || 0}</span>
                        </button>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>×</button>
                </header>

                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', alignContent: 'start' }}>
                    {/* Add Input Card */}
                    <div className="task-card add-card" style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', padding: '1.5rem', gap: '1rem' }}>
                        <input
                            className="settings-input"
                            placeholder={activeTab === 'DAILIES' ? "Add a Daily..." : "Add a To-Do..."}
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (activeTab === 'DAILIES' ? addDaily() : addTodo())}
                            style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', fontWeight: '700' }}
                        />

                        {activeTab === 'TODOS' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.8 }}>
                                    <input type="checkbox" checked={isTimed} onChange={(e) => setIsTimed(e.target.checked)} />
                                    SCHEDULE
                                </label>
                                {isTimed && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="date"
                                            value={newDate}
                                            onChange={(e) => setNewDate(e.target.value)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px', padding: '4px', fontSize: '0.8rem', flex: 1 }}
                                        />
                                        <input
                                            type="time"
                                            value={newTime}
                                            onChange={(e) => setNewTime(e.target.value)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', borderRadius: '4px', padding: '4px', fontSize: '0.8rem', width: '90px' }}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {['EVERYDAY', 'DAYS', 'FREQUENCY'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setDailyScheduleType(type as any)}
                                            style={{
                                                background: dailyScheduleType === type ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                                                border: 'none',
                                                color: 'white',
                                                fontSize: '0.65rem',
                                                fontWeight: '900',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                                {dailyScheduleType === 'DAYS' && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {DAYS.map(day => (
                                            <button
                                                key={day}
                                                onClick={() => toggleDay(day)}
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    background: selectedDays.includes(day) ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                                                    border: 'none',
                                                    color: 'white',
                                                    fontSize: '0.6rem',
                                                    fontWeight: '900',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {day[0]}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {dailyScheduleType === 'FREQUENCY' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            value={freqCount}
                                            onChange={(e) => setFreqCount(parseInt(e.target.value))}
                                            style={{ width: '40px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', padding: '2px 4px', borderRadius: '4px' }}
                                        />
                                        <span>times /</span>
                                        <select
                                            value={freqPeriod}
                                            onChange={(e) => setFreqPeriod(e.target.value as any)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', padding: '2px 4px', borderRadius: '4px' }}
                                        >
                                            <option value="WEEK">WEEK</option>
                                            <option value="MONTH">MONTH</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>Press Enter to save</p>
                    </div>

                    {activeTab === 'DAILIES' ? (
                        chat.dailies?.map((daily, idx) => (
                            <div
                                key={daily.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, idx)}
                                className="mission-card"
                                style={{
                                    borderLeft: `6px solid ${daily.color || 'var(--accent)'}`,
                                    cursor: 'grab',
                                    opacity: dragIndex === idx ? 0.3 : 1
                                }}
                            >
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <label style={{ display: 'flex', gap: '1rem', flex: 1, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={daily.completed} onChange={(e) => { e.stopPropagation(); toggleDaily(daily.id); }} className="mission-check" />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <h4 style={{ fontSize: '1.1rem', fontWeight: '700', textDecoration: daily.completed ? 'line-through' : 'none', opacity: daily.completed ? 0.5 : 1 }}>{daily.text}</h4>
                                                {daily.recurringDays && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--accent)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {daily.recurringDays.join(', ')}
                                                    </span>
                                                )}
                                                {daily.frequency && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--accent)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {daily.frequency.count}x / {daily.frequency.period}
                                                    </span>
                                                )}
                                            </div>

                                            {daily.subtasks && daily.subtasks.length > 0 && (
                                                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {daily.subtasks.map(sub => (
                                                        <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', flex: 1 }}>
                                                                <input type="checkbox" checked={sub.completed} onChange={(e) => { e.stopPropagation(); toggleSubtask(daily.id, sub.id, 'DAILIES'); }} />
                                                                <span style={{ opacity: sub.completed ? 0.5 : 0.8, textDecoration: sub.completed ? 'line-through' : 'none' }}>{sub.text}</span>
                                                            </label>
                                                            <div className="sub-actions" style={{ display: 'flex', gap: '8px' }}>
                                                                <button onClick={() => editSubtask(daily.id, sub.id, 'DAILIES')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '0.6rem', opacity: 0.3, cursor: 'pointer' }}>EDIT</button>
                                                                <button onClick={() => deleteSubtask(daily.id, sub.id, 'DAILIES')} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.6rem', opacity: 0.3, cursor: 'pointer' }}>DEL</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={(e) => { e.stopPropagation(); editItem(daily.id, 'DAILIES'); }} style={{ background: 'none', border: 'none', color: 'white', fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, cursor: 'pointer' }}>EDIT</button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteItem(daily.id, 'DAILIES'); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, cursor: 'pointer' }}>DEL</button>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); addSubtask(daily.id, 'DAILIES'); }}
                                            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', padding: 0 }}
                                        >
                                            + SUBTASK
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        chat.todos?.map((todo, idx) => (
                            <div
                                key={todo.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, idx)}
                                className="mission-card"
                                style={{
                                    borderLeft: `6px solid ${todo.color || 'var(--accent)'}`,
                                    cursor: 'grab',
                                    opacity: dragIndex === idx ? 0.3 : 1
                                }}
                            >
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <label style={{ display: 'flex', gap: '1rem', flex: 1, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={todo.completed} onChange={(e) => { e.stopPropagation(); toggleTodo(todo.id); }} className="mission-check" />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <h4 style={{ fontSize: '1.1rem', fontWeight: '700', textDecoration: todo.completed ? 'line-through' : 'none', opacity: todo.completed ? 0.5 : 1 }}>{todo.text}</h4>
                                                    {todo.date && <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '4px' }}>📅 {todo.date}</p>}
                                                </div>
                                                {todo.isTimed && todo.time && (
                                                    <span style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--accent)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>⏰ {todo.time}</span>
                                                )}
                                            </div>

                                            {todo.subtasks && todo.subtasks.length > 0 && (
                                                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {todo.subtasks.map(sub => (
                                                        <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', flex: 1 }}>
                                                                <input type="checkbox" checked={sub.completed} onChange={(e) => { e.stopPropagation(); toggleSubtask(todo.id, sub.id, 'TODOS'); }} />
                                                                <span style={{ opacity: sub.completed ? 0.5 : 0.8, textDecoration: sub.completed ? 'line-through' : 'none' }}>{sub.text}</span>
                                                            </label>
                                                            <div className="sub-actions" style={{ display: 'flex', gap: '8px' }}>
                                                                <button onClick={() => editSubtask(todo.id, sub.id, 'TODOS')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '0.6rem', opacity: 0.3, cursor: 'pointer' }}>EDIT</button>
                                                                <button onClick={() => deleteSubtask(todo.id, sub.id, 'TODOS')} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.6rem', opacity: 0.3, cursor: 'pointer' }}>DEL</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={(e) => { e.stopPropagation(); toggleTodoTime(todo.id); }} style={{ background: 'none', border: 'none', color: todo.isTimed ? 'var(--accent)' : 'white', fontSize: '0.65rem', fontWeight: '800', opacity: todo.isTimed ? 1 : 0.5, cursor: 'pointer' }}>{todo.isTimed ? 'TIMED' : 'TIME'}</button>
                                            <button onClick={(e) => { e.stopPropagation(); editItem(todo.id, 'TODOS'); }} style={{ background: 'none', border: 'none', color: 'white', fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, cursor: 'pointer' }}>EDIT</button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteItem(todo.id, 'TODOS'); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, cursor: 'pointer' }}>DEL</button>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); addSubtask(todo.id, 'TODOS'); }}
                                            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', padding: 0 }}
                                        >
                                            + SUBTASK
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <style jsx>{`
            .mission-card {
                background: rgba(255,255,255,0.03);
                border-radius: 12px;
                padding: 1.5rem;
                transition: all 0.2s;
                border: 1px solid var(--border);
            }
            .mission-card:hover {
                background: rgba(255,255,255,0.05);
                transform: translateY(-2px);
            }
            .mission-card:hover .sub-actions button {
                opacity: 0.6 !important;
            }
            .mission-card:active {
                cursor: grabbing;
            }
            .mission-check {
                width: 24px;
                height: 24px;
                cursor: pointer;
                accent-color: var(--accent);
            }
        `}</style>
        </div>
    );
}
