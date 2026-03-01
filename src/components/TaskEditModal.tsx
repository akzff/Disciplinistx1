'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/Checkbox';

interface TaskEditModalProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any;
    type: 'DAILIES' | 'TODOS';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSave: (updatedItem: any) => void;
    onClose: () => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TaskEditModal({ item, type, onSave, onClose }: TaskEditModalProps) {
    // Date Helper: Convert DD/MM/YYYY to YYYY-MM-DD for input
    const toISODate = (str: string) => {
        if (!str || !str.includes('/')) return str;
        const [d, m, y] = str.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    // Date Helper: Convert YYYY-MM-DD to DD/MM/YYYY for storage
    const toDisplayDate = (str: string) => {
        if (!str || !str.includes('-')) return str;
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    };

    const [text, setText] = useState(item.text);

    // Todo specific
    const [date, setDate] = useState(toISODate(item.date) || new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(item.time || '');
    const [isTimed, setIsTimed] = useState(item.isTimed || false);

    // Daily specific
    const [dailyScheduleType, setDailyScheduleType] = useState<'EVERYDAY' | 'DAYS' | 'FREQUENCY'>(
        item.recurringDays ? 'DAYS' : item.frequency ? 'FREQUENCY' : 'EVERYDAY'
    );
    const [selectedDays, setSelectedDays] = useState<string[]>(item.recurringDays || []);
    const [freqCount, setFreqCount] = useState(item.frequency?.count || 1);
    const [freqPeriod, setFreqPeriod] = useState<'WEEK' | 'MONTH'>(item.frequency?.period || 'WEEK');

    // Subtasks
    const [subtasks, setSubtasks] = useState<{ id: string; text: string; completed: boolean }[]>(item.subtasks || []);
    const [newSubtask, setNewSubtask] = useState('');

    const handleSave = () => {
        if (!text.trim()) return;

        const updatedItem = { ...item, text, subtasks };

        if (type === 'TODOS') {
            updatedItem.date = toDisplayDate(date);
            updatedItem.isTimed = isTimed;
            updatedItem.time = isTimed ? time : undefined;
        } else {
            if (dailyScheduleType === 'EVERYDAY') {
                updatedItem.recurringDays = undefined;
                updatedItem.frequency = undefined;
            } else if (dailyScheduleType === 'DAYS') {
                updatedItem.recurringDays = selectedDays;
                updatedItem.frequency = undefined;
            } else if (dailyScheduleType === 'FREQUENCY') {
                updatedItem.frequency = { count: freqCount, period: freqPeriod };
                updatedItem.recurringDays = undefined;
            }
        }

        onSave(updatedItem);
    };

    const addSubtask = () => {
        if (!newSubtask.trim()) return;
        setSubtasks([...subtasks, { id: Date.now().toString(), text: newSubtask, completed: false }]);
        setNewSubtask('');
    };

    const removeSubtask = (id: string) => {
        setSubtasks(subtasks.filter(s => s.id !== id));
    };

    const toggleSubtask = (id: string) => {
        setSubtasks(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
    };

    const toggleDay = (day: string) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h3>EDIT TASK</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </header>

                <div className="modal-body">
                    <div className="form-group">
                        <label>TASK NAME</label>
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Task name..."
                            autoFocus
                        />
                    </div>

                    <div className="modal-grid">
                        {type === 'TODOS' ? (
                            <>
                                <div className="form-group">
                                    <label>DATE</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <label style={{ margin: 0 }}>SCHEDULE TIME</label>
                                        <Checkbox
                                            checked={isTimed}
                                            onChange={setIsTimed}
                                            size="md"
                                        />
                                    </div>
                                    {isTimed ? (
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            style={{ marginTop: '4px' }}
                                        />
                                    ) : (
                                        <div className="disabled-input">TIME NOT SET</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label>RECURRENCE</label>
                                <div className="tab-switcher">
                                    {['EVERYDAY', 'DAYS', 'FREQUENCY'].map(t => (
                                        <button
                                            key={t}
                                            className={dailyScheduleType === t ? 'active' : ''}
                                            onClick={() => setDailyScheduleType(t as 'EVERYDAY' | 'DAYS' | 'FREQUENCY')}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>

                                {dailyScheduleType === 'DAYS' && (
                                    <div className="days-picker" style={{ marginTop: '10px' }}>
                                        {DAYS.map(day => (
                                            <button
                                                key={day}
                                                className={selectedDays.includes(day) ? 'active' : ''}
                                                onClick={() => toggleDay(day)}
                                            >
                                                {day[0]}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {dailyScheduleType === 'FREQUENCY' && (
                                    <div className="frequency-picker" style={{ marginTop: '10px' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            value={freqCount}
                                            onChange={(e) => setFreqCount(parseInt(e.target.value))}
                                        />
                                        <span>times /</span>
                                        <select
                                            value={freqPeriod}
                                            onChange={(e) => setFreqPeriod(e.target.value as 'WEEK' | 'MONTH')}
                                        >
                                            <option value="WEEK">WEEK</option>
                                            <option value="MONTH">MONTH</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>SUBTASKS</label>
                        <div className="subtask-list">
                            {subtasks.length === 0 && <p style={{ fontSize: '0.75rem', opacity: 0.3, padding: '10px' }}>No sub-tasks added.</p>}
                            {subtasks.map(sub => (
                                <div key={sub.id} className="subtask-item">
                                    <Checkbox
                                        checked={sub.completed}
                                        onChange={() => toggleSubtask(sub.id)}
                                        size="sm"
                                    />
                                    <span style={{ flex: 1, opacity: sub.completed ? 0.4 : 1, textDecoration: sub.completed ? 'line-through' : 'none' }}>{sub.text}</span>
                                    <button className="remove-sub" onClick={() => removeSubtask(sub.id)}>×</button>
                                </div>
                            ))}
                        </div>
                        <div className="add-subtask-row">
                            <input
                                type="text"
                                placeholder="Add sub-task..."
                                value={newSubtask}
                                onChange={(e) => setNewSubtask(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                            />
                            <button onClick={addSubtask}>ADD</button>
                        </div>
                    </div>
                </div>

                <footer className="modal-footer">
                    <button className="cancel-pill" onClick={onClose}>CANCEL</button>
                    <button className="save-pill" onClick={handleSave}>SAVE CHANGES</button>
                </footer>
            </div>

            <style jsx>{`
                .modal-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.85);
                    backdrop-filter: blur(15px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    animation: fadeIn 0.3s ease-out;
                }
                .modal-content {
                    width: 100%;
                    max-width: 500px;
                    background: #0d0d0d;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 28px;
                    overflow: hidden;
                    box-shadow: 0 30px 60px rgba(0,0,0,0.8), 0 0 40px rgba(16, 185, 129, 0.05);
                }
                .modal-header {
                    padding: 1.5rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    background: rgba(255,255,255,0.02);
                }
                .modal-header h3 {
                    margin: 0;
                    font-size: 0.75rem;
                    letter-spacing: 0.3em;
                    color: var(--accent);
                    font-weight: 900;
                }
                .close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0.5;
                }
                .modal-body {
                    padding: 2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.8rem;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .modal-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                }
                .form-group label {
                    font-size: 0.6rem;
                    font-weight: 900;
                    opacity: 0.4;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                }
                input, select {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 12px;
                    padding: 10px 14px;
                    color: white;
                    font-size: 0.9rem;
                    font-family: inherit;
                    outline: none;
                    transition: all 0.2s;
                }
                input:focus {
                    border-color: var(--accent);
                    background: rgba(255,255,255,0.06);
                }
                .disabled-input {
                    padding: 10px 14px;
                    font-size: 0.75rem;
                    opacity: 0.3;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                }
                .tab-switcher {
                    display: flex;
                    background: rgba(255,255,255,0.02);
                    padding: 4px;
                    border-radius: 12px;
                    gap: 4px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .tab-switcher button {
                    flex: 1;
                    padding: 8px;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 0.6rem;
                    font-weight: 900;
                    border-radius: 8px;
                    cursor: pointer;
                    opacity: 0.4;
                    transition: all 0.2s;
                }
                .tab-switcher button.active {
                    background: var(--accent);
                    opacity: 1;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
                }
                .days-picker {
                    display: flex;
                    gap: 4px;
                    justify-content: space-between;
                }
                .days-picker button {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    color: white;
                    font-weight: 900;
                    font-size: 0.6rem;
                    cursor: pointer;
                }
                .days-picker button.active {
                    background: var(--accent);
                    border-color: var(--accent);
                }
                .subtask-list {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .subtask-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 12px;
                    background: rgba(255,255,255,0.02);
                    border-radius: 10px;
                    font-size: 0.85rem;
                }
                .remove-sub {
                    background: none;
                    border: none;
                    color: #ef4444;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0.3;
                }
                .remove-sub:hover { opacity: 1; }
                .add-subtask-row {
                    display: flex;
                    gap: 8px;
                    margin-top: 10px;
                }
                .add-subtask-row input { flex: 1; font-size: 0.85rem; }
                .add-subtask-row button {
                    padding: 0 16px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    color: white;
                    font-size: 0.65rem;
                    font-weight: 900;
                    cursor: pointer;
                }
                .modal-footer {
                    padding: 1.5rem 2rem;
                    display: flex;
                    gap: 1.5rem;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    background: rgba(255,255,255,0.01);
                }
                .cancel-pill {
                    padding: 12px 24px;
                    background: none;
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    border-radius: 14px;
                    font-weight: 900;
                    font-size: 0.7rem;
                    cursor: pointer;
                    opacity: 0.6;
                }
                .save-pill {
                    flex: 1;
                    background: var(--accent);
                    border: none;
                    color: white;
                    padding: 12px;
                    border-radius: 14px;
                    font-weight: 900;
                    font-size: 0.75rem;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
