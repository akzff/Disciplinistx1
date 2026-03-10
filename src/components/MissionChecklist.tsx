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
            <style jsx global>{`
                .sidebar-scroll::-webkit-scrollbar { width: 4px; }
                .sidebar-scroll::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                }
                .sidebar-scroll::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>

            {/* Backdrop for mobile */}
            {sidebarOpen && (
                <div className="mc-backdrop md:hidden" onClick={onClose} />
            )}

            {/* ────────── MOBILE SIDEBAR (Untouched CSS classes) ────────── */}
            <aside className={`mission-checklist md:hidden no-scrollbar${sidebarOpen ? ' sidebar-open' : ''}`}>
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

                {(totalDailies + totalTodos) > 0 && (
                    <div className="mc-progress-bar">
                        <div
                            className="mc-progress-fill"
                            style={{ width: `${Math.round(((completedDailies + completedTodos) / (totalDailies + totalTodos)) * 100)}%` }}
                        />
                    </div>
                )}

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

                {/* Mobile Dailies Section */}
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
                            <input autoFocus value={addingText} onChange={(e) => setAddingText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAdd(); else if (e.key === 'Escape') setAddingType(null); }}
                                placeholder="New daily habit..." className="mc-add-input mc-add-input--daily" />
                            <button onClick={handleSaveAdd} className="mc-add-confirm mc-add-confirm--daily">ADD</button>
                        </div>
                    )}

                    <div className="mc-item-list">
                        {dailies.length === 0 && (
                            <p className="mc-empty">No dailies yet. Add your recurring habits.</p>
                        )}
                        {dailies.map((daily, idx) => (
                            <div key={daily.id} draggable onDragStart={(e) => handleDragStart(e, idx, 'DAILIES')}
                                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'DAILIES')}
                                className={`mc-item${dragInfo?.index === idx && dragInfo.type === 'DAILIES' ? ' mc-item--dragging' : ''}`}
                            >
                                <div className="mc-item__drag">⋮⋮</div>
                                <MissionCheckbox checked={daily.completed} onChange={() => onToggleDaily(daily.id)} variant="daily" />
                                <div className="mc-item__content">
                                    {editingItem?.id === daily.id ? (
                                        <input autoFocus value={editingItem.text} onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                            onBlur={handleSaveEdit} className="mc-item__edit-input" />
                                    ) : (
                                        <span onClick={(e) => { e.stopPropagation(); setEditingItem({ id: daily.id, type: 'DAILIES', text: daily.text }); }}
                                            className={`mc-item__text${daily.completed ? ' mc-item__text--done' : ''}`}
                                        >{daily.text}</span>
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

                {/* Mobile To-Do Section */}
                <section className="mc-section">
                    <div className="mc-section__header">
                        <div className="mc-section__title">
                            <span className="mc-section__dot mc-section__dot--todo" />
                            <span>TO-DO&apos;S</span>
                            {totalTodos > 0 && (
                                <span className="mc-section__count">{completedTodos}/{totalTodos}</span>
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
                        {todos.length === 0 && (
                            <p className="mc-empty">No tasks yet. What needs to get done?</p>
                        )}
                        {todos.map((todo, idx) => (
                            <div key={todo.id} draggable onDragStart={(e) => handleDragStart(e, idx, 'TODOS')}
                                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'TODOS')}
                                className={`mc-item${dragInfo?.index === idx && dragInfo.type === 'TODOS' ? ' mc-item--dragging' : ''}`}
                            >
                                <div className="mc-item__drag">⋮⋮</div>
                                <MissionCheckbox checked={todo.completed} onChange={() => onToggleTodo(todo.id)} variant="todo" />
                                <div className="mc-item__content">
                                    {editingItem?.id === todo.id ? (
                                        <input autoFocus value={editingItem.text} onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                            onBlur={handleSaveEdit} className="mc-item__edit-input" />
                                    ) : (
                                        <span onClick={(e) => { e.stopPropagation(); setEditingItem({ id: todo.id, type: 'TODOS', text: todo.text }); }}
                                            className={`mc-item__text${todo.completed ? ' mc-item__text--done' : ''}`}
                                        >{todo.text}</span>
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


            {/* ────────── DESKTOP SIDEBAR (Full Redesign) ────────── */}
            <aside className="hidden md:flex flex-shrink-0 w-[300px] h-full border-r border-[#d4a017]/10 flex-col overflow-hidden bg-[#0a0a0a]">
                <div className="flex flex-col h-full p-4 gap-3">

                    {/* ZONE A — MISSION BOARD */}
                    <div className="flex-shrink-0 bg-gradient-to-br from-[#1a1500] to-[#0f0f0f] border border-[#d4a017]/20 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#d4a017]/15 border border-[#d4a017]/25 flex items-center justify-center text-base">
                                    🎯
                                </div>
                                <div>
                                    <p className="text-[#d4a017] font-black text-xs tracking-widest uppercase">Mission Board</p>
                                    <p className="text-white/30 text-[10px] mt-0.5">Today&apos;s objectives</p>
                                </div>
                            </div>

                            {onClose && (
                                <button onClick={onClose} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/60 transition-all active:scale-90 text-xs">
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <span className="text-white/30 text-[10px]">
                                    {completedDailies + completedTodos} / {totalDailies + totalTodos} complete
                                </span>
                                <span className="text-[#d4a017] text-[10px] font-bold">
                                    {(totalDailies + totalTodos) > 0 ? Math.round(((completedDailies + completedTodos) / (totalDailies + totalTodos)) * 100) : 0}%
                                </span>
                            </div>

                            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[#d4a017] to-[#f5c842] rounded-full transition-all duration-700"
                                    style={{ width: `${(totalDailies + totalTodos) > 0 ? ((completedDailies + completedTodos) / (totalDailies + totalTodos)) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ZONE B — START TASK */}
                    {isStartingLive ? (
                        <div className="flex-shrink-0 w-full p-3 bg-[#10b981]/10 border border-[#10b981]/25 rounded-xl flex flex-col gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.15)]">
                            <div className="flex justify-between items-center text-[10px] font-black tracking-widest text-[#10b981]">
                                <span>⚡ NAME YOUR MISSION</span>
                                <button onClick={() => setIsStartingLive(false)} className="text-white/40 hover:text-white transition-colors">✕</button>
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
                                className="bg-white/5 border border-white/10 rounded-lg text-white p-2 text-xs font-semibold w-full outline-none focus:border-[#10b981]/50 focus:bg-[#10b981]/5 transition-colors"
                            />
                            <button
                                onClick={() => {
                                    if (liveInput.trim()) {
                                        onStartLiveMission(liveInput);
                                        setIsStartingLive(false);
                                        setLiveInput('');
                                    }
                                }}
                                className="bg-gradient-to-br from-[#10b981] to-[#059669] text-white border-none rounded-lg p-2 text-[10px] font-black tracking-widest flex items-center justify-center cursor-pointer transition-all hover:shadow-[0_4px_16px_rgba(16,185,129,0.4)] hover:-translate-y-px"
                            >
                                🔥 LAUNCH MISSION
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsStartingLive(true)}
                            className="flex-shrink-0 w-full py-3.5 bg-gradient-to-r from-[#d4a017] to-[#c49010] hover:from-[#e6b020] hover:to-[#d4a017] text-black font-black text-sm tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(212,160,23,0.3)] hover:shadow-[0_6px_28px_rgba(212,160,23,0.5)] active:scale-[0.97] transition-all duration-200 group"
                        >
                            <span className="group-hover:scale-110 transition-transform text-base">▶</span>
                            START TASK
                        </button>
                    )}

                    {/* ZONE C — DAILIES */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden">
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                                <span className="text-white/70 font-black text-xs tracking-widest uppercase">Dailies</span>
                                {totalDailies > 0 && (
                                    <span className="text-[10px] bg-[#d4a017]/15 text-[#d4a017] border border-[#d4a017]/25 px-1.5 py-0.5 rounded-full font-bold">
                                        {completedDailies}/{totalDailies}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => { setAddingType('DAILIES'); setAddingText(''); }}
                                className="w-6 h-6 rounded-lg bg-[#d4a017]/10 hover:bg-[#d4a017]/20 border border-[#d4a017]/20 hover:border-[#d4a017]/40 flex items-center justify-center text-[#d4a017] text-sm font-bold transition-all active:scale-90"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto sidebar-scroll p-3 flex flex-col gap-1.5">
                            {addingType === 'DAILIES' && (
                                <div className="flex items-center gap-2 p-2 bg-[#1a1a1a] rounded-xl border border-[#d4a017]/20 focus-within:border-[#d4a017]/50 transition-all">
                                    <div className="w-5 h-5 rounded-md border-2 border-dashed border-white/20 flex-shrink-0" />
                                    <input
                                        autoFocus placeholder="Add daily..."
                                        value={addingText} onChange={(e) => setAddingText(e.target.value)}
                                        className="flex-1 bg-transparent text-white/80 text-sm placeholder:text-white/20 outline-none"
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAdd(); if (e.key === 'Escape') setAddingType(null); }}
                                        onBlur={handleSaveAdd}
                                    />
                                </div>
                            )}

                            {totalDailies === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 gap-2 opacity-40">
                                    <span className="text-2xl">🌅</span>
                                    <p className="text-white/40 text-xs text-center leading-relaxed">No dailies yet.<br />Add your recurring habits.</p>
                                </div>
                            ) : (
                                dailies.map((daily, idx) => (
                                    <div key={daily.id}
                                        draggable onDragStart={(e) => handleDragStart(e, idx, 'DAILIES')}
                                        onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'DAILIES')}
                                        className={`flex items-center gap-3 p-2.5 rounded-xl group cursor-pointer transition-all duration-200 hover:bg-white/5 active:scale-[0.98] ${daily.completed ? 'opacity-60' : 'opacity-100'} ${dragInfo?.index === idx && dragInfo.type === 'DAILIES' ? 'bg-white/10 opacity-70' : ''}`}
                                        onClick={() => onToggleDaily(daily.id)}
                                    >
                                        <div className={`w-5 h-5 rounded-md flex-shrink-0 border-2 flex items-center justify-center transition-all duration-200 ${daily.completed ? 'bg-emerald-400 border-emerald-400' : 'border-white/20 group-hover:border-[#d4a017]/50'}`}>
                                            {daily.completed && (
                                                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        {editingItem?.id === daily.id ? (
                                            <input autoFocus value={editingItem.text} onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                                onBlur={handleSaveEdit} className="bg-white/10 border border-white/20 rounded text-white px-2 py-0.5 text-sm w-full outline-none" />
                                        ) : (
                                            <span onClick={(e) => { e.stopPropagation(); setEditingItem({ id: daily.id, type: 'DAILIES', text: daily.text }); }}
                                                className={`text-sm flex-1 min-w-0 truncate transition-all duration-200 hover:text-white ${daily.completed ? 'line-through text-white/30' : 'text-white/80'}`}>
                                                {daily.text}
                                            </span>
                                        )}
                                        {onDeleteDaily && (
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteDaily(daily.id); }} className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 hover:bg-red-400/10 rounded overflow-hidden p-1 transition-all flex-shrink-0">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ZONE D — TO-DO'S */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden">
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_#a78bfa]" />
                                <span className="text-white/70 font-black text-xs tracking-widest uppercase">To-Do&apos;s</span>
                                {(totalTodos - completedTodos) > 0 && (
                                    <span className="text-[10px] bg-violet-400/10 text-violet-400 border border-violet-400/20 px-1.5 py-0.5 rounded-full font-bold">
                                        {totalTodos - completedTodos} left
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => { setAddingType('TODOS'); setAddingText(''); }}
                                className="w-6 h-6 rounded-lg bg-violet-400/10 hover:bg-violet-400/20 border border-violet-400/20 hover:border-violet-400/40 flex items-center justify-center text-violet-400 text-sm font-bold transition-all active:scale-90"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto sidebar-scroll p-3 flex flex-col gap-1.5">
                            {addingType === 'TODOS' && (
                                <div className="flex items-center gap-2 p-2 bg-[#1a1a1a] rounded-xl border border-violet-400/20 focus-within:border-violet-400/50 transition-all">
                                    <div className="w-5 h-5 rounded-md border-2 border-dashed border-white/20 flex-shrink-0" />
                                    <input
                                        autoFocus placeholder="Add todo..."
                                        value={addingText} onChange={(e) => setAddingText(e.target.value)}
                                        className="flex-1 bg-transparent text-white/80 text-sm placeholder:text-white/20 outline-none"
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAdd(); if (e.key === 'Escape') setAddingType(null); }}
                                        onBlur={handleSaveAdd}
                                    />
                                </div>
                            )}

                            {totalTodos === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 gap-2 opacity-40">
                                    <span className="text-2xl">📋</span>
                                    <p className="text-white/40 text-xs text-center leading-relaxed">No tasks yet.<br />What needs to get done?</p>
                                </div>
                            ) : (
                                todos.map((todo, idx) => (
                                    <div key={todo.id}
                                        draggable onDragStart={(e) => handleDragStart(e, idx, 'TODOS')}
                                        onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx, 'TODOS')}
                                        className={`flex items-center gap-3 p-2.5 rounded-xl group cursor-pointer transition-all duration-200 hover:bg-white/5 active:scale-[0.98] ${todo.completed ? 'opacity-60' : 'opacity-100'} ${dragInfo?.index === idx && dragInfo.type === 'TODOS' ? 'bg-white/10 opacity-70' : ''}`}
                                        onClick={() => onToggleTodo(todo.id)}
                                    >
                                        <div className={`w-5 h-5 rounded-md flex-shrink-0 border-2 flex items-center justify-center transition-all duration-200 ${todo.completed ? 'bg-violet-400 border-violet-400' : 'border-white/20 group-hover:border-violet-400/50'}`}>
                                            {todo.completed && (
                                                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        {editingItem?.id === todo.id ? (
                                            <input autoFocus value={editingItem.text} onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); else if (e.key === 'Escape') setEditingItem(null); }}
                                                onBlur={handleSaveEdit} className="bg-white/10 border border-white/20 rounded text-white px-2 py-0.5 text-sm w-full outline-none" />
                                        ) : (
                                            <span onClick={(e) => { e.stopPropagation(); setEditingItem({ id: todo.id, type: 'TODOS', text: todo.text }); }}
                                                className={`text-sm flex-1 min-w-0 truncate transition-all duration-200 hover:text-white ${todo.completed ? 'line-through text-white/30' : 'text-white/80'}`}>
                                                {todo.text}
                                            </span>
                                        )}
                                        {onDeleteTodo && (
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteTodo(todo.id); }} className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 hover:bg-red-400/10 rounded overflow-hidden p-1 transition-all flex-shrink-0">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
