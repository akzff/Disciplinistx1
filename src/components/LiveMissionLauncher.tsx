'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PresetTaskManager } from '@/lib/presetTasks';

const DEFAULT_SUGGESTED_TASKS = [
    'Deep work session',
    'Gym session',
    'Study block',
    'Meditation',
    'Review day',
    'Planning sprint'
];

interface LiveMissionLauncherProps {
    open: boolean;
    onClose: () => void;
    onLaunch: (name: string) => void;
    onEditPresets?: () => void;
    anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function LiveMissionLauncher({ open, onClose, onLaunch, onEditPresets, anchorRef }: LiveMissionLauncherProps) {
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [liveInput, setLiveInput] = useState('');
    const [suggestedTasks, setSuggestedTasks] = useState<string[]>(DEFAULT_SUGGESTED_TASKS);

    useEffect(() => {
        if (!open) return;
        if (inputRef.current) inputRef.current.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const presets = PresetTaskManager.getActiveTasks().map(task => task.name);
        setSuggestedTasks(presets.length > 0 ? presets : DEFAULT_SUGGESTED_TASKS);
    }, [open]);

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
    }, [open, onClose, anchorRef]);

    const handleLaunch = () => {
        if (!liveInput.trim()) return;
        onLaunch(liveInput.trim());
        setLiveInput('');
        onClose();
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
                onChange={(e) => setLiveInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && liveInput.trim()) { handleLaunch(); }
                    else if (e.key === 'Escape') onClose();
                }}
                className="live-mission-input"
            />

            <div className="live-mission-suggestions">
                <div className="live-mission-suggestions-head">
                    <span>RECOMMENDATIONS</span>
                    {onEditPresets && (
                        <button
                            type="button"
                            className="live-mission-edit"
                            onClick={onEditPresets}
                            aria-label="Edit preset tasks"
                        >
                            <svg className="live-mission-edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                            Edit presets
                        </button>
                    )}
                </div>
                <div className="live-mission-tags">
                    {suggestedTasks.map((label) => {
                        const active = liveInput.trim().toLowerCase() === label.toLowerCase();
                        return (
                            <button
                                key={label}
                                className={`live-mission-tag${active ? ' live-mission-tag--active' : ''}`}
                                onClick={() => setLiveInput(label)}
                                type="button"
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <button className="live-mission-launch" onClick={handleLaunch}>
                LAUNCH
            </button>
        </div>
    );
}
