'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WrapUpData, MoodData } from '@/lib/storage';

interface WrapUpModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: WrapUpData) => void;
}

const DEFAULT_SUGGESTED_TAGS = ['focus', 'productivity', 'burnout', 'debug', 'database', 'flow', 'anxious', 'calm', 'distracted'];

export default function WrapUpModal({ open, onClose, onSave }: WrapUpModalProps) {
    // Custom Suggested Tags state
    const [suggestedTags, setSuggestedTags] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('disciplinist_custom_tags');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    // fallback
                }
            }
        }
        return DEFAULT_SUGGESTED_TAGS;
    });
    const [newTagInput, setNewTagInput] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);

    // Coordinate values range from -1 to 1
    const [x, setX] = useState<number>(0); // Tone
    const [y, setY] = useState<number>(0); // Energy
    const [isDragging, setIsDragging] = useState(false);
    const [journalText, setJournalText] = useState('');
    const gridRef = useRef<HTMLDivElement>(null);
    const hasManuallyMoved = useRef(false);

    // Scan journal text for emotional tags/keywords to auto-align the grid dot if the user has not manually interacted with the grid.
    useEffect(() => {
        if (isDragging || hasManuallyMoved.current) return;

        const text = journalText.toLowerCase();
        
        // Scan for emotional keywords/tags
        const isAnxious = text.includes('#anxious') || text.includes('anxious') || text.includes('frustrat') || text.includes('stress') || text.includes('panic') || text.includes('worry') || text.includes('worried');
        const isFlow = text.includes('#flow') || text.includes('flow') || text.includes('inspir') || text.includes('excit') || text.includes('productiv') || text.includes('focus') || text.includes('#focus');
        const isCalm = text.includes('#calm') || text.includes('calm') || text.includes('clear') || text.includes('relax') || text.includes('peace') || text.includes('chill');
        const isDrained = text.includes('#drained') || text.includes('#burnout') || text.includes('drain') || text.includes('bore') || text.includes('tire') || text.includes('exhaust') || text.includes('burnout');

        if (isAnxious) {
            setX(-0.5);
            setY(0.5);
        } else if (isFlow) {
            setX(0.5);
            setY(0.5);
        } else if (isCalm) {
            setX(0.5);
            setY(-0.5);
        } else if (isDrained) {
            setX(-0.5);
            setY(-0.5);
        } else {
            // Default center if no keyword is typed
            setX(0);
            setY(0);
        }
    }, [journalText, isDragging]);

    const handleAddTag = () => {
        const cleanTag = newTagInput.trim().toLowerCase().replace(/#/g, '');
        if (cleanTag && !suggestedTags.includes(cleanTag)) {
            const updated = [...suggestedTags, cleanTag];
            setSuggestedTags(updated);
            localStorage.setItem('disciplinist_custom_tags', JSON.stringify(updated));
            setNewTagInput('');
            setIsAddingTag(false);
        }
    };

    const handleRemoveSuggestedTag = (e: React.MouseEvent, tagToRemove: string) => {
        e.stopPropagation(); // Prevent toggling the tag as active/inactive
        const updated = suggestedTags.filter(t => t !== tagToRemove);
        setSuggestedTags(updated);
        localStorage.setItem('disciplinist_custom_tags', JSON.stringify(updated));
    };

    // Close on escape key
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    // Parse current quadrant
    const moodInfo = useMemo((): MoodData => {
        const tone: 'positive' | 'negative' = x >= 0 ? 'positive' : 'negative';
        const energy: 'high' | 'low' = y >= 0 ? 'high' : 'low';

        let label: MoodData['label'] = 'Calm / Clear-Headed';
        if (x === 0 && y === 0) {
            label = 'Calm / Clear-Headed'; // Default center to Calm/Clear-Headed instead of Flow
        } else if (energy === 'high' && tone === 'positive') {
            label = 'Flow / Inspired';
        } else if (energy === 'high' && tone === 'negative') {
            label = 'Anxious / Frustrated';
        } else if (energy === 'low' && tone === 'positive') {
            label = 'Calm / Clear-Headed';
        } else if (energy === 'low' && tone === 'negative') {
            label = 'Drained / Bored';
        }

        return { x, y, energy, tone, label };
    }, [x, y]);

    // Determine Liquid Mercury Dot styling based on active quadrant
    const dotStyle = useMemo(() => {
        const { label } = moodInfo;
        let color = '#6b7280'; // Drained / Bored (Default)
        let shadow = 'rgba(107, 114, 128, 0.4)';
        let animation = 'none';

        if (label === 'Flow / Inspired') {
            color = '#06b6d4'; // Electric Teal
            shadow = 'rgba(6, 182, 212, 0.8)';
            animation = 'pulse-teal 2s infinite ease-in-out';
        } else if (label === 'Anxious / Frustrated') {
            color = '#f97316'; // Neon Orange
            shadow = 'rgba(249, 115, 22, 0.8)';
            animation = 'pulse-orange 1.2s infinite ease-in-out';
        } else if (label === 'Calm / Clear-Headed') {
            color = '#3b82f6'; // Sapphire Blue
            shadow = 'rgba(59, 130, 246, 0.7)';
            animation = 'pulse-blue 3s infinite ease-in-out';
        } else if (label === 'Drained / Bored') {
            color = '#9ca3af'; // Smoky Gray
            shadow = 'rgba(156, 163, 175, 0.3)';
            animation = 'pulse-gray 4s infinite ease-in-out';
        }

        return { backgroundColor: color, boxShadow: `0 0 25px 8px ${shadow}, 0 0 10px 2px ${color}`, animation };
    }, [moodInfo]);

    // Track mouse/touch inputs and map to -1 -> 1 range
    const handlePointerEvent = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!gridRef.current) return;
        hasManuallyMoved.current = true; // Mark that user has manually interacted with the matrix
        const rect = gridRef.current.getBoundingClientRect();
        
        // Calculate raw relative coordinates inside the grid [0 to rect.width]
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        // Map to -1 -> 1 range
        const relativeX = Math.max(-1, Math.min(1, ((clientX / rect.width) * 2) - 1));
        const relativeY = Math.max(-1, Math.min(1, 1 - ((clientY / rect.height) * 2))); // Invert Y since top is 0 in ClientY

        setX(parseFloat(relativeX.toFixed(3)));
        setY(parseFloat(relativeY.toFixed(3)));
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        gridRef.current?.setPointerCapture(e.pointerId);
        setIsDragging(true);
        handlePointerEvent(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDragging) handlePointerEvent(e);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        gridRef.current?.releasePointerCapture(e.pointerId);
        setIsDragging(false);
    };

    // Extract auto-tags from text (e.g. #focus)
    const autoTags = useMemo((): string[] => {
        const regex = /#(\w+)/g;
        const tags: string[] = [];
        let match;
        while ((match = regex.exec(journalText)) !== null) {
            const tag = match[1].toLowerCase();
            if (tag && !tags.includes(tag)) {
                tags.push(tag);
            }
        }
        return tags;
    }, [journalText]);

    // Toggle suggested tags in journal text
    const handleTagToggle = (tag: string) => {
        const hashtag = `#${tag}`;
        if (autoTags.includes(tag)) {
            // Remove from text
            const regex = new RegExp(`\\s*${hashtag}\\b`, 'gi');
            setJournalText(prev => prev.replace(regex, '').trim());
        } else {
            // Append to text
            setJournalText(prev => prev.trim() ? `${prev} ${hashtag}` : hashtag);
        }
    };

    const handleSubmit = () => {
        onSave({
            mood: moodInfo,
            journal: journalText,
            tags: autoTags,
            completedAt: Date.now()
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
            // Dismiss if clicking backdrop
            if (e.target === e.currentTarget) onClose();
        }}>
            <div style={{
                width: '100%',
                maxWidth: '480px',
                background: 'rgba(10, 10, 12, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 50px 0 rgba(212, 160, 23, 0.03)',
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
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#d4a017', letterSpacing: '0.2em' }}>END-OF-DAY WRAP-UP</span>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 850, color: 'white', margin: '6px 0 0 0', letterSpacing: '-0.02em' }}>How was today?</h2>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', margin: '4px 0 0 0' }}>Log your energy, tone, and a quick micro-journal entry.</p>
                </div>

                {/* 2D Mood Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div 
                        ref={gridRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        style={{
                            width: '280px',
                            height: '280px',
                            background: '#040406',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '16px',
                            position: 'relative',
                            cursor: 'crosshair',
                            touchAction: 'none',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Grid Axes */}
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255, 255, 255, 0.03)' }} />
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255, 255, 255, 0.03)' }} />

                        {/* Quadrant Labels inside the grid */}
                        <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '9px', fontWeight: 700, color: 'rgba(6, 182, 212, 0.25)', pointerEvents: 'none' }}>FLOW</div>
                        <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '9px', fontWeight: 700, color: 'rgba(249, 115, 22, 0.25)', pointerEvents: 'none' }}>ANXIOUS</div>
                        <div style={{ position: 'absolute', bottom: '10px', right: '10px', fontSize: '9px', fontWeight: 700, color: 'rgba(59, 130, 246, 0.25)', pointerEvents: 'none' }}>CALM</div>
                        <div style={{ position: 'absolute', bottom: '10px', left: '10px', fontSize: '9px', fontWeight: 700, color: 'rgba(156, 163, 175, 0.25)', pointerEvents: 'none' }}>DRAINED</div>

                        {/* Liquid Mercury Dot */}
                        <div 
                            style={{
                                position: 'absolute',
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                pointerEvents: 'none',
                                left: `calc(${(x + 1) * 50}% - 11px)`,
                                top: `calc(${(1 - y) * 50}% - 11px)`,
                                transition: isDragging ? 'none' : 'all 0.15s cubic-bezier(0.25, 1, 0.5, 1)',
                                ...dotStyle
                            }}
                        />
                    </div>

                    {/* Mood Label Display */}
                    <div style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid rgba(255, 255, 255, 0.03)',
                        borderRadius: '12px',
                        textAlign: 'center',
                        boxSizing: 'border-box'
                    }}>
                        <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 900,
                            letterSpacing: '0.05em',
                            color: 
                                moodInfo.label === 'Flow / Inspired' ? '#06b6d4' :
                                moodInfo.label === 'Anxious / Frustrated' ? '#f97316' :
                                moodInfo.label === 'Calm / Clear-Headed' ? '#3b82f6' : '#9ca3af'
                        }}>
                            {moodInfo.label.toUpperCase()}
                        </span>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.35)', marginTop: '2px' }}>
                            Tone: {x >= 0 ? '+' : ''}{x} | Energy: {y >= 0 ? '+' : ''}{y}
                        </div>
                    </div>
                </div>

                {/* Journal & Tagging */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.1em' }}>MICRO-JOURNAL</label>
                    <textarea 
                        value={journalText}
                        onChange={(e) => setJournalText(e.target.value)}
                        placeholder="Write a quick reflection... (Use #hashtags to tag your day)"
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

                    {/* Tag Suggestions and Active Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                        {suggestedTags.map(tag => {
                            const active = autoTags.includes(tag);
                            return (
                                <button
                                    key={tag}
                                    onClick={() => handleTagToggle(tag)}
                                    className="customizable-tag"
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '100px',
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        border: active ? '1px solid transparent' : '1px solid rgba(255, 255, 255, 0.06)',
                                        background: active ? '#d4a01720' : 'transparent',
                                        color: active ? '#d4a017' : 'rgba(255, 255, 255, 0.4)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <span>#{tag}</span>
                                    <span 
                                        onClick={(e) => handleRemoveSuggestedTag(e, tag)}
                                        className="delete-tag-btn"
                                        style={{
                                            opacity: 0.4,
                                            marginLeft: '2px',
                                            fontSize: '11px',
                                            fontWeight: 900,
                                            transition: 'opacity 0.2s'
                                        }}
                                        title="Remove from suggestions"
                                    >
                                        ×
                                    </span>
                                </button>
                            );
                        })}

                        {/* Inline custom tag adder */}
                        {isAddingTag ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="text"
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value)}
                                    placeholder="new tag..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddTag();
                                        if (e.key === 'Escape') setIsAddingTag(false);
                                    }}
                                    autoFocus
                                    style={{
                                        background: '#040406',
                                        border: '1px solid rgba(212, 160, 23, 0.3)',
                                        borderRadius: '100px',
                                        padding: '4px 10px',
                                        fontSize: '0.65rem',
                                        color: 'white',
                                        outline: 'none',
                                        width: '80px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <button 
                                    onClick={handleAddTag}
                                    style={{ background: 'transparent', border: 'none', color: '#d4a017', fontSize: '0.85rem', cursor: 'pointer', padding: '2px' }}
                                >
                                    ✓
                                </button>
                                <button 
                                    onClick={() => setIsAddingTag(false)}
                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', cursor: 'pointer', padding: '2px' }}
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAddingTag(true)}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '100px',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                                    background: 'transparent',
                                    color: 'rgba(255, 255, 255, 0.35)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#d4a017';
                                    e.currentTarget.style.color = '#d4a017';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.35)';
                                }}
                            >
                                + ADD SUGGESTION
                            </button>
                        )}
                    </div>
                </div>

                {/* Submit Button */}
                <button 
                    onClick={handleSubmit}
                    style={{
                        padding: '14px',
                        background: 'linear-gradient(135deg, #d4a017 0%, #a8790f 100%)',
                        color: 'black',
                        border: 'none',
                        borderRadius: '100px',
                        fontWeight: 950,
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(212, 160, 23, 0.15)',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(212, 160, 23, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(212, 160, 23, 0.15)';
                    }}
                >
                    SUBMIT WRAP-UP
                </button>
            </div>

            {/* Custom Animations in CSS */}
            <style jsx global>{`
                @keyframes pulse-teal {
                    0% { transform: scale(1); opacity: 0.95; }
                    50% { transform: scale(1.1); opacity: 1; filter: brightness(1.2); }
                    100% { transform: scale(1); opacity: 0.95; }
                }
                @keyframes pulse-orange {
                    0% { transform: scale(1); filter: brightness(1); }
                    50% { transform: scale(1.15); filter: brightness(1.4); }
                    100% { transform: scale(1); filter: brightness(1); }
                }
                @keyframes pulse-blue {
                    0% { transform: scale(1); opacity: 0.9; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.9; }
                }
                @keyframes pulse-gray {
                    0% { transform: scale(1); opacity: 0.7; }
                    50% { transform: scale(1.02); opacity: 0.85; }
                    100% { transform: scale(1); opacity: 0.7; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .customizable-tag:hover .delete-tag-btn {
                    opacity: 0.85 !important;
                }
                .delete-tag-btn:hover {
                    color: #ef4444;
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    );
}
