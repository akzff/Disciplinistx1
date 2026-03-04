'use client';

import React, { useState } from 'react';
import { DailyChat, formatTime } from '@/lib/storage';
import { MissionCheckbox } from '@/components/Checkbox';

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

export default function MissionChecklist({ todos, dailies, sidebarOpen, onClose, onToggleTodo, onToggleDaily, onReorderTodo, onReorderDaily, onStartLiveMission, onAddDaily, onEditDaily, onDeleteDaily, onAddTodo, onEditTodo, onDeleteTodo }: MissionChecklistProps) {

    const [dragInfo, setDragInfo] = useState<{ index: number; type: 'DAILIES' | 'TODOS' } | null>(null);
    const [isStartingLive, setIsStartingLive] = useState(false);
    const [liveInput, setLiveInput] = useState('');
    const [addingType, setAddingType] = useState<'DAILIES' | 'TODOS' | null>(null);
    const [addingText, setAddingText] = useState('');
    const [editingItem, setEditingItem] = useState<{ id: string; type: 'DAILIES' | 'TODOS'; text: string } | null>(null);

    const handleSaveAdd = () => {
        if (!addingText.trim()) return;
        if (addingType === 'DAILIES' && onAddDaily) onAddDaily(addingText);
        if (addingType === 'TODOS' && onAddTodo) onAddTodo(addingText);
        setAddingType(null);
        setAddingText('');
    };

    const handleSaveEdit = () => {
        if (!editingItem?.text.trim()) return;
        if (editingItem.type === 'DAILIES' && onEditDaily) onEditDaily(editingItem.id, editingItem.text);
        if (editingItem.type === 'TODOS' && onEditTodo) onEditTodo(editingItem.id, editingItem.text);
        setEditingItem(null);
    };

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
        <div className={`mission-checklist no-scrollbar${sidebarOpen ? ' sidebar-open' : ''}`} style={{
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
            {/* Mobile close button */}
            {onClose && (
                <button
                    className="sidebar-toggle-btn"
                    onClick={onClose}
                    style={{ display: 'none', alignSelf: 'flex-end', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', marginBottom: '-1rem' }}
                    aria-label="Close"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            )}
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
                            placeholder="Current Task..."
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
                            background: '#d4a017',
                            color: 'black',
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
                            boxShadow: '0 0 24px rgba(212, 160, 23, 0.4)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>🔥</span> START TASK
                    </button>
                )}
            </section>
            <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#d4a017', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Dailies</h3>
                    <button onClick={() => { setAddingType('DAILIES'); setAddingText(''); }} style={{ background: 'none', border: 'none', color: '#d4a017', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px', fontWeight: 'bold' }}>+</button>
                </div>
                {addingType === 'DAILIES' && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            autoFocus
                            value={addingText}
                            onChange={(e) => setAddingText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAdd(); else if (e.key === 'Escape') setAddingType(null); }}
                            placeholder="New daily..."
                            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '0.8rem', outline: 'none' }}
                        />
                        <button onClick={handleSaveAdd} style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: 'white', padding: '0 12px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>ADD</button>
                    </div>
                )}
                <div
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                    {dailies.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.3 }}>No dailies added.</p>}
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
                                <MissionCheckbox
                                    checked={daily.completed}
                                    onChange={() => onToggleDaily(daily.id)}
                                    variant="daily"
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                    {editingItem?.id === daily.id ? (
                                        <input
                                            autoFocus
                                            value={editingItem.text}
                                            onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                            onBlur={handleSaveEdit}
                                            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'white', padding: '4px 6px', fontSize: '0.85rem', width: '100%', outline: 'none' }}
                                        />
                                    ) : (
                                        <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingItem({ id: daily.id, type: 'DAILIES', text: daily.text }); }} style={{
                                            fontSize: '0.85rem',
                                            fontWeight: '600',
                                            opacity: daily.completed ? 0.4 : 1,
                                            textDecoration: daily.completed ? 'line-through' : 'none'
                                        }}>
                                            {daily.text}
                                        </span>
                                    )}
                                    {(daily.recurringDays && daily.recurringDays.length > 0) && (
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#10b981', opacity: daily.completed ? 0.4 : 0.7 }}>🔁 {daily.recurringDays.join(', ')}</span>
                                    )}
                                    {daily.frequency && (
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#10b981', opacity: daily.completed ? 0.4 : 0.7 }}>📉 {daily.frequency.count}x / {daily.frequency.period}</span>
                                    )}
                                </div>
                            </label>
                            {onDeleteDaily && (
                                <button onClick={() => onDeleteDaily(daily.id)} className="delete-btn" style={{ background: 'none', border: 'none', color: '#ff4444', opacity: 0.6, cursor: 'pointer', fontSize: '1rem', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#d4a017', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>To-Do&apos;s</h3>
                    <button onClick={() => { setAddingType('TODOS'); setAddingText(''); }} style={{ background: 'none', border: 'none', color: '#d4a017', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px', fontWeight: 'bold' }}>+</button>
                </div>
                {addingType === 'TODOS' && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            autoFocus
                            value={addingText}
                            onChange={(e) => setAddingText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAdd(); else if (e.key === 'Escape') setAddingType(null); }}
                            placeholder="New to-do..."
                            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '0.8rem', outline: 'none' }}
                        />
                        <button onClick={handleSaveAdd} style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: 'white', padding: '0 12px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>ADD</button>
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {todos.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.3 }}>No to-dos added.</p>}
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
                                <MissionCheckbox
                                    checked={todo.completed}
                                    onChange={() => onToggleTodo(todo.id)}
                                    variant="todo"
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                    {editingItem?.id === todo.id ? (
                                        <input
                                            autoFocus
                                            value={editingItem.text}
                                            onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                            onBlur={handleSaveEdit}
                                            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'white', padding: '4px 6px', fontSize: '0.85rem', width: '100%', outline: 'none' }}
                                        />
                                    ) : (
                                        <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingItem({ id: todo.id, type: 'TODOS', text: todo.text }); }} style={{
                                            fontSize: '0.85rem',
                                            fontWeight: '600',
                                            opacity: todo.completed ? 0.4 : 1,
                                            textDecoration: todo.completed ? 'line-through' : 'none'
                                        }}>
                                            {todo.text}
                                        </span>
                                    )}
                                    {todo.isTimed && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {todo.date && <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: todo.completed ? 0.4 : 0.6 }}>📅 {todo.date}</span>}
                                            {todo.time && <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--accent)', opacity: todo.completed ? 0.4 : 0.8 }}>⏰ {todo.time}</span>}
                                        </div>
                                    )}
                                </div>
                            </label>
                            {onDeleteTodo && (
                                <button onClick={() => onDeleteTodo(todo.id)} className="delete-btn" style={{ background: 'none', border: 'none', color: '#ff4444', opacity: 0.6, cursor: 'pointer', fontSize: '1rem', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            )}
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
        .live-mission-trigger:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(212, 160, 23, 0.6);
          background: #b8860b;
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
