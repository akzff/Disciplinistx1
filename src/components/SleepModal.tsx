'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SleepData } from '@/lib/storage';

interface SleepModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: SleepData) => void;
    initialData?: SleepData;
    dateLabel?: string;
}

export default function SleepModal({ open, onClose, onSave, initialData, dateLabel }: SleepModalProps) {
    const [hours, setHours] = useState<number>(7);
    const [rating, setRating] = useState<number>(3);
    const [notes, setNotes] = useState<string>('');

    // Sync initial data if editing
    useEffect(() => {
        if (open) {
            if (initialData) {
                setHours(initialData.hours);
                setRating(initialData.rating);
                setNotes(initialData.notes || '');
            } else {
                setHours(7);
                setRating(3);
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
            hours,
            rating,
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
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 50px 0 rgba(6, 182, 212, 0.03)',
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
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#06b6d4', letterSpacing: '0.2em' }}>DAILY TRACKING {dateLabel ? `• ${dateLabel}` : ''}</span>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 850, color: 'white', margin: '6px 0 0 0', letterSpacing: '-0.02em' }}>Sleep Quality</h2>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', margin: '4px 0 0 0' }}>How long and how well did you sleep last night?</p>
                </div>

                {/* Hours Slider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.1em' }}>SLEEP DURATION</label>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#06b6d4' }}>{hours} hrs</span>
                    </div>
                    <input 
                        type="range"
                        min="0"
                        max="24"
                        step="0.5"
                        value={hours}
                        onChange={(e) => setHours(parseFloat(e.target.value))}
                        style={{
                            width: '100%',
                            accentColor: '#06b6d4',
                            cursor: 'pointer',
                            background: 'rgba(255,255,255,0.05)',
                            height: '6px',
                            borderRadius: '3px'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontWeight: 800 }}>
                        <span>0h</span>
                        <span>4h</span>
                        <span>8h (Ideal)</span>
                        <span>12h</span>
                        <span>16h+</span>
                    </div>
                </div>

                {/* Star Quality Rating */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.1em', alignSelf: 'flex-start' }}>SLEEP QUALITY</label>
                    <div style={{ display: 'flex', gap: '8px', margin: '0.5rem 0' }}>
                        {[1, 2, 3, 4, 5].map(star => {
                            const active = rating >= star;
                            return (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '2rem',
                                        color: active ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)',
                                        textShadow: active ? '0 0 15px rgba(6, 182, 212, 0.5)' : 'none',
                                        transition: 'transform 0.2s, color 0.2s',
                                        transform: active ? 'scale(1.1)' : 'scale(1)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = active ? 'scale(1.1)' : 'scale(1)'}
                                >
                                    ★
                                </button>
                            );
                        })}
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#06b6d4' }}>
                        {rating === 1 ? 'Poor (Restless/Short)' :
                         rating === 2 ? 'Fair (Interrupted)' :
                         rating === 3 ? 'Good (Average)' :
                         rating === 4 ? 'Very Good (Refreshed)' : 'Excellent (Deep/Peaceful)'}
                    </span>
                </div>

                {/* Optional Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.1em' }}>SLEEP NOTES (OPTIONAL)</label>
                    <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any dreams, waking up in night, or caffeine details..."
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
                        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                        color: 'black',
                        border: 'none',
                        borderRadius: '100px',
                        fontWeight: 950,
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(6, 182, 212, 0.15)',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(6, 182, 212, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(6, 182, 212, 0.15)';
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
