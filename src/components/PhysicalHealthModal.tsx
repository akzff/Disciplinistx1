'use client';

import React, { useState, useEffect } from 'react';
import { PhysicalData } from '@/lib/storage';

interface PhysicalHealthModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: PhysicalData) => void;
    initialData?: PhysicalData;
    dateLabel?: string;
}

export default function PhysicalHealthModal({ open, onClose, onSave, initialData, dateLabel }: PhysicalHealthModalProps) {
    const [energy, setEnergy] = useState<number>(3);
    const [workout, setWorkout] = useState<boolean>(false);
    const [pain, setPain] = useState<number>(0);
    const [notes, setNotes] = useState<string>('');

    // Sync initial data if editing
    useEffect(() => {
        if (open) {
            if (initialData) {
                setEnergy(initialData.energy);
                setWorkout(initialData.workout);
                setPain(initialData.pain);
                setNotes(initialData.notes || '');
            } else {
                setEnergy(3);
                setWorkout(false);
                setPain(0);
                setNotes('');
            }
        }
    }, [open, initialData]);

    // Close on escape key
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    const handleSubmit = () => {
        onSave({
            energy,
            workout,
            pain,
            notes: notes.trim() || undefined
        });
        onClose();
    };

    if (!open) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }} onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div style={{
                width: '100%',
                maxWidth: '480px',
                background: 'rgba(10, 10, 12, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 50px 0 rgba(16, 185, 129, 0.03)',
                padding: '2.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.75rem',
                boxSizing: 'border-box',
                position: 'relative',
                animation: 'scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1.25rem',
                        right: '1.25rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.3)',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.3)'}
                >
                    ✕
                </button>

                {/* Header */}
                <div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#10b981', letterSpacing: '0.2em' }}>DAILY TRACKING {dateLabel ? `• ${dateLabel}` : ''}</span>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 850, color: 'white', margin: '6px 0 0 0', letterSpacing: '-0.02em' }}>Physical Health</h2>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', margin: '4px 0 0 0' }}>Log your physical energy, activity, and pain index today.</p>
                </div>

                {/* Energy Indicator */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.1em' }}>PHYSICAL ENERGY LEVEL</label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '0.25rem' }}>
                        {[1, 2, 3, 4, 5].map(level => {
                            const active = energy === level;
                            const colors = ['#f87171', '#f59e0b', '#fbbf24', '#34d399', '#10b981'];
                            const levelColor = colors[level - 1];
                            return (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => setEnergy(level)}
                                    style={{
                                        flex: 1,
                                        padding: '12px 0',
                                        background: active ? `${levelColor}20` : 'rgba(255,255,255,0.02)',
                                        border: active ? `1.5px solid ${levelColor}` : '1.5px solid rgba(255,255,255,0.06)',
                                        borderRadius: '12px',
                                        color: active ? levelColor : 'rgba(255,255,255,0.4)',
                                        fontWeight: '900',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: active ? `0 0 15px ${levelColor}20` : 'none'
                                    }}
                                >
                                    {level === 1 ? '⚡' : level === 2 ? '⚡⚡' : level === 3 ? '⚡⚡⚡' : level === 4 ? '⚡⚡⚡⚡' : '⚡⚡⚡⚡⚡'}
                                    <div style={{ fontSize: '0.55rem', fontWeight: '800', marginTop: '4px', textTransform: 'uppercase' }}>
                                        {level === 1 ? 'Exhausted' :
                                         level === 2 ? 'Low' :
                                         level === 3 ? 'Moderate' :
                                         level === 4 ? 'High' : 'Peak'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Workout Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white', letterSpacing: '0.05em', display: 'block' }}>WORKOUT COMPLETED</label>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>Did you complete any exercise, run, or workout?</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[true, false].map(val => {
                            const active = workout === val;
                            return (
                                <button
                                    key={val ? 'yes' : 'no'}
                                    type="button"
                                    onClick={() => setWorkout(val)}
                                    style={{
                                        padding: '8px 16px',
                                        background: active ? (val ? '#10b981' : '#f87171') : 'transparent',
                                        border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
                                        color: active ? 'black' : 'rgba(255,255,255,0.5)',
                                        borderRadius: '8px',
                                        fontWeight: '900',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {val ? 'YES' : 'NO'}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Pain / Symptoms Rating */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.1em' }}>PAIN / COMFORT LEVEL</label>
                        <span style={{ fontSize: '0.9rem', fontWeight: 900, color: pain > 0 ? '#f87171' : '#10b981' }}>
                            {pain === 0 ? 'No Pain/Aches' : `${pain} / 5`}
                        </span>
                    </div>
                    <input 
                        type="range"
                        min="0"
                        max="5"
                        step="1"
                        value={pain}
                        onChange={(e) => setPain(parseInt(e.target.value))}
                        style={{
                            width: '100%',
                            accentColor: pain > 0 ? '#f87171' : '#10b981',
                            cursor: 'pointer',
                            background: 'rgba(255,255,255,0.05)',
                            height: '6px',
                            borderRadius: '3px'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontWeight: 800 }}>
                        <span>0 (None)</span>
                        <span>1 (Mild)</span>
                        <span>2 (Moderate)</span>
                        <span>3 (Nasty)</span>
                        <span>4 (Severe)</span>
                        <span>5 (Extreme)</span>
                    </div>
                </div>

                {/* Optional Symptoms / Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.1em' }}>PHYSICAL SYMPTOMS & NOTES (OPTIONAL)</label>
                    <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detail any headaches, muscle soreness, fatigue, symptoms, or workout stats..."
                        style={{
                            width: '100%',
                            height: '75px',
                            background: '#040406',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '12px',
                            color: 'rgba(255, 255, 255, 0.85)',
                            padding: '12px',
                            fontSize: '0.8rem',
                            fontFamily: 'inherit',
                            resize: 'none',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Submit Button */}
                <button 
                    onClick={handleSubmit}
                    style={{
                        padding: '14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'black',
                        border: 'none',
                        borderRadius: '100px',
                        fontWeight: 950,
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(16, 185, 129, 0.15)',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(16, 185, 129, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.15)';
                    }}
                >
                    SAVE & CONTINUE
                </button>
            </div>
            
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
