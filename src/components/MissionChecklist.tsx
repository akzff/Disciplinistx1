'use client';

import { useState } from 'react';
import { storage, DailyChat } from '@/lib/storage';
import Link from 'next/link';

interface MissionChecklistProps {
    todos: DailyChat['todos'];
    dailies: DailyChat['dailies'];
    expenses: DailyChat['expenses'];
    onToggleTodo: (id: string) => void;
    onToggleDaily: (id: string) => void;
    onReorderTodo: (newTodos: DailyChat['todos']) => void;
    onReorderDaily: (newDailies: DailyChat['dailies']) => void;
    onStartLiveMission: (name: string) => void;
    onAddExpense: (amount: number, text: string) => void;
    onRemoveExpense: (id: string) => void;
}

export default function MissionChecklist({ todos, dailies, expenses = [], onToggleTodo, onToggleDaily, onReorderTodo, onReorderDaily, onStartLiveMission, onAddExpense, onRemoveExpense }: MissionChecklistProps) {
    const [dragInfo, setDragInfo] = useState<{ index: number; type: 'DAILIES' | 'TODOS' } | null>(null);
    const [isStartingLive, setIsStartingLive] = useState(false);
    const [liveInput, setLiveInput] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDesc, setExpenseDesc] = useState('');

    const handleDragStart = (e: React.DragEvent, index: number, type: 'DAILIES' | 'TODOS') => {
        setDragInfo({ index, type });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number, type: 'DAILIES' | 'TODOS') => {
        e.preventDefault();
        if (!dragInfo || dragInfo.type !== type) return;

        const items = type === 'DAILIES' ? [...dailies] : [...todos];
        const [reorderedItem] = items.splice(dragInfo.index, 1);
        items.splice(targetIndex, 0, reorderedItem);

        if (type === 'DAILIES') onReorderDaily(items);
        else onReorderTodo(items);

        setDragInfo(null);
    };

    return (
        <div className="mission-checklist no-scrollbar" style={{
            width: '300px',
            borderRight: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            flexDirection: 'column',
            padding: '1.5rem',
            overflowY: 'auto',
            overflowX: 'hidden',
            gap: '1.5rem'
        }}>
            <section style={{ marginBottom: '0.5rem' }}>
                {isStartingLive ? (
                    <div className="live-input-box" style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid var(--accent)',
                        borderRadius: '12px',
                        padding: '10px',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <input
                            autoFocus
                            placeholder="Current Mission..."
                            value={liveInput}
                            onChange={(e) => setLiveInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && liveInput.trim()) {
                                    onStartLiveMission(liveInput);
                                    setIsStartingLive(false);
                                    setLiveInput('');
                                } else if (e.key === 'Escape') {
                                    setIsStartingLive(false);
                                }
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                width: '100%',
                                outline: 'none',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                marginBottom: '8px'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    if (liveInput.trim()) {
                                        onStartLiveMission(liveInput);
                                        setIsStartingLive(false);
                                        setLiveInput('');
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    background: 'var(--accent)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: 'white',
                                    padding: '4px',
                                    fontSize: '0.65rem',
                                    fontWeight: '900',
                                    cursor: 'pointer'
                                }}
                            >START</button>
                            <button
                                onClick={() => setIsStartingLive(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: 'white',
                                    padding: '4px 8px',
                                    fontSize: '0.65rem',
                                    fontWeight: '900',
                                    cursor: 'pointer'
                                }}
                            >×</button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsStartingLive(true)}
                        className="live-mission-trigger"
                        style={{
                            width: '100%',
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '10px',
                            fontWeight: '900',
                            fontSize: '0.7rem',
                            letterSpacing: '0.1em',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>🔥</span> LIVE MISSION
                    </button>
                )}
            </section>
            <section>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#10b981', letterSpacing: '0.1em', marginBottom: '1rem', textTransform: 'uppercase' }}>Dailies</h3>
                <div
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                    {dailies.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.3 }}>No dailies established.</p>}
                    {dailies.map((daily, idx) => (
                        <div
                            key={daily.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx, 'DAILIES')}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, idx, 'DAILIES')}
                            className="draggable-item"
                            style={{
                                display: 'flex',
                                gap: '10px',
                                alignItems: 'flex-start',
                                cursor: 'grab',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                background: dragInfo?.index === idx && dragInfo.type === 'DAILIES' ? 'rgba(255,255,255,0.05)' : 'transparent',
                                transition: 'background 0.2s'
                            }}
                        >
                            <div style={{ opacity: 0.3, marginTop: '4px', fontSize: '0.7rem' }}>⋮⋮</div>
                            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', flex: 1 }}>
                                <input
                                    type="checkbox"
                                    checked={daily.completed}
                                    onChange={() => onToggleDaily(daily.id)}
                                    style={{ cursor: 'pointer', marginTop: '3px', accentColor: '#10b981' }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        opacity: daily.completed ? 0.4 : 1,
                                        textDecoration: daily.completed ? 'line-through' : 'none'
                                    }}>
                                        {daily.text}
                                    </span>
                                    {(daily.recurringDays && daily.recurringDays.length > 0) && (
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#10b981', opacity: daily.completed ? 0.4 : 0.7 }}>🔁 {daily.recurringDays.join(', ')}</span>
                                    )}
                                    {daily.frequency && (
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#10b981', opacity: daily.completed ? 0.4 : 0.7 }}>📉 {daily.frequency.count}x / {daily.frequency.period}</span>
                                    )}
                                </div>
                            </label>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '1rem', textTransform: 'uppercase' }}>To-Do's</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {todos.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.3 }}>No to-do's assigned.</p>}
                    {todos.map((todo, idx) => (
                        <div
                            key={todo.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx, 'TODOS')}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, idx, 'TODOS')}
                            className="draggable-item"
                            style={{
                                display: 'flex',
                                gap: '10px',
                                alignItems: 'flex-start',
                                cursor: 'grab',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                background: dragInfo?.index === idx && dragInfo.type === 'TODOS' ? 'rgba(255,255,255,0.05)' : 'transparent',
                                transition: 'background 0.2s'
                            }}
                        >
                            <div style={{ opacity: 0.3, marginTop: '4px', fontSize: '0.7rem' }}>⋮⋮</div>
                            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', flex: 1 }}>
                                <input
                                    type="checkbox"
                                    checked={todo.completed}
                                    onChange={() => onToggleTodo(todo.id)}
                                    style={{ cursor: 'pointer', marginTop: '3px', accentColor: 'var(--accent)' }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        opacity: todo.completed ? 0.4 : 1,
                                        textDecoration: todo.completed ? 'line-through' : 'none'
                                    }}>
                                        {todo.text}
                                    </span>
                                    {todo.isTimed && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {todo.date && <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: todo.completed ? 0.4 : 0.6 }}>📅 {todo.date}</span>}
                                            {todo.time && <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--accent)', opacity: todo.completed ? 0.4 : 0.8 }}>⏰ {todo.time}</span>}
                                        </div>
                                    )}
                                </div>
                            </label>
                        </div>
                    ))}
                </div>
            </section>

            <section style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Resources</h3>
                    <Link href="/expenses" style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--accent)', textDecoration: 'none', opacity: 0.8 }}>MANAGE →</Link>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    <input
                        type="number"
                        placeholder="$"
                        value={expenseAmount}
                        onChange={e => setExpenseAmount(e.target.value)}
                        style={{ width: '60px', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', fontSize: '0.75rem', outline: 'none' }}
                    />
                    <input
                        type="text"
                        placeholder="Log expense..."
                        value={expenseDesc}
                        onChange={e => setExpenseDesc(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && expenseAmount && expenseDesc) {
                                onAddExpense(Number(expenseAmount), expenseDesc);
                                setExpenseAmount('');
                                setExpenseDesc('');
                            }
                        }}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', fontSize: '0.75rem', outline: 'none' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {expenses.length > 0 ? (
                        <>
                            {expenses.slice(-3).map((exp) => (
                                <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: '600', opacity: 0.8 }}>{exp.text}</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#f59e0b' }}>${exp.amount.toFixed(2)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.4 }}>TOTAL TODAY</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white' }}>${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</span>
                            </div>
                        </>
                    ) : (
                        <p style={{ fontSize: '0.75rem', opacity: 0.3, fontStyle: 'italic', textAlign: 'center' }}>No resource drain today.</p>
                    )}
                </div>
            </section>

            <style jsx>{`
        .draggable-item:hover {
          background: rgba(255,255,255,0.03) !important;
        }
        .draggable-item:active {
          cursor: grabbing;
        }
        .live-mission-trigger:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }
        .live-mission-trigger:active {
          transform: translateY(0);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
