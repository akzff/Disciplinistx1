'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { addDays, addMonths, addWeeks, format } from 'date-fns';
import { DailyChat } from '@/lib/storage';
import { IMPORTANCE, TIME_SLOTS, DAY_KEYS } from '@/utils/taskConstants';

type Todo = DailyChat['todos'][number];
type Daily = DailyChat['dailies'][number];

type TaskDetailDrawerProps = {
    open: boolean;
    type: 'todo' | 'daily';
    task: Todo | Daily | null;
    onClose: () => void;
    onUpdate: (task: Todo | Daily) => void;
    onDelete: (task: Todo | Daily) => void;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            marginBottom: '6px'
        }}>
            {children}
        </div>
    );
}

function DatePicker({ label, sublabel, value, onChange, minDate, accentColor }: {
    label: string;
    sublabel?: string;
    value?: string;
    onChange: (val: string) => void;
    minDate?: string;
    accentColor?: string;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <label style={{ fontSize: '11px', color: accentColor || 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                {label}
            </label>
            {sublabel && (
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{sublabel}</span>
            )}
            <input
                type="date"
                value={value || ''}
                min={minDate}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${accentColor ? `${accentColor}55` : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: 'white',
                    fontSize: '12px'
                }}
            />
        </div>
    );
}

function TimePicker({ label, value, onChange }: {
    label: string;
    value?: string;
    onChange: (val: string) => void;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                {label}
            </label>
            <input
                type="time"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: 'white',
                    fontSize: '12px'
                }}
            />
        </div>
    );
}

export default function TaskDetailDrawer({
    open, type, task, onClose, onUpdate, onDelete
}: TaskDetailDrawerProps) {
    const [tagsInput, setTagsInput] = useState('');

    const currentTask = task as Todo | Daily | null;

    const tagsValue = useMemo(() => {
        const tags = (currentTask as Todo | Daily | null)?.tags || [];
        return tags.join(', ');
    }, [currentTask]);

    useEffect(() => {
        setTagsInput(tagsValue);
    }, [tagsValue, task]);

    if (!open || !currentTask) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update = (key: string, value: any) => {
        onUpdate({ ...currentTask, [key]: value } as Todo | Daily);
    };

    const rec = currentTask.recurrence || {};
    const vis = currentTask.visibility || {};

    const nextPreview = () => {
        const step = rec.n || 1;
        if (rec.type === 'every_n_days') return format(addDays(new Date(), step), 'MMM yyyy');
        if (rec.type === 'every_n_weeks') return format(addWeeks(new Date(), step), 'MMM yyyy');
        if (rec.type === 'every_n_months') return format(addMonths(new Date(), step), 'MMM yyyy');
        return '';
    };

    return (
        <div
            className="task-drawer-overlay"
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                zIndex: 9999,
                display: 'flex',
                justifyContent: 'flex-end'
            }}
        >
            <div
                className="task-drawer"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '420px',
                    maxWidth: '100%',
                    height: '100%',
                    background: '#0f0f0f',
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px',
                    gap: '14px',
                    overflowY: 'auto'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', letterSpacing: '0.12em' }}>
                        TASK DETAILS
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>✕</button>
                </div>

                <div>
                    <SectionLabel>NAME</SectionLabel>
                    <input
                        value={currentTask.text}
                        onChange={(e) => update('text', e.target.value)}
                        style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            color: 'white',
                            fontSize: '14px'
                        }}
                    />
                </div>

                <div>
                    <SectionLabel>IMPORTANCE</SectionLabel>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {IMPORTANCE.map(level => {
                            const isSelected = (currentTask.importance ?? 0) === level.level;
                            return (
                                <button
                                    key={level.level}
                                    onClick={() => update('importance', level.level)}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '16px',
                                        border: isSelected ? `1px solid ${level.color}` : '1px solid rgba(255,255,255,0.1)',
                                        background: isSelected ? `${level.color}20` : 'rgba(255,255,255,0.04)',
                                        color: isSelected ? level.color : 'rgba(255,255,255,0.5)',
                                        fontSize: '11px',
                                        fontWeight: isSelected ? 900 : 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {level.icon ? `${level.icon} ` : ''}{level.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {type === 'todo' && (
                    <div>
                        <SectionLabel>SCHEDULE</SectionLabel>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <DatePicker
                                label="Due Date"
                                value={(currentTask as Todo).due_date}
                                onChange={(v) => update('due_date', v)}
                            />
                            <TimePicker
                                label="Time (optional)"
                                value={(currentTask as Todo).due_time}
                                onChange={(v) => update('due_time', v)}
                            />
                        </div>

                        {(currentTask as Todo).due_date && (
                            <div style={{ marginTop: '8px' }}>
                                <DatePicker
                                    label="⚠️ Emergency Deadline"
                                    sublabel="Task becomes CRITICAL if missed by primary date"
                                    value={(currentTask as Todo).emergency_date}
                                    onChange={(v) => update('emergency_date', v)}
                                    minDate={(currentTask as Todo).due_date}
                                    accentColor="#ef4444"
                                />
                            </div>
                        )}
                    </div>
                )}

                {type === 'daily' && (
                    <div>
                        <SectionLabel>TIME SLOT</SectionLabel>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {TIME_SLOTS.map(slot => {
                                const selected = (currentTask as Daily).time_slot === slot.id;
                                return (
                                    <button
                                        key={slot.id}
                                        onClick={() => update('time_slot', slot.id)}
                                        style={{
                                            borderRadius: '10px',
                                            border: selected ? '1px solid rgba(212,160,23,0.7)' : '1px solid rgba(255,255,255,0.08)',
                                            background: selected ? 'rgba(212,160,23,0.12)' : 'rgba(255,255,255,0.03)',
                                            color: selected ? '#d4a017' : 'rgba(255,255,255,0.5)',
                                            padding: '10px',
                                            textAlign: 'left',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ fontSize: '12px', fontWeight: 800 }}>{slot.icon} {slot.label}</div>
                                        <div style={{ fontSize: '10px', opacity: 0.5 }}>{slot.time}</div>
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: '8px' }}>
                            <TimePicker
                                label="Exact time (optional)"
                                value={(currentTask as Daily).time_slot_time}
                                onChange={(v) => update('time_slot_time', v)}
                            />
                        </div>
                    </div>
                )}

                {(type === 'todo' || type === 'daily') && (
                    <div>
                        <SectionLabel>RECURRENCE</SectionLabel>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {[
                                { id: 'once', label: 'Once' },
                                { id: 'weekly', label: 'Weekly Days' },
                                { id: 'weekly_count', label: 'X/Week' },
                                { id: 'monthly_count', label: 'X/Month' },
                                { id: 'every_n_days', label: 'Every N Days' },
                                { id: 'every_n_weeks', label: 'Every N Weeks' },
                                { id: 'every_n_months', label: 'Every N Months' },
                                { id: 'monthly_date', label: 'Monthly Date' },
                            ].map(t => {
                                const selected = (rec.type || 'once') === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => update('recurrence', { type: t.id })}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: '16px',
                                            border: selected ? '1px solid rgba(212,160,23,0.7)' : '1px solid rgba(255,255,255,0.1)',
                                            background: selected ? 'rgba(212,160,23,0.12)' : 'rgba(255,255,255,0.03)',
                                            color: selected ? '#d4a017' : 'rgba(255,255,255,0.5)',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        {rec.type === 'weekly' && (
                            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {DAY_KEYS.map(day => {
                                    const selected = rec.days?.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            onClick={() => {
                                                const nextDays = selected
                                                    ? (rec.days || []).filter((d: string) => d !== day)
                                                    : [...(rec.days || []), day];
                                                update('recurrence', { ...rec, days: nextDays });
                                            }}
                                            style={{
                                                padding: '6px 8px',
                                                borderRadius: '10px',
                                                border: selected ? '1px solid rgba(212,160,23,0.7)' : '1px solid rgba(255,255,255,0.1)',
                                                background: selected ? 'rgba(212,160,23,0.12)' : 'rgba(255,255,255,0.03)',
                                                color: selected ? '#d4a017' : 'rgba(255,255,255,0.5)',
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {day.toUpperCase().slice(0, 2)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {(rec.type === 'weekly_count' || rec.type === 'monthly_count') && (
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={() => update('recurrence', { ...rec, count: Math.max(1, (rec.count || 1) - 1) })}
                                    style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >−</button>
                                <span style={{ fontSize: '12px' }}>{rec.count || 1} times per {rec.type === 'weekly_count' ? 'week' : 'month'}</span>
                                <button
                                    onClick={() => update('recurrence', { ...rec, count: (rec.count || 1) + 1 })}
                                    style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >+</button>
                            </div>
                        )}

                        {(rec.type === 'every_n_days' || rec.type === 'every_n_weeks' || rec.type === 'every_n_months') && (
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={() => update('recurrence', { ...rec, n: Math.max(1, (rec.n || 1) - 1) })}
                                    style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >−</button>
                                <span style={{ fontSize: '12px' }}>{rec.n || 1} {rec.type.replace('every_n_', '')}</span>
                                <button
                                    onClick={() => update('recurrence', { ...rec, n: (rec.n || 1) + 1 })}
                                    style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >+</button>
                            </div>
                        )}

                        {(rec.type === 'every_n_days' || rec.type === 'every_n_weeks' || rec.type === 'every_n_months') && (
                            <p style={{ fontSize: '11px', opacity: 0.5, marginTop: '6px' }}>
                                Next occurrence: {nextPreview()}
                            </p>
                        )}

                        {rec.type === 'monthly_date' && (
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={rec.day || 1}
                                    onChange={(e) => update('recurrence', { ...rec, day: Number(e.target.value) })}
                                    style={{
                                        width: '80px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        padding: '6px 8px',
                                        color: 'white',
                                        fontSize: '12px'
                                    }}
                                />
                                <span style={{ fontSize: '12px', opacity: 0.6 }}>day of month</span>
                            </div>
                        )}
                    </div>
                )}

                {(type === 'todo' || type === 'daily') && (
                    <div>
                        <SectionLabel>SMART VISIBILITY</SectionLabel>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {[
                                { id: 'always', label: 'Always' },
                                { id: 'seasonal', label: 'Seasonal' },
                                { id: 'pre_due', label: 'Pre-Due Only' },
                                { id: 'weekdays', label: 'Specific Days' },
                                { id: 'blackout_until', label: 'Hidden Until Date' },
                            ].map(t => {
                                const selected = (vis.type || 'always') === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => update('visibility', { type: t.id })}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: '16px',
                                            border: selected ? '1px solid rgba(212,160,23,0.7)' : '1px solid rgba(255,255,255,0.1)',
                                            background: selected ? 'rgba(212,160,23,0.12)' : 'rgba(255,255,255,0.03)',
                                            color: selected ? '#d4a017' : 'rgba(255,255,255,0.5)',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        {vis.type === 'seasonal' && (
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px' }}>Show task every</span>
                                <button
                                    onClick={() => update('visibility', { ...vis, every_months: Math.max(1, (vis.every_months || 1) - 1) })}
                                    style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >−</button>
                                <span style={{ fontSize: '12px' }}>{vis.every_months || 1}</span>
                                <button
                                    onClick={() => update('visibility', { ...vis, every_months: (vis.every_months || 1) + 1 })}
                                    style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >+</button>
                                <span style={{ fontSize: '12px' }}>months</span>
                            </div>
                        )}

                        {vis.type === 'seasonal' && (
                            <p style={{ fontSize: '11px', opacity: 0.5, marginTop: '6px' }}>
                                Task will reappear: {vis.next_show || format(addMonths(new Date(), vis.every_months || 1), 'yyyy-MM-dd')}
                            </p>
                        )}

                        {vis.type === 'pre_due' && (
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px' }}>Show</span>
                                <button
                                    onClick={() => update('visibility', { ...vis, days_before: Math.max(1, (vis.days_before || 1) - 1) })}
                                    style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >−</button>
                                <span style={{ fontSize: '12px' }}>{vis.days_before || 1}</span>
                                <button
                                    onClick={() => update('visibility', { ...vis, days_before: (vis.days_before || 1) + 1 })}
                                    style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                                >+</button>
                                <span style={{ fontSize: '12px' }}>days before due</span>
                            </div>
                        )}

                        {vis.type === 'weekdays' && (
                            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {DAY_KEYS.map(day => {
                                    const selected = vis.days?.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            onClick={() => {
                                                const nextDays = selected
                                                    ? (vis.days || []).filter((d: string) => d !== day)
                                                    : [...(vis.days || []), day];
                                                update('visibility', { ...vis, days: nextDays });
                                            }}
                                            style={{
                                                padding: '6px 8px',
                                                borderRadius: '10px',
                                                border: selected ? '1px solid rgba(212,160,23,0.7)' : '1px solid rgba(255,255,255,0.1)',
                                                background: selected ? 'rgba(212,160,23,0.12)' : 'rgba(255,255,255,0.03)',
                                                color: selected ? '#d4a017' : 'rgba(255,255,255,0.5)',
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {day.toUpperCase().slice(0, 2)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {vis.type === 'blackout_until' && (
                            <div style={{ marginTop: '8px' }}>
                                <DatePicker
                                    label="Don't show before"
                                    value={vis.date}
                                    onChange={(v) => update('visibility', { ...vis, date: v })}
                                />
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <SectionLabel>NOTES</SectionLabel>
                    <textarea
                        value={currentTask.notes || ''}
                        onChange={(e) => update('notes', e.target.value)}
                        style={{
                            width: '100%',
                            minHeight: '80px',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            color: 'white',
                            fontSize: '12px',
                            resize: 'vertical'
                        }}
                    />
                </div>

                <div>
                    <SectionLabel>TAGS</SectionLabel>
                    <input
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        onBlur={() => {
                            const nextTags = tagsInput
                                .split(',')
                                .map(t => t.trim())
                                .filter(Boolean);
                            update('tags', nextTags);
                            setTagsInput(nextTags.join(', '));
                        }}
                        placeholder="health, work, admin"
                        style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            color: 'white',
                            fontSize: '12px'
                        }}
                    />
                </div>

                <button
                    onClick={() => onDelete(currentTask)}
                    style={{
                        marginTop: '8px',
                        padding: '10px',
                        borderRadius: '10px',
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        color: '#ef4444',
                        fontWeight: 800,
                        cursor: 'pointer'
                    }}
                >
                    DELETE TASK
                </button>
            </div>

            <style jsx>{`
                @media (max-width: 768px) {
                    .task-drawer {
                        width: 100%;
                        height: 75%;
                        border-left: none;
                        border-top: 1px solid rgba(255,255,255,0.08);
                        border-radius: 16px 16px 0 0;
                        align-self: flex-end;
                    }
                }
            `}</style>
        </div>
    );
}
