'use client';

import { useState } from 'react';
import { DailyChat } from '@/lib/storage';

interface MissionChecklistProps {
    todos: DailyChat['todos'];
    dailies: DailyChat['dailies'];
    onToggleTodo: (id: string) => void;
    onToggleDaily: (id: string) => void;
    onReorderTodo: (newTodos: DailyChat['todos']) => void;
    onReorderDaily: (newDailies: DailyChat['dailies']) => void;
}

export default function MissionChecklist({ todos, dailies, onToggleTodo, onToggleDaily, onReorderTodo, onReorderDaily }: MissionChecklistProps) {
    const [dragInfo, setDragInfo] = useState<{ index: number; type: 'DAILIES' | 'TODOS' } | null>(null);

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
        <div className="mission-checklist" style={{
            width: '300px',
            borderRight: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            flexDirection: 'column',
            padding: '1.5rem',
            overflowY: 'auto',
            gap: '2rem'
        }}>
            <section>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#10b981', letterSpacing: '0.1em', marginBottom: '1rem', textTransform: 'uppercase' }}>Daily Rites</h3>
                <div
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                    {dailies.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.3 }}>No rites established.</p>}
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
                <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '1rem', textTransform: 'uppercase' }}>Mission Map</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {todos.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.3 }}>No missions assigned.</p>}
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

            <style jsx>{`
        .draggable-item:hover {
          background: rgba(255,255,255,0.03) !important;
        }
        .draggable-item:active {
          cursor: grabbing;
        }
      `}</style>
        </div>
    );
}
