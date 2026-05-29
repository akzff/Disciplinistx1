'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '@/lib/DataContext';
import { useAuthContext } from '@/lib/AuthContext';
import { useUser } from '@clerk/nextjs';
import { storage, ActiveTask, formatTime } from '@/lib/storage';
import { cloudStorage } from '@/lib/cloudStorage';
import { NavigationBar } from '@/components/NavigationBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import Image from 'next/image';

interface GoalTaskSuggestion {
    id: string;
    goal: string;
    task: string;
}

const DEFAULT_SUGGESTIONS: GoalTaskSuggestion[] = [
    { id: '1', goal: 'Workout', task: 'Back day' },
    { id: '2', goal: 'Workout', task: 'Chest day' },
    { id: '3', goal: 'Workout', task: 'Leg day' },
    { id: '4', goal: 'Deep Work', task: 'Coding core loop' },
    { id: '5', goal: 'Deep Work', task: 'Write documentation' },
    { id: '6', goal: 'Study', task: 'Mathematics review' },
    { id: '7', goal: 'Meditation', task: 'Mindfulness session' }
];

const MOTIVATIONAL_QUOTES = [
    { text: "The future depends on what you do today.", author: "Gandhi" },
    { text: "Your limitation—it's only your imagination.", author: "Anonymous" },
    { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
    { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
    { text: "Difficulty strengthens the mind, as labor does the body.", author: "Seneca" },
    { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
    { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus" },
    { text: "If a man knows not to which port he sails, no wind is favorable.", author: "Seneca" },
    { text: "Do not spoil what you have by desiring what you have not.", author: "Epicurus" },
    { text: "Be tolerant with others and strict with yourself.", author: "Marcus Aurelius" },
    { text: "Well begun is half done.", author: "Aristotle" },
    { text: "No man is free who is not master of himself.", author: "Epictetus" },
    { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" }
];

const PERSONAS = {
    monk: {
        name: 'The Monk',
        icon: '🕯️',
        tagline: 'Calm, ancient, unhurried wisdom.',
        system: `You are The Monk. Speak in measured, unhurried sentences. Use gentle metaphor and silence.
Call the user "child" or by name occasionally. Never rush or shame. When they fail, treat it as data and the path.
Your emotional weapon is peaceful, unwavering belief. Make them feel seen at a soul level.
Use lines like: "the tree that bends in the storm does not break, and neither will you" and
"you did not fail today, you simply found another way that does not work — the path narrows, but it does not end."
Let silence breathe between thoughts. Ask one soft question that opens a door.`
    },
    friend: {
        name: 'The Friend',
        icon: '🫂',
        tagline: 'Radical acceptance with forward momentum.',
        system: `You are The Friend. You have known the user forever.
Match their energy first, then guide it one step forward. Use "bro", "man", or their name casually.
Never lecture; laugh with them, then nudge toward self-respect and action. Sit in the dark for one message if needed,
then slowly turn the light on. Your superpower is warmth plus relentless forward motion.
Make them feel deeply understood before you challenge them.`
    },
    disciplinist: {
        name: 'The Disciplinist',
        icon: '⚔️',
        tagline: 'Brutal honesty, zero excuses.',
        system: `You are The Disciplinist. Hardened, relentless, and precise.
No excuses. No softness. You are not cruel — you are brutally honest because you believe in their potential.
Your emotional weapon is the mirror: expose the gap between who they are and who they could be, then give one non-negotiable action.
Use short, cutting sentences. Then land one clear action.`
    }
};

export default function ActiveTaskPage() {
    const { allChats, preferences, setLocalChat } = useData();
    const { signOut } = useAuthContext();
    const { user } = useUser();

    // Setup form state
    const [goalName, setGoalName] = useState('Workout');
    const [taskName, setTaskName] = useState('');
    const [durationMins, setDurationMins] = useState(25);
    const [timerMode, setTimerMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro');
    const [now, setNow] = useState(Date.now());
    
    // Video Ref
    const videoRef = useRef<HTMLVideoElement>(null);

    // Suggestions state
    const [suggestions, setSuggestions] = useState<GoalTaskSuggestion[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editInputValue, setEditInputValue] = useState('');

    // Load suggestions on mount
    useEffect(() => {
        const stored = localStorage.getItem('disciplinist_goal_task_suggestions');
        if (stored) {
            try {
                setSuggestions(JSON.parse(stored));
            } catch {
                setSuggestions(DEFAULT_SUGGESTIONS);
            }
        } else {
            setSuggestions(DEFAULT_SUGGESTIONS);
            localStorage.setItem('disciplinist_goal_task_suggestions', JSON.stringify(DEFAULT_SUGGESTIONS));
        }
    }, []);

    const saveSuggestions = (list: GoalTaskSuggestion[]) => {
        setSuggestions(list);
        localStorage.setItem('disciplinist_goal_task_suggestions', JSON.stringify(list));
    };

    const handleSaveGoalEdit = (oldGoalName: string, newGoalName: string) => {
        if (!newGoalName.trim()) return;
        const updated = suggestions.map(s => {
            if (s.goal.toLowerCase() === oldGoalName.toLowerCase()) {
                return { ...s, goal: newGoalName.trim() };
            }
            return s;
        });
        saveSuggestions(updated);
        setGoalName(newGoalName.trim());
        setEditingId(null);
    };

    const handleDeleteGoal = (goalToDelete: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = suggestions.filter(s => s.goal.toLowerCase() !== goalToDelete.toLowerCase());
        saveSuggestions(updated);
        if (goalName.toLowerCase() === goalToDelete.toLowerCase()) {
            setGoalName('');
        }
    };

    const handleSaveTaskEdit = (suggestionId: string, newTaskName: string) => {
        if (!newTaskName.trim()) return;
        const updated = suggestions.map(s => {
            if (s.id === suggestionId) {
                return { ...s, task: newTaskName.trim() };
            }
            return s;
        });
        saveSuggestions(updated);
        setTaskName(newTaskName.trim());
        setEditingId(null);
    };

    const handleDeleteTask = (suggestionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = suggestions.filter(s => s.id !== suggestionId);
        saveSuggestions(updated);
        setTaskName('');
    };

    // Calculate unique goals for the suggestions bar
    const uniqueGoals = useMemo(() => {
        return Array.from(new Set(suggestions.map(s => s.goal)));
    }, [suggestions]);

    // Quotes state
    const [leftQuote, setLeftQuote] = useState(MOTIVATIONAL_QUOTES[0]);
    const [rightQuote, setRightQuote] = useState(MOTIVATIONAL_QUOTES[1]);
    const [leftOpacity, setLeftOpacity] = useState(1);
    const [rightOpacity, setRightOpacity] = useState(1);

    const displayName = preferences?.name || 'User';
    const currentPfp = preferences?.pfp;
    const activeDay = storage.getCurrentDate();
    const todayChat = allChats[activeDay];

    // Identify the single currently active/paused task for today
    const currentActiveTask = useMemo(() => {
        if (!todayChat?.activeTasks) return null;
        return todayChat.activeTasks.find(t => t.status === 'RUNNING' || t.status === 'PAUSED') || null;
    }, [todayChat]);

    // Track active day time tick
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Sync video play/pause
    useEffect(() => {
        if (!videoRef.current) return;
        if (currentActiveTask?.status === 'RUNNING') {
            videoRef.current.play().catch(e => console.log('Video play interrupted:', e));
        } else {
            videoRef.current.pause();
        }
    }, [currentActiveTask?.status]);

    // Quote rotation effect
    useEffect(() => {
        const quoteInterval = setInterval(() => {
            setLeftOpacity(0);
            setRightOpacity(0);

            setTimeout(() => {
                const leftIdx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
                let rightIdx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
                while (leftIdx === rightIdx) {
                    rightIdx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
                }
                setLeftQuote(MOTIVATIONAL_QUOTES[leftIdx]);
                setRightQuote(MOTIVATIONAL_QUOTES[rightIdx]);

                setLeftOpacity(1);
                setRightOpacity(1);
            }, 500);
        }, 15000);

        return () => clearInterval(quoteInterval);
    }, []);

    const activePersona = useMemo(() => {
        const pId = preferences?.persona || 'friend';
        return PERSONAS[pId] || PERSONAS.friend;
    }, [preferences?.persona]);

    function formatDigitalTimer(ms: number): string {
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    }

    const handleStartTask = async () => {
        if (!goalName.trim() || !taskName.trim()) return;
        
        // Auto-save new suggestions
        const exists = suggestions.some(s => s.goal.toLowerCase() === goalName.trim().toLowerCase() && s.task.toLowerCase() === taskName.trim().toLowerCase());
        if (!exists) {
            const newSug = {
                id: Date.now().toString(),
                goal: goalName.trim(),
                task: taskName.trim()
            };
            saveSuggestions([newSug, ...suggestions]);
        }

        const name = `${goalName.trim()} - ${taskName.trim()}`;
        const targetDurationMs = timerMode === 'pomodoro' ? durationMins * 60 * 1000 : 0;

        const newTask: ActiveTask = {
            id: Date.now().toString(),
            name: name,
            startTime: Date.now(),
            status: 'RUNNING',
            totalActiveTime: 0,
            totalPausedTime: 0,
            lastStartedAt: Date.now(),
            duration: targetDurationMs
        };

        const currentActiveTasks = todayChat?.activeTasks || [];
        const nextActiveTasks = [newTask, ...currentActiveTasks];
        const systemUserMsg = {
            role: 'user' as const,
            content: `[Protocol Started]: Mission "${name}" is now live.`,
            timestamp: Date.now()
        };
        const nextMessages = [...(todayChat?.messages || []), systemUserMsg];

        setLocalChat(activeDay, { activeTasks: nextActiveTasks, messages: nextMessages });
        cloudStorage.saveChat(activeDay, { activeTasks: nextActiveTasks, messages: nextMessages }, user?.id || undefined, true).catch(err => {
            console.warn('Background cloud save failed:', err);
        });

        // Fetch real-time AI mentor response
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: nextMessages.slice(-8).map(m => ({ role: m.role, content: m.content })),
                    model: preferences?.selectedModel,
                    systemPrompt: `You are ${activePersona.name}. ${activePersona.tagline}\n${activePersona.system}`
                })
            });
            if (response.ok) {
                const data = await response.json();
                const aiContent = data.choices[0].message.content;
                const aiMessage = {
                    role: 'assistant' as const,
                    content: aiContent
                        .replace(/TASK_REQUEST:\s*['"](.+?)['"]/gi, '')
                        .replace(/MOOD:\s*['"]?(DISAPPOINTED|HOPEFUL|DOMINATOR|NEUTRAL)['"]?/gi, '')
                        .trim(),
                    timestamp: Date.now()
                };
                const finalMessages = [...nextMessages, aiMessage];
                setLocalChat(activeDay, { messages: finalMessages });
                cloudStorage.saveChat(activeDay, { messages: finalMessages }, user?.id || undefined, true).catch(err => {
                    console.warn('Background cloud save failed:', err);
                });
            }
        } catch (e) {
            console.warn('AI start notification failed', e);
        }
    };

    const handleToggleTask = async () => {
        if (!currentActiveTask) return;
        const timestamp = Date.now();
        const nextActiveTasks = (todayChat?.activeTasks || []).map(t => {
            if (t.id === currentActiveTask.id) {
                if (t.status === 'RUNNING') {
                    const activeNow = timestamp - (t.lastStartedAt || t.startTime || timestamp);
                    return {
                        ...t,
                        status: 'PAUSED' as const,
                        totalActiveTime: (t.totalActiveTime || 0) + (activeNow > 0 ? activeNow : 0),
                        lastPausedAt: timestamp
                    };
                }
                const pausedNow = timestamp - (t.lastPausedAt || t.startTime || timestamp);
                return {
                    ...t,
                    status: 'RUNNING' as const,
                    totalPausedTime: (t.totalPausedTime || 0) + (pausedNow > 0 ? pausedNow : 0),
                    lastStartedAt: timestamp
                };
            }
            return t;
        });

        setLocalChat(activeDay, { activeTasks: nextActiveTasks });
        cloudStorage.saveChat(activeDay, { activeTasks: nextActiveTasks }, user?.id || undefined, true).catch(err => {
            console.warn('Background cloud save failed:', err);
        });
    };

    const handleFinishTask = async () => {
        if (!currentActiveTask) return;
        const timestamp = Date.now();
        const finalActiveTime = currentActiveTask.status === 'RUNNING'
            ? (currentActiveTask.totalActiveTime || 0) + Math.max(0, timestamp - (currentActiveTask.lastStartedAt || currentActiveTask.startTime || timestamp))
            : (currentActiveTask.totalActiveTime || 0);
        const finalPausedTime = currentActiveTask.status === 'PAUSED'
            ? (currentActiveTask.totalPausedTime || 0) + Math.max(0, timestamp - (currentActiveTask.lastPausedAt || currentActiveTask.startTime || timestamp))
            : (currentActiveTask.totalPausedTime || 0);

        const remaining = (todayChat?.activeTasks || []).filter(t => t.id !== currentActiveTask.id);
        const updatedCompleted = [
            ...(todayChat?.completedTasks || []),
            {
                name: currentActiveTask.name,
                activeTime: finalActiveTime,
                pausedTime: finalPausedTime,
                finishedAt: timestamp,
                abandonmentReason: '',
                notes: currentActiveTask.notes || []
            }
        ];

        const historyEntry = {
            id: Math.random().toString(36).substring(7),
            todoId: currentActiveTask.id,
            text: currentActiveTask.name,
            tickedAt: timestamp,
            createdAt: currentActiveTask.startTime || timestamp,
            importance: 5,
            type: 'active' as const,
            activeTime: finalActiveTime,
            pausedTime: finalPausedTime
        };
        const updatedHistory = [...(todayChat?.todoHistory || []), historyEntry];

        const completionMessage = {
            role: 'assistant' as const,
            content: `How did "${currentActiveTask.name}" go? Share your reflection. If you abandoned or switched tasks, explain what triggered it.`,
            completedMission: {
                name: currentActiveTask.name,
                startTime: currentActiveTask.startTime,
                endTime: timestamp,
                activeTime: finalActiveTime,
                pausedTime: finalPausedTime,
                notes: currentActiveTask.notes || []
            },
            timestamp: timestamp
        };

        const nextMessages = [...(todayChat?.messages || []), completionMessage];

        setLocalChat(activeDay, {
            activeTasks: remaining,
            completedTasks: updatedCompleted,
            todoHistory: updatedHistory,
            messages: nextMessages
        });
        cloudStorage.saveChat(activeDay, {
            activeTasks: remaining,
            completedTasks: updatedCompleted,
            todoHistory: updatedHistory,
            messages: nextMessages
        }, user?.id || undefined, true).catch(err => {
            console.warn('Background cloud save failed:', err);
        });

        // Fetch real-time AI mentor response
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: nextMessages.slice(-8).map(m => ({ role: m.role, content: m.content })),
                    model: preferences?.selectedModel,
                    systemPrompt: `You are ${activePersona.name}. ${activePersona.tagline}\n${activePersona.system}`
                })
            });
            if (response.ok) {
                const data = await response.json();
                const aiContent = data.choices[0].message.content;
                const aiMessage = {
                    role: 'assistant' as const,
                    content: aiContent
                        .replace(/TASK_REQUEST:\s*['"](.+?)['"]/gi, '')
                        .replace(/MOOD:\s*['"]?(DISAPPOINTED|HOPEFUL|DOMINATOR|NEUTRAL)['"]?/gi, '')
                        .trim(),
                    timestamp: Date.now()
                };
                const finalMessages = [...nextMessages, aiMessage];
                setLocalChat(activeDay, { messages: finalMessages });
                cloudStorage.saveChat(activeDay, { messages: finalMessages }, user?.id || undefined, true).catch(err => {
                    console.warn('Background cloud save failed:', err);
                });
            }
        } catch (e) {
            console.warn('AI completion notification failed', e);
        }
    };

    // Calculations for active task timer and progress
    const timerStats = useMemo(() => {
        if (!currentActiveTask) return null;

        const activeTime = currentActiveTask.status === 'RUNNING'
            ? (currentActiveTask.totalActiveTime || 0) + Math.max(0, now - (currentActiveTask.lastStartedAt || currentActiveTask.startTime || now))
            : (currentActiveTask.totalActiveTime || 0);

        const isStopwatch = !currentActiveTask.duration || currentActiveTask.duration === 0;
        const targetDuration = currentActiveTask.duration || 0;
        
        const progressPercent = isStopwatch
            ? (activeTime % 60000) / 600
            : Math.min(100, (activeTime / targetDuration) * 100);

        let mainTimerString = '';
        let subtitleString = '';

        if (isStopwatch) {
            mainTimerString = formatDigitalTimer(activeTime);
            subtitleString = 'STOPWATCH MODE';
        } else {
            const remaining = Math.max(0, targetDuration - activeTime);
            mainTimerString = formatDigitalTimer(remaining);
            subtitleString = `TARGET: ${formatTime(targetDuration, false)}`;
        }

        return {
            activeTime,
            targetDuration,
            progressPercent,
            isStopwatch,
            mainTimerString,
            subtitleString
        };
    }, [currentActiveTask, now]);

    return (
        <main className="chat-page">
            <div className="bg-mesh"></div>

            <div className="chat-container">
                <header className="chat-header">
                    <div className="chat-header__left" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div
                            className="status-indicator"
                            style={{
                                '--mood-color': '#10b981'
                            } as React.CSSProperties}
                        ></div>
                        <h1 className="app-title">
                            <span className="app-title__brand">DISCIPLINIST</span>
                        </h1>
                    </div>

                    <div className="nav-center-wrapper desktop-only" style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
                        <NavigationBar />
                    </div>

                    <div className="header-controls" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div className="profile-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
                                {currentPfp ? (
                                    <Image
                                        src={currentPfp}
                                        alt="avatar"
                                        width={28}
                                        height={28}
                                        style={{ borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #10b981', flexShrink: 0 }}
                                    />
                                ) : (
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '900', boxShadow: '0 2px 10px rgba(139, 92, 246, 0.3)' }}>
                                        {displayName.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                                <span className="mobile-hidden" style={{ fontSize: '0.7rem', opacity: 0.7, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>{displayName}</span>
                                <button
                                    onClick={signOut}
                                    title="Sign Out"
                                    className="logout-btn"
                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px', transition: 'color 0.2s' }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', position: 'relative' }}>
                    <div className="active-task-page-container">
                        {!currentActiveTask ? (
                            /* Setup Form View */
                            <form onSubmit={(e) => { e.preventDefault(); handleStartTask(); }} className="active-task-setup-card">
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '2.5rem', letterSpacing: '0.05em', textAlign: 'center', color: 'white' }}>LAUNCH ACTIVE MISSION</h2>
                                
                                <div className="active-task-form-group">
                                    <label className="active-task-form-label">Goal / Category</label>
                                    <input 
                                        type="text" 
                                        className="active-task-form-input" 
                                        placeholder="e.g. Workout, Deep Work, Coding"
                                        value={goalName}
                                        onChange={(e) => setGoalName(e.target.value)}
                                        required
                                    />
                                    {/* Goal suggestions */}
                                    <div className="suggestion-section">
                                        <div className="suggestion-container">
                                            {uniqueGoals.map(g => {
                                                const isEditing = editingId === `goal-${g}`;
                                                const isActive = goalName.toLowerCase() === g.toLowerCase();
                                                return (
                                                    <div 
                                                        key={g}
                                                        className={`suggestion-pill${isActive ? ' suggestion-pill--active' : ''}`}
                                                        onClick={() => setGoalName(g)}
                                                    >
                                                        {isEditing ? (
                                                            <>
                                                                <input 
                                                                    type="text"
                                                                    className="suggestion-inline-input"
                                                                    value={editInputValue}
                                                                    onChange={(e) => setEditInputValue(e.target.value)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveGoalEdit(g, editInputValue);
                                                                        else if (e.key === 'Escape') setEditingId(null);
                                                                    }}
                                                                    autoFocus
                                                                />
                                                                <button 
                                                                    type="button"
                                                                    className="suggestion-inline-save-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSaveGoalEdit(g, editInputValue);
                                                                    }}
                                                                >
                                                                    ✓
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>{g}</span>
                                                                <div className="suggestion-pill-actions">
                                                                    <button 
                                                                        type="button"
                                                                        className="suggestion-pill-btn"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingId(`goal-${g}`);
                                                                            setEditInputValue(g);
                                                                        }}
                                                                        title="Edit"
                                                                    >
                                                                        ✎
                                                                    </button>
                                                                    <button 
                                                                        type="button"
                                                                        className="suggestion-pill-btn delete"
                                                                        onClick={(e) => handleDeleteGoal(g, e)}
                                                                        title="Delete"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="active-task-form-group">
                                    <label className="active-task-form-label">Specific Task</label>
                                    <input 
                                        type="text" 
                                        className="active-task-form-input" 
                                        placeholder="e.g. Back day, Write API, Refactor CSS"
                                        value={taskName}
                                        onChange={(e) => setTaskName(e.target.value)}
                                        required
                                    />
                                    {/* Task suggestions mapped to selected Goal */}
                                    <div className="suggestion-section">
                                        <div className="suggestion-container">
                                            {suggestions
                                                .filter(s => s.goal.toLowerCase() === goalName.toLowerCase())
                                                .map(s => {
                                                    const isEditing = editingId === s.id;
                                                    const isActive = taskName.toLowerCase() === s.task.toLowerCase();
                                                    return (
                                                        <div 
                                                            key={s.id}
                                                            className={`suggestion-pill${isActive ? ' suggestion-pill--active' : ''}`}
                                                            onClick={() => setTaskName(s.task)}
                                                        >
                                                            {isEditing ? (
                                                                <>
                                                                    <input 
                                                                        type="text"
                                                                        className="suggestion-inline-input"
                                                                        value={editInputValue}
                                                                        onChange={(e) => setEditInputValue(e.target.value)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleSaveTaskEdit(s.id, editInputValue);
                                                                            else if (e.key === 'Escape') setEditingId(null);
                                                                        }}
                                                                        autoFocus
                                                                    />
                                                                    <button 
                                                                        type="button"
                                                                        className="suggestion-inline-save-btn"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleSaveTaskEdit(s.id, editInputValue);
                                                                        }}
                                                                    >
                                                                        ✓
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>{s.task}</span>
                                                                    <div className="suggestion-pill-actions">
                                                                        <button 
                                                                            type="button"
                                                                            className="suggestion-pill-btn"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingId(s.id);
                                                                                setEditInputValue(s.task);
                                                                            }}
                                                                            title="Edit"
                                                                        >
                                                                            ✎
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            className="suggestion-pill-btn delete"
                                                                            onClick={(e) => handleDeleteTask(s.id, e)}
                                                                            title="Delete"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            {suggestions.filter(s => s.goal.toLowerCase() === goalName.toLowerCase()).length === 0 && goalName.trim() !== '' && (
                                                <span className="suggestion-hint">No mapped tasks. Save your session to auto-add suggestions.</span>
                                            )}
                                            {goalName.trim() === '' && (
                                                <span className="suggestion-hint">Select a Goal to display associated tasks.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="active-task-form-group">
                                    <label className="active-task-form-label">Mission Tracking Mode</label>
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                                        {[
                                            { id: 'pomodoro', label: '⏳ POMODORO (TIMER)' },
                                            { id: 'stopwatch', label: '⏱️ STOPWATCH (COUNT UP)' }
                                        ].map((m) => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setTimerMode(m.id as 'pomodoro' | 'stopwatch')}
                                                style={{
                                                    flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                                                    background: timerMode === m.id ? '#d4a017' : 'rgba(255,255,255,0.05)',
                                                    color: timerMode === m.id ? 'black' : 'rgba(255,255,255,0.6)',
                                                    fontWeight: '950', fontSize: '0.75rem', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    letterSpacing: '0.02em'
                                                }}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {timerMode === 'pomodoro' && (
                                    <div className="active-task-form-group">
                                        <label className="active-task-form-label">Duration (Minutes)</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            max="480"
                                            className="active-task-form-input" 
                                            placeholder="25"
                                            value={durationMins}
                                            onChange={(e) => setDurationMins(parseInt(e.target.value) || 25)}
                                        />
                                    </div>
                                )}

                                <button 
                                                                    type="submit"
                                                                    className="active-task-start-btn"
                                                                >
                                                                    Start Session
                                                                </button>
                            </form>
                        ) : (
                            /* Active Session dashboard View */
                            <div className="active-running-dashboard">
                                <div className="active-running-title-block">
                                    <div className="active-running-goal">
                                        <span className="active-running-goal-check">✓</span>
                                        {currentActiveTask.name.split(' - ')[0]}
                                    </div>
                                    <h2 className="active-running-task">{currentActiveTask.name.split(' - ')[1] || currentActiveTask.name}</h2>
                                </div>

                                <div className="active-running-quotes-row">
                                    {/* Left Quote */}
                                    <div className="quote-flank left" style={{ opacity: leftOpacity }}>
                                        <p className="quote-flank-text">&ldquo;{leftQuote.text}&rdquo;</p>
                                        <span className="quote-flank-author">&mdash; {leftQuote.author}</span>
                                    </div>

                                    {/* Looping Visual Card */}
                                    <div 
                                        className={`visual-loop-card${currentActiveTask.status !== 'RUNNING' ? ' visual-loop-card--paused' : ''}`} 
                                        onClick={handleToggleTask}
                                    >
                                        <div className="visual-loop-canvas-placeholder">
                                            {/* Looping Premium Video */}
                                            <video
                                                ref={videoRef}
                                                src="/video/focus-loop.mp4.mp4"
                                                loop
                                                muted
                                                playsInline
                                                preload="auto"
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    borderRadius: '35px',
                                                    zIndex: 0,
                                                    willChange: 'transform',
                                                    transform: 'translate3d(0, 0, 0)'
                                                }}
                                            />

                                            {/* Middle Play/Pause Indicator Button (Visible ONLY when paused, and very large) */}
                                            {currentActiveTask.status !== 'RUNNING' && (
                                                <div className="visual-loop-play-overlay" style={{ zIndex: 10 }}>
                                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(2px)' }}>
                                                        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Quote */}
                                    <div className="quote-flank right" style={{ opacity: rightOpacity }}>
                                        <p className="quote-flank-text">&ldquo;{rightQuote.text}&rdquo;</p>
                                        <span className="quote-flank-author">&mdash; {rightQuote.author}</span>
                                    </div>
                                </div>

                                <div className="timer-progress-block">
                                    {/* Glowing Progress/Loading Bar */}
                                    <div className="timer-loading-bar-bg">
                                        <div 
                                            className="timer-loading-bar-fill"
                                            style={{ width: `${timerStats?.progressPercent || 0}%` }}
                                        ></div>
                                    </div>

                                    <div className="timer-numbers" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 4px', margin: '12px 0 6px 0' }}>
                                        <span className="timer-elapsed" style={{ fontSize: '3rem', fontWeight: '950', fontFamily: 'monospace', letterSpacing: '-0.02em', color: 'white' }}>
                                            {timerStats?.mainTimerString}
                                        </span>
                                        <span className="timer-total" style={{ fontSize: '0.7rem', fontWeight: '900', color: '#d4a017', letterSpacing: '0.1em', opacity: 0.8 }}>
                                            {timerStats?.subtitleString}
                                        </span>
                                    </div>

                                    {/* Premium Oval Controls */}
                                    <div className="timer-controls-row">
                                        {currentActiveTask.status === 'RUNNING' ? (
                                            <button 
                                                className="timer-btn-pause"
                                                onClick={handleToggleTask}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="6" y="4" width="4" height="16" fill="currentColor"></rect>
                                                    <rect x="14" y="4" width="4" height="16" fill="currentColor"></rect>
                                                </svg>
                                                PAUSE
                                            </button>
                                        ) : (
                                            <button 
                                                className="timer-btn-pause"
                                                onClick={handleToggleTask}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
                                                </svg>
                                                RESUME
                                            </button>
                                        )}

                                        <button 
                                            className="timer-btn-finish"
                                            onClick={handleFinishTask}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                            FINISH
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <MobileBottomNav />
            </div>
        </main>
    );
}
