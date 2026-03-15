'use client';

import React, { useEffect, useRef, useState } from 'react';

const SUGGESTED_TASKS = [
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
    anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function LiveMissionLauncher({ open, onClose, onLaunch, anchorRef }: LiveMissionLauncherProps) {
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [liveInput, setLiveInput] = useState('');

    useEffect(() => {
        if (!open) return;
        if (inputRef.current) inputRef.current.focus();
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
                <span>RECOMMENDATIONS</span>
                <div className="live-mission-tags">
                    {SUGGESTED_TASKS.map((label) => {
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
