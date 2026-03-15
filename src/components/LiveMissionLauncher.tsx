'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';

type Preset = {
    id: string;
    name: string;
    emoji: string;
    use_count: number;
};

const DEFAULT_PRESETS: Preset[] = [
    { id: 'd1', name: 'Gym session', emoji: '\u{1F3CB}\u{FE0F}', use_count: 0 },
    { id: 'd2', name: 'Deep work', emoji: '\u{1F4BB}', use_count: 0 },
    { id: 'd3', name: 'Study block', emoji: '\u{1F4DA}', use_count: 0 },
    { id: 'd4', name: 'Meditation', emoji: '\u{1F9D8}', use_count: 0 },
    { id: 'd5', name: 'Morning run', emoji: '\u{1F3C3}', use_count: 0 },
    { id: 'd6', name: 'Review day', emoji: '\u{1F504}', use_count: 0 },
];

interface LiveMissionLauncherProps {
    open: boolean;
    onClose: () => void;
    onLaunch: (name: string) => void;
    anchorRef?: React.RefObject<HTMLElement>;
}

export default function LiveMissionLauncher({ open, onClose, onLaunch, anchorRef }: LiveMissionLauncherProps) {
    const { user } = useUser();
    const userId = user?.id;
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [liveInput, setLiveInput] = useState('');
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [addingPreset, setAddingPreset] = useState(false);
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
    const [isManageMode, setIsManageMode] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetEmoji, setNewPresetEmoji] = useState('\u26A1');

    useEffect(() => {
        if (!open) return;
        if (inputRef.current) inputRef.current.focus();
    }, [open]);

    useEffect(() => {
        if (!open || !userId) return;
        const fetchPresets = async () => {
            const { data } = await supabase
                .from('task_presets')
                .select('*')
                .eq('user_id', userId)
                .order('use_count', { ascending: false })
                .limit(12);
            setPresets(data ?? []);
        };
        fetchPresets();
    }, [open, userId]);

    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (popoverRef.current && popoverRef.current.contains(target)) return;
            if (anchorRef?.current && anchorRef.current.contains(target)) return;
            onClose();
        };
        document.addEventListener('pointerdown', handlePointerDown, { capture: true });
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
        };
    }, [open, onClose]);

    const displayPresets = useMemo(() => {
        const combined = [...presets];
        const defaultNames = new Set(presets.map(p => p.name.toLowerCase()));
        for (const def of DEFAULT_PRESETS) {
            if (!defaultNames.has(def.name.toLowerCase()) && combined.length < 12) {
                combined.push(def);
            }
        }
        return combined;
    }, [presets]);

    const handleSelectPreset = (preset: Preset) => {
        if (selectedPreset === preset.id) {
            setSelectedPreset(null);
            setLiveInput('');
        } else {
            setSelectedPreset(preset.id);
            setLiveInput(preset.name);
        }
    };

    const handleLiveInputChange = (val: string) => {
        setLiveInput(val);
        const match = displayPresets.find(p => p.name === val);
        setSelectedPreset(match?.id ?? null);
    };

    const bumpPresetUse = async () => {
        if (!selectedPreset || selectedPreset.startsWith('d')) return;
        const preset = presets.find(p => p.id === selectedPreset);
        if (!preset) return;
        const newCount = (preset.use_count ?? 0) + 1;
        await supabase
            .from('task_presets')
            .update({ use_count: newCount, last_used: new Date().toISOString() })
            .eq('id', selectedPreset);
        setPresets(prev => [...prev]
            .map(p => p.id === selectedPreset ? { ...p, use_count: newCount } : p)
            .sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0))
        );
    };

    const handleLaunch = async () => {
        if (!liveInput.trim()) return;
        onLaunch(liveInput.trim());
        setLiveInput('');
        setSelectedPreset(null);
        await bumpPresetUse();
        onClose();
    };

    const savePreset = async () => {
        if (!newPresetName.trim() || !userId) return;

        const isDefault = editingPresetId?.startsWith('d');
        if (editingPresetId && !isDefault) {
            await supabase
                .from('task_presets')
                .update({
                    name: newPresetName.trim(),
                    emoji: newPresetEmoji || '\u26A1'
                })
                .eq('id', editingPresetId);
            setPresets(prev => prev.map(p =>
                p.id === editingPresetId
                    ? { ...p, name: newPresetName.trim(), emoji: newPresetEmoji || '\u26A1' }
                    : p
            ));
        } else {
            const { data } = await supabase
                .from('task_presets')
                .insert({
                    user_id: userId,
                    name: newPresetName.trim(),
                    emoji: newPresetEmoji || '\u26A1',
                    use_count: 0
                })
                .select()
                .single();
            if (data) {
                setPresets(prev => [data as Preset, ...prev]);
                setSelectedPreset((data as Preset).id);
                setLiveInput((data as Preset).name);
            }
        }

        setAddingPreset(false);
        setEditingPresetId(null);
        setNewPresetName('');
        setNewPresetEmoji('\u26A1');
    };

    const handleEditPreset = (preset: Preset) => {
        setEditingPresetId(preset.id);
        setNewPresetName(preset.name);
        setNewPresetEmoji(preset.emoji);
        setAddingPreset(true);
    };

    const deletePreset = async (preset: Preset) => {
        if (preset.id.startsWith('d')) return;
        await supabase
            .from('task_presets')
            .delete()
            .eq('id', preset.id);
        setPresets(prev => prev.filter(p => p.id !== preset.id));
        if (selectedPreset === preset.id) {
            setSelectedPreset(null);
            setLiveInput('');
        }
    };

    const PresetPill = ({ preset }: { preset: Preset }) => {
        const [hovering, setHovering] = useState(false);
        const [showActions, setShowActions] = useState(false);
        const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
        const longPressTriggered = useRef(false);
        const isDefault = preset.id.startsWith('d');
        const isSelected = selectedPreset === preset.id;

        const startLongPress = () => {
            if (isDefault) return;
            longPressTriggered.current = false;
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
            longPressTimer.current = setTimeout(() => {
                longPressTriggered.current = true;
                setShowActions(true);
            }, 500);
        };

        const clearLongPress = () => {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        };

        const activeActions = (hovering || showActions || isManageMode) && !isDefault;

        return (
            <div
                style={{ position: 'relative', display: 'block', width: '100%' }}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => {
                    setHovering(false);
                    if (!longPressTriggered.current && !isManageMode) setShowActions(false);
                }}
                onTouchStart={startLongPress}
                onTouchEnd={clearLongPress}
                onTouchCancel={clearLongPress}
            >
                <button
                    onClick={() => {
                        if (longPressTriggered.current) {
                            longPressTriggered.current = false;
                            return;
                        }
                        if (isManageMode) {
                            handleEditPreset(preset);
                            return;
                        }
                        setShowActions(false);
                        handleSelectPreset(preset);
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 8px',
                        borderRadius: '10px',
                        border: isSelected
                            ? '1px solid rgba(212,160,23,0.6)'
                            : '1px solid rgba(255,255,255,0.08)',
                        background: isSelected
                            ? 'rgba(212,160,23,0.12)'
                            : 'rgba(255,255,255,0.03)',
                        color: isSelected
                            ? '#d4a017'
                            : 'rgba(255,255,255,0.6)',
                        fontSize: '11px',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        minHeight: '28px',
                        justifyContent: 'flex-start',
                        overflow: 'hidden'
                    }}>
                    <span style={{ fontSize: '12px' }}>{preset.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {preset.name}
                    </span>
                </button>

                {activeActions && (
                    <div style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        display: 'flex',
                        gap: '4px',
                        zIndex: 10
                    }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleEditPreset(preset);
                            }}
                            style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: '#d4a017',
                                border: 'none',
                                color: 'black',
                                fontSize: '9px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                            }}>
                            E
                        </button>
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                setShowActions(false);
                                await deletePreset(preset);
                            }}
                            style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: '#f87171',
                                border: 'none',
                                color: 'white',
                                fontSize: '9px',
                                fontWeight: 900,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                            }}>
                            X
                        </button>
                    </div>
                )}
            </div>
        );
    };

    if (!open) return null;

    return (
        <div
            ref={popoverRef}
            className="live-mission-popover"
            role="dialog"
            aria-label="Start mission"
        >
            <div className="live-mission-header">
                <span>START MISSION</span>
                <button onClick={onClose} aria-label="Close">X</button>
            </div>

            <input
                ref={inputRef}
                placeholder="e.g. Deep work session..."
                value={liveInput}
                onChange={(e) => handleLiveInputChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && liveInput.trim()) { handleLaunch(); }
                    else if (e.key === 'Escape') onClose();
                }}
                className="live-mission-input"
            />

            <div className="live-mission-row">
                <span>QUICK LAUNCH</span>
                <div className="live-mission-actions">
                    <button onClick={() => setIsManageMode(!isManageMode)}>
                        {isManageMode ? 'DONE' : 'MANAGE'}
                    </button>
                    <button
                        onClick={() => {
                            setEditingPresetId(null);
                            setNewPresetName('');
                            setNewPresetEmoji('\u26A1');
                            setAddingPreset(true);
                        }}
                    >
                        + ADD
                    </button>
                </div>
            </div>

            <div className="live-mission-grid">
                {displayPresets.map(preset => (
                    <PresetPill key={preset.id} preset={preset} />
                ))}
            </div>

            {addingPreset && (
                <div className="live-mission-editor">
                    <p>{editingPresetId ? 'EDIT PRESET' : 'NEW PRESET'}</p>
                    <div className="live-mission-editor-row">
                        <input
                            value={newPresetEmoji}
                            onChange={e => setNewPresetEmoji(e.target.value)}
                            maxLength={2}
                        />
                        <input
                            autoFocus
                            placeholder="Task name..."
                            value={newPresetName}
                            onChange={e => setNewPresetName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') savePreset();
                                if (e.key === 'Escape') setAddingPreset(false);
                            }}
                        />
                    </div>
                    <div className="live-mission-editor-actions">
                        <button
                            onClick={() => {
                                setAddingPreset(false);
                                setNewPresetName('');
                            setNewPresetEmoji('\u26A1');
                            }}
                        >
                            CANCEL
                        </button>
                        <button onClick={savePreset} disabled={!newPresetName.trim()}>
                            SAVE
                        </button>
                    </div>
                </div>
            )}

            <button className="live-mission-launch" onClick={handleLaunch}>
                LAUNCH
            </button>
        </div>
    );
}
