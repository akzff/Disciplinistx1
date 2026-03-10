'use client';

import React, { useState } from 'react';
import { DailyChat } from '@/lib/storage';
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

export default function MissionChecklist({
    todos, dailies, sidebarOpen, onClose,
    onToggleTodo, onToggleDaily, onReorderTodo, onReorderDaily,
    onStartLiveMission,
    onAddDaily, onEditDaily, onDeleteDaily,
    onAddTodo, onEditTodo, onDeleteTodo
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

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

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
        <>
            {/* Backdrop for mobile */}
            {sidebarOpen && (
                <div className="mc-backdrop" onClick={onClose} />
            )}

            <aside className={`mission-checklist no-scrollbar${sidebarOpen ? ' sidebar-open' : ''}`}>

                {/* ── Header ── */}
                <div className="mc-header">
                    <div className="mc-header__title">
                        <span className="mc-header__icon">🎯</span>
                        <div>
                            <p className="mc-header__label">MISSION BOARD</p>
                            <p className="mc-header__sub">
                                {completedDailies + completedTodos} / {totalDailies + totalTodos} complete
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="mc-close-btn" aria-label="Close">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* ── Progress bar ── */}
                {(totalDailies + totalTodos) > 0 && (
                    <div className="mc-progress-bar">
                        <div
                            className="mc-progress-fill"
                            style={{ width: `${Math.round(((completedDailies + completedTodos) / (totalDailies + totalTodos)) * 100)}%` }}
                        />
                    </div>
                )}

                {/* ── START TASK Button ── */}
                <div className="mc-start-section">
                    {isStartingLive ? (
                        <div className="mc-task-input-box">
                            <div className="mc-task-input-header">
                                <span>⚡ NAME YOUR MISSION</span>
                                <button onClick={() => setIsStartingLive(false)} className="mc-task-cancel">✕</button>
                            </div>
                            <input
                                autoFocus
                                placeholder="e.g. Deep work session..."
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
                                className="mc-task-input"
                            />
                            <button
                                onClick={() => {
                                    if (liveInput.trim()) {
                                        onStartLiveMission(liveInput);
                                        setIsStartingLive(false);
                                        setLiveInput('');
                                    }
                                }}
                                className="mc-task-start-btn"
                            >
                                🔥 LAUNCH MISSION
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setIsStartingLive(true)} className="mc-start-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            START TASK
                        </button>
                    )}
                </div>

                {/* ── Dailies Section ── */}
                <section className="mc-section">
                    <div className="mc-section__header">
                        <div className="mc-section__title">
                            <span className="mc-section__dot mc-section__dot--daily" />
                            <span>DAILIES</span>
                            {totalDailies > 0 && (
                                <span className="mc-section__count">{completedDailies}/{totalDailies}</span>
                            )}
                        </div>
                        <button
                            onClick={() => { setAddingType('DAILIES'); setAddingText(''); }}
                            className="mc-add-btn"
                            aria-label="Add daily"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                    </div>

                    {addingType === 'DAILIES' && (
                        <div className="mc-add-row">
                            <input
                                autoFocus
                                value={addingText}
                                onChange={(e) => setAddingText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveAdd();
                                    else if (e.key === 'Escape') setAddingType(null);
                                }}
                                placeholder="New daily habit..."
                                className="mc-add-input mc-add-input--daily"
                            />
                            <button onClick={handleSaveAdd} className="mc-add-confirm mc-add-confirm--daily">ADD</button>
                        </div>
                    )}

                    <div className="mc-item-list">
                        {dailies.length === 0 && (
                            <p className="mc-empty">No dailies yet. Add your recurring habits.</p>
                        )}
                        {dailies.map((daily, idx) => (
                            <div
                                key={daily.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx, 'DAILIES')}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, idx, 'DAILIES')}
                                className={`mc-item${dragInfo?.index === idx && dragInfo.type === 'DAILIES' ? ' mc-item--dragging' : ''}`}
                            >
                                <div className="mc-item__drag">⋮⋮</div>
                                <MissionCheckbox checked={daily.completed} onChange={() => onToggleDaily(daily.id)} variant="daily" />
                                <div className="mc-item__content">
                                    {editingItem?.id === daily.id ? (
                                        <input
                                            autoFocus
                                            value={editingItem.text}
                                            onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                            onBlur={handleSaveEdit}
                                            className="mc-item__edit-input"
                                        />
                                    ) : (
                                        <span
                                            onClick={(e) => { e.stopPropagation(); setEditingItem({ id: daily.id, type: 'DAILIES', text: daily.text }); }}
                                            className={`mc-item__text${daily.completed ? ' mc-item__text--done' : ''}`}
                                        >
                                            {daily.text}
                                        </span>
                                    )}
                                    {daily.recurringDays && daily.recurringDays.length > 0 && (
                                        <span className="mc-item__tag mc-item__tag--green">🔁 {daily.recurringDays.join(', ')}</span>
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

                {/* ── To-Do Section ── */}
                <section className="mc-section">
                    <div className="mc-section__header">
                        <div className="mc-section__title">
                            <span className="mc-section__dot mc-section__dot--todo" />
                            <span>TO-DO&apos;S</span>
                            {totalTodos > 0 && (
                                <span className="mc-section__count">{completedTodos}/{totalTodos}</span>
                            )}
                        </div>
                        <button
                            onClick={() => { setAddingType('TODOS'); setAddingText(''); }}
                            className="mc-add-btn"
                            aria-label="Add todo"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                    </div>

                    {addingType === 'TODOS' && (
                        <div className="mc-add-row">
                            <input
                                autoFocus
                                value={addingText}
                                onChange={(e) => setAddingText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveAdd();
                                    else if (e.key === 'Escape') setAddingType(null);
                                }}
                                placeholder="New task..."
                                className="mc-add-input mc-add-input--todo"
                            />
                            <button onClick={handleSaveAdd} className="mc-add-confirm mc-add-confirm--todo">ADD</button>
                        </div>
                    )}

                    <div className="mc-item-list">
                        {todos.length === 0 && (
                            <p className="mc-empty">No tasks yet. What needs to get done?</p>
                        )}
                        {todos.map((todo, idx) => (
                            <div
                                key={todo.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx, 'TODOS')}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, idx, 'TODOS')}
                                className={`mc-item${dragInfo?.index === idx && dragInfo.type === 'TODOS' ? ' mc-item--dragging' : ''}`}
                            >
                                <div className="mc-item__drag">⋮⋮</div>
                                <MissionCheckbox checked={todo.completed} onChange={() => onToggleTodo(todo.id)} variant="todo" />
                                <div className="mc-item__content">
                                    {editingItem?.id === todo.id ? (
                                        <input
                                            autoFocus
                                            value={editingItem.text}
                                            onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                            onBlur={handleSaveEdit}
                                            className="mc-item__edit-input"
                                        />
                                    ) : (
                                        <span
                                            onClick={(e) => { e.stopPropagation(); setEditingItem({ id: todo.id, type: 'TODOS', text: todo.text }); }}
                                            className={`mc-item__text${todo.completed ? ' mc-item__text--done' : ''}`}
                                        >
                                            {todo.text}
                                        </span>
                                    )}
                                    {todo.isTimed && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                                            {todo.date && <span className="mc-item__tag">📅 {todo.date}</span>}
                                            {todo.time && <span className="mc-item__tag mc-item__tag--accent">⏰ {todo.time}</span>}
                                        </div>
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
        </>
    );
}
