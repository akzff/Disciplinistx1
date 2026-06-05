'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

// Premium chimes synthesized using HTML5 Web Audio API based on active persona
const playPersonaSound = (
    type: 'success' | 'break-end',
    soundType: 'persona' | 'chime' | 'silent',
    persona: string,
    volumePercent: number
) => {
    try {
        if (soundType === 'silent') return;
        
        const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : null;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const volume = (volumePercent / 100) * 0.15; // normalize volume
        
        if (soundType === 'chime') {
            if (type === 'success') {
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
                osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
                
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
                osc2.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.3);
                
                gain.gain.setValueAtTime(volume, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);
                
                osc1.start();
                osc2.start();
                osc1.stop(ctx.currentTime + 0.5);
                osc2.stop(ctx.currentTime + 0.5);
            } else {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.15);
                osc.frequency.setValueAtTime(987.77, ctx.currentTime + 0.3);
                
                gain.gain.setValueAtTime(volume, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.6);
            }
        } else if (soundType === 'persona') {
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(volume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
            gain.connect(ctx.destination);

            if (persona === 'monk') {
                // The Monk: Deep temple singing bowl
                const oscs = [144, 288, 432, 576].map((freq, index) => {
                    const osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime);
                    
                    const subGain = ctx.createGain();
                    subGain.gain.setValueAtTime(index === 0 ? 0.8 : 0.3 / index, ctx.currentTime);
                    subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
                    
                    osc.connect(subGain);
                    subGain.connect(gain);
                    return osc;
                });
                oscs.forEach(o => { o.start(); o.stop(ctx.currentTime + 1.5); });
            } else if (persona === 'disciplinist') {
                // The Disciplinist: Sword clang with beating frequencies
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                
                osc1.type = 'sawtooth';
                osc1.frequency.setValueAtTime(880, ctx.currentTime);
                osc1.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.4);
                
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(883, ctx.currentTime);
                osc2.frequency.exponentialRampToValueAtTime(222, ctx.currentTime + 0.4);
                
                const bandpass = ctx.createBiquadFilter();
                bandpass.type = 'bandpass';
                bandpass.frequency.setValueAtTime(800, ctx.currentTime);
                bandpass.Q.setValueAtTime(4, ctx.currentTime);
                
                osc1.connect(bandpass);
                osc2.connect(bandpass);
                bandpass.connect(gain);
                
                osc1.start();
                osc2.start();
                osc1.stop(ctx.currentTime + 0.6);
                osc2.stop(ctx.currentTime + 0.6);
            } else {
                // The Friend: Upbeat warm major pentatonic arpeggio
                const frequencies = type === 'success' 
                    ? [523.25, 659.25, 783.99, 1046.50]
                    : [587.33, 698.46, 880.00, 1174.66];
                
                frequencies.forEach((freq, index) => {
                    const osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.12);
                    
                    const noteGain = ctx.createGain();
                    noteGain.gain.setValueAtTime(0.6, ctx.currentTime + index * 0.12);
                    noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.12 + 0.5);
                    
                    osc.connect(noteGain);
                    noteGain.connect(gain);
                    osc.start(ctx.currentTime + index * 0.12);
                    osc.stop(ctx.currentTime + index * 0.12 + 0.5);
                });
            }
        }
    } catch (e) {
        console.warn('Audio synthesis playback failed:', e);
    }
};

// Request and dispatch system tray notifications
const sendBrowserNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }
};

const DEFAULT_POMODORO_SETTINGS = {
    focusMins: 25,
    shortBreakMins: 5,
    longBreakMins: 15,
    longBreakInterval: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
    soundVolume: 50,
    soundType: 'persona' as const,
    ambientSound: 'none' as const,
    useReflectionPrompts: true,
    activeBlueprint: 'classic' as const
};

export default function ActiveTaskPage() {
    const { allChats, preferences, setLocalChat, updatePreferences } = useData();
    const { signOut } = useAuthContext();
    const { user } = useUser();

    const pomoSettings = useMemo(() => {
        return preferences?.pomodoroSettings || DEFAULT_POMODORO_SETTINGS;
    }, [preferences?.pomodoroSettings]);

    const ambientAudioRef = useRef<{
        ctx: AudioContext;
        sources: (OscillatorNode | ScriptProcessorNode | AudioNode)[];
    } | null>(null);

    const [showSettingsPanel, setShowSettingsPanel] = useState(false);

    const stopAmbientSound = useCallback(() => {
        try {
            if (ambientAudioRef.current) {
                const { ctx, sources } = ambientAudioRef.current;
                sources.forEach(s => {
                    try {
                        if ('stop' in s && typeof (s as OscillatorNode).stop === 'function') {
                            (s as OscillatorNode).stop();
                        }
                    } catch {}
                    try { s.disconnect(); } catch {}
                });
                if (ctx.state !== 'closed') {
                    ctx.close();
                }
                ambientAudioRef.current = null;
            }
        } catch (e) {
            console.warn('Could not stop ambient sound:', e);
        }
    }, []);

    const startAmbientSound = useCallback(() => {
        try {
            stopAmbientSound();
            
            const ambientType = pomoSettings.ambientSound;
            if (ambientType === 'none') return;
            
            const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : null;
            if (!AudioContextClass) return;
            
            const ctx = new AudioContextClass();
            const sources: (OscillatorNode | ScriptProcessorNode | AudioNode)[] = [];
            const volumeNode = ctx.createGain();
            volumeNode.gain.setValueAtTime((pomoSettings.soundVolume / 100) * 0.08, ctx.currentTime);
            volumeNode.connect(ctx.destination);
            
            if (ambientType === 'binaural_beats') {
                const oscL = ctx.createOscillator();
                oscL.type = 'sine';
                oscL.frequency.setValueAtTime(200, ctx.currentTime);
                
                const panL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
                if (panL) {
                    panL.pan.setValueAtTime(-1, ctx.currentTime);
                    oscL.connect(panL);
                    panL.connect(volumeNode);
                } else {
                    oscL.connect(volumeNode);
                }
                
                const oscR = ctx.createOscillator();
                oscR.type = 'sine';
                oscR.frequency.setValueAtTime(210, ctx.currentTime);
                
                const panR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
                if (panR) {
                    panR.pan.setValueAtTime(1, ctx.currentTime);
                    oscR.connect(panR);
                    panR.connect(volumeNode);
                } else {
                    oscR.connect(volumeNode);
                }
                
                oscL.start();
                oscR.start();
                sources.push(oscL, oscR);
            } else if (ambientType === 'pink_noise') {
                const bufferSize = 4096;
                const node = ctx.createScriptProcessor ? ctx.createScriptProcessor(bufferSize, 1, 1) : null;
                if (node) {
                    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                    node.onaudioprocess = (e) => {
                        const output = e.outputBuffer.getChannelData(0);
                        for (let i = 0; i < bufferSize; i++) {
                            const white = Math.random() * 2 - 1;
                            b0 = 0.99886 * b0 + white * 0.0555179;
                            b1 = 0.99332 * b1 + white * 0.0750759;
                            b2 = 0.96900 * b2 + white * 0.1538520;
                            b3 = 0.86650 * b3 + white * 0.3104856;
                            b4 = 0.55000 * b4 + white * 0.5329522;
                            b5 = -0.7616 * b5 - white * 0.0168980;
                            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                            output[i] *= 0.11;
                            b6 = white * 0.115926;
                        }
                    };
                    node.connect(volumeNode);
                    sources.push(node);
                }
            }
            
            ambientAudioRef.current = { ctx, sources };
        } catch (e) {
            console.warn('Could not start ambient sound:', e);
        }
    }, [pomoSettings.ambientSound, pomoSettings.soundVolume, stopAmbientSound]);

    // Setup form state
    const [goalName, setGoalName] = useState('');
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
    
    // Layout and navigation states
    const [expandGoals, setExpandGoals] = useState(false);
    const [expandTasks, setExpandTasks] = useState(false);
    
    // Break timer states
    const [breakActive, setBreakActive] = useState(false);
    const [breakTotalDuration, setBreakTotalDuration] = useState(5 * 60 * 1000);
    const [breakTimeRemaining, setBreakTimeRemaining] = useState(5 * 60 * 1000);
    const [breakPaused, setBreakPaused] = useState(false);

    // Pomodoro completion states
    const [showFinishedOptions, setShowFinishedOptions] = useState(false);
    const [pomodoroFinishedHandled, setPomodoroFinishedHandled] = useState(false);
    
    // Layout container refs for mouse scrollwheel navigation
    const goalsContainerRef = useRef<HTMLDivElement>(null);
    const tasksContainerRef = useRef<HTMLDivElement>(null);

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

    // Recommend closest related registered goals based on typed letters
    const filteredGoals = useMemo(() => {
        const query = goalName.trim().toLowerCase();
        if (!query) return uniqueGoals;
        
        return uniqueGoals
            .filter(g => g.toLowerCase().includes(query))
            .sort((a, b) => {
                const aLow = a.toLowerCase();
                const bLow = b.toLowerCase();
                // Exact match first
                if (aLow === query) return -1;
                if (bLow === query) return 1;
                // Starts-with next
                if (aLow.startsWith(query) && !bLow.startsWith(query)) return -1;
                if (bLow.startsWith(query) && !aLow.startsWith(query)) return 1;
                // Alphabetical fallback
                return aLow.localeCompare(bLow);
            });
    }, [uniqueGoals, goalName]);

    // Recommend closest related registered tasks for selected goal based on typed letters
    const filteredTasks = useMemo(() => {
        const query = taskName.trim().toLowerCase();
        const tasksForGoal = suggestions.filter(s => s.goal.toLowerCase() === goalName.toLowerCase());
        if (!query) return tasksForGoal;
        
        return tasksForGoal
            .filter(s => s.task.toLowerCase().includes(query))
            .sort((a, b) => {
                const aLow = a.task.toLowerCase();
                const bLow = b.task.toLowerCase();
                // Exact match first
                if (aLow === query) return -1;
                if (bLow === query) return 1;
                // Starts-with next
                if (aLow.startsWith(query) && !bLow.startsWith(query)) return -1;
                if (bLow.startsWith(query) && !aLow.startsWith(query)) return 1;
                // Alphabetical fallback
                return aLow.localeCompare(bLow);
            });
    }, [suggestions, goalName, taskName]);

    // Hook up wheel listener to translate vertical scroll to horizontal scroll on desktop
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            const container = e.currentTarget as HTMLDivElement;
            if (container && container.scrollWidth > container.clientWidth) {
                e.preventDefault();
                container.scrollLeft += e.deltaY;
            }
        };

        const goalsEl = goalsContainerRef.current;
        const tasksEl = tasksContainerRef.current;

        if (goalsEl) {
            goalsEl.addEventListener('wheel', handleWheel, { passive: false });
        }
        if (tasksEl) {
            tasksEl.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            if (goalsEl) {
                goalsEl.removeEventListener('wheel', handleWheel);
            }
            if (tasksEl) {
                tasksEl.removeEventListener('wheel', handleWheel);
            }
        };
    }, [filteredGoals, filteredTasks]);

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

    // Today's total Pomodoro focus cycles completed
    const todayTotalCycles = useMemo(() => {
        const completedCount = (todayChat?.completedTasks || []).reduce((sum, t) => sum + (t.completedCycles || 0), 0);
        const activeCount = currentActiveTask?.completedCycles || 0;
        return completedCount + activeCount;
    }, [todayChat?.completedTasks, currentActiveTask?.completedCycles]);

    // Dynamic Reflection Prompt based on Persona
    const reflectionPrompt = useMemo(() => {
        const pId = preferences?.persona || 'friend';
        if (pId === 'monk') {
            const prompts = [
                "Take a deep, slow breath. Notice what thoughts are gently flowing in your mind.",
                "Observe the quiet. What is one subtle thing in your surroundings you are grateful for?",
                "Inhale peace, exhale tension. Let go of the task for a moment. How does your body feel?"
            ];
            return prompts[Math.floor(Math.random() * prompts.length)];
        } else if (pId === 'disciplinist') {
            const prompts = [
                "Rate your intensity check: Did you maintain absolute focus, or did you stray?",
                "Zero soft excuses. Rate your execution from 1-10 on this cycle.",
                "Review your focus. Identify the exact moment you felt distracted, and banish it next cycle."
            ];
            return prompts[Math.floor(Math.random() * prompts.length)];
        } else {
            const prompts = [
                "Great work, proud of you! How did that feel? Ready to stretch your legs?",
                "Awesome cycle! Stand up, walk around, and grab a cold glass of water.",
                "Fantastic focus! Give yourself a high-five, relax your shoulders, and breathe."
            ];
            return prompts[Math.floor(Math.random() * prompts.length)];
        }
    }, [preferences?.persona]);

    // Sync focus duration state with updated settings
    useEffect(() => {
        if (pomoSettings?.focusMins) {
            setDurationMins(pomoSettings.focusMins);
        }
    }, [pomoSettings?.focusMins]);

    // Synthesize Ambient Focus Audio (Pink Noise or Binaural Beats)
    useEffect(() => {
        const isRunning = currentActiveTask?.status === 'RUNNING' && !breakActive;
        if (isRunning) {
            startAmbientSound();
        } else {
            stopAmbientSound();
        }
        return () => {
            stopAmbientSound();
        };
    }, [currentActiveTask?.status, breakActive, pomoSettings.ambientSound, pomoSettings.soundVolume, startAmbientSound, stopAmbientSound]);

    const handleEndBreak = useCallback(() => {
        setBreakActive(false);
        setShowFinishedOptions(false);
        setPomodoroFinishedHandled(false);

        if (!currentActiveTask) return;

        const nowTime = Date.now();
        const nextActiveTasks = (todayChat?.activeTasks || []).map(t => {
            if (t.id === currentActiveTask.id) {
                return {
                    ...t,
                    sessionState: 'FOCUS' as const,
                    status: 'RUNNING' as const,
                    startTime: nowTime,
                    lastStartedAt: nowTime,
                    totalActiveTime: 0,
                    totalPausedTime: 0
                };
            }
            return t;
        });

        setLocalChat(activeDay, { activeTasks: nextActiveTasks });
        cloudStorage.saveChat(activeDay, { activeTasks: nextActiveTasks }, user?.id || undefined, true).catch(err => {
            console.warn('Background cloud save failed:', err);
        });
    }, [currentActiveTask, todayChat?.activeTasks, setLocalChat, activeDay, user?.id]);

    // Track active day time tick and request notifications permission on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        }
    }, []);



    // Time ticker for active session and break countdown
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
            
            // Handle break timer tick down
            if (breakActive && !breakPaused) {
                setBreakTimeRemaining(prev => {
                    if (prev <= 1000) {
                        playPersonaSound('break-end', pomoSettings.soundType, preferences?.persona || 'friend', pomoSettings.soundVolume);
                        sendBrowserNotification("Break Over!", "Time to focus and crush your goals.");
                        handleEndBreak();
                        return 0;
                    }
                    return prev - 1000;
                });
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [breakActive, breakPaused, currentActiveTask, todayChat, handleEndBreak, pomoSettings.soundType, pomoSettings.soundVolume, preferences?.persona]);

    // Sync video play/pause
    useEffect(() => {
        if (!videoRef.current) return;
        if (currentActiveTask?.status === 'RUNNING') {
            videoRef.current.play().catch(e => console.log('Video play interrupted:', e));
        } else {
            videoRef.current.pause();
        }
    }, [currentActiveTask?.status, preferences?.persona]);

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
            duration: targetDurationMs,
            completedCycles: 0,
            sessionState: 'FOCUS'
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

    const handleToggleTask = useCallback(() => {
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
    }, [currentActiveTask, todayChat?.activeTasks, setLocalChat, activeDay, user?.id]);

    const handleFinishTask = async () => {
        if (!currentActiveTask) return;
        const timestamp = Date.now();
        const finalActiveTime = (currentActiveTask.accumulatedActiveTime || 0) + (
            currentActiveTask.status === 'RUNNING'
                ? (currentActiveTask.totalActiveTime || 0) + Math.max(0, timestamp - (currentActiveTask.lastStartedAt || currentActiveTask.startTime || timestamp))
                : (currentActiveTask.totalActiveTime || 0)
        );
        const finalPausedTime = (currentActiveTask.accumulatedPausedTime || 0) + (
            currentActiveTask.status === 'PAUSED'
                ? (currentActiveTask.totalPausedTime || 0) + Math.max(0, timestamp - (currentActiveTask.lastPausedAt || currentActiveTask.startTime || timestamp))
                : (currentActiveTask.totalPausedTime || 0)
        );

        const remaining = (todayChat?.activeTasks || []).filter(t => t.id !== currentActiveTask.id);
        const updatedCompleted = [
            ...(todayChat?.completedTasks || []),
            {
                name: currentActiveTask.name,
                activeTime: finalActiveTime,
                pausedTime: finalPausedTime,
                finishedAt: timestamp,
                abandonmentReason: '',
                notes: currentActiveTask.notes || [],
                completedCycles: currentActiveTask.completedCycles || 0
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
            pausedTime: finalPausedTime,
            completedCycles: currentActiveTask.completedCycles || 0
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
                notes: currentActiveTask.notes || [],
                completedCycles: currentActiveTask.completedCycles || 0
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

    // Handle starting a break session
    const handleStartBreak = useCallback((mins: number) => {
        if (!currentActiveTask) return;
        
        const nextActiveTasks = (todayChat?.activeTasks || []).map(t => {
            if (t.id === currentActiveTask.id) {
                return {
                    ...t,
                    sessionState: 'BREAK' as const,
                    status: 'PAUSED' as const,
                    lastPausedAt: Date.now()
                };
            }
            return t;
        });
        
        setLocalChat(activeDay, { activeTasks: nextActiveTasks });
        cloudStorage.saveChat(activeDay, { activeTasks: nextActiveTasks }, user?.id || undefined, true).catch(err => {
            console.warn('Background cloud save failed:', err);
        });

        // Launch break view states
        setBreakTotalDuration(mins * 60 * 1000);
        setBreakTimeRemaining(mins * 60 * 1000);
        setBreakActive(true);
        setBreakPaused(false);
        setShowFinishedOptions(false);
    }, [currentActiveTask, todayChat?.activeTasks, setLocalChat, activeDay, user?.id]);

    const handleFocusCycleFinished = useCallback(() => {
        if (!currentActiveTask) return;
        
        const nowTime = Date.now();
        const cycleActiveTime = currentActiveTask.status === 'RUNNING'
            ? (currentActiveTask.totalActiveTime || 0) + Math.max(0, nowTime - (currentActiveTask.lastStartedAt || currentActiveTask.startTime || nowTime))
            : (currentActiveTask.totalActiveTime || 0);
        const cyclePausedTime = currentActiveTask.status === 'PAUSED'
            ? (currentActiveTask.totalPausedTime || 0) + Math.max(0, nowTime - (currentActiveTask.lastPausedAt || currentActiveTask.startTime || nowTime))
            : (currentActiveTask.totalPausedTime || 0);

        const nextActiveTasks = (todayChat?.activeTasks || []).map(t => {
            if (t.id === currentActiveTask.id) {
                return {
                    ...t,
                    completedCycles: (t.completedCycles || 0) + 1,
                    accumulatedActiveTime: (t.accumulatedActiveTime || 0) + cycleActiveTime,
                    accumulatedPausedTime: (t.accumulatedPausedTime || 0) + cyclePausedTime,
                    // Reset focus timer details for the next cycle
                    startTime: nowTime,
                    lastStartedAt: nowTime,
                    totalActiveTime: 0,
                    totalPausedTime: 0,
                    status: 'PAUSED' as const,
                    lastPausedAt: nowTime
                };
            }
            return t;
        });
        
        setLocalChat(activeDay, { activeTasks: nextActiveTasks });
        cloudStorage.saveChat(activeDay, { activeTasks: nextActiveTasks }, user?.id || undefined, true).catch(err => {
            console.warn('Background cloud save failed:', err);
        });

        setPomodoroFinishedHandled(true);
        playPersonaSound('success', pomoSettings.soundType, preferences?.persona || 'friend', pomoSettings.soundVolume);
        sendBrowserNotification("Focus Cycle Complete!", `"${currentActiveTask.name.split(' - ')[1] || currentActiveTask.name}" focus session has finished. Time for a break?`);

        if (pomoSettings.autoStartBreaks) {
            const nextCycleNum = (currentActiveTask.completedCycles || 0) + 1;
            const isLongBreak = nextCycleNum % pomoSettings.longBreakInterval === 0;
            const breakMins = isLongBreak ? pomoSettings.longBreakMins : pomoSettings.shortBreakMins;
            handleStartBreak(breakMins);
        } else {
            setShowFinishedOptions(true);
        }
    }, [currentActiveTask, todayChat?.activeTasks, setLocalChat, activeDay, user?.id, pomoSettings.soundType, preferences?.persona, pomoSettings.soundVolume, pomoSettings.autoStartBreaks, pomoSettings.longBreakInterval, pomoSettings.longBreakMins, pomoSettings.shortBreakMins, handleStartBreak]);

    // Auto-detect when the Pomodoro timer finishes to trigger notifications and choice options
    useEffect(() => {
        if (!currentActiveTask || pomodoroFinishedHandled) return;
        if (currentActiveTask.status !== 'RUNNING') return;
        if (currentActiveTask.sessionState === 'BREAK') return;
        
        const duration = currentActiveTask.duration;
        if (!duration || duration === 0) return;

        const activeTime = (currentActiveTask.totalActiveTime || 0) + Math.max(0, now - (currentActiveTask.lastStartedAt || currentActiveTask.startTime || now));
        
        if (activeTime >= duration) {
            handleFocusCycleFinished();
        }
    }, [now, currentActiveTask, pomodoroFinishedHandled, handleFocusCycleFinished]);

    // Handle extending the current session
    const handleExtendSession = (mins: number) => {
        if (!currentActiveTask) return;
        const targetDuration = (currentActiveTask.duration || 0) + (mins * 60 * 1000);
        
        const nextActiveTasks = (todayChat?.activeTasks || []).map(t => {
            if (t.id === currentActiveTask.id) {
                return {
                    ...t,
                    duration: targetDuration
                };
            }
            return t;
        });

        setLocalChat(activeDay, { activeTasks: nextActiveTasks });
        cloudStorage.saveChat(activeDay, { activeTasks: nextActiveTasks }, user?.id || undefined, true).catch(err => {
            console.warn('Background cloud save failed:', err);
        });

        setPomodoroFinishedHandled(false);
        setShowFinishedOptions(false);
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

    // Dynamically update document title to show focus or break timer in browser tab
    useEffect(() => {
        if (typeof document === 'undefined') return;

        if (breakActive) {
            const minutes = Math.floor(breakTimeRemaining / 60000);
            const seconds = Math.floor((breakTimeRemaining % 60000) / 1000);
            const breakTimeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            document.title = `☕ (${breakTimeStr}) Disciplinist`;
        } else if (currentActiveTask && timerStats) {
            document.title = `⏱️ (${timerStats.mainTimerString}) Disciplinist`;
        } else {
            document.title = 'Disciplinist';
        }
    }, [breakActive, breakTimeRemaining, currentActiveTask, timerStats]);

    useEffect(() => {
        return () => {
            if (typeof document !== 'undefined') {
                document.title = 'Disciplinist';
            }
        };
    }, []);

    // Automatic spacebar play/pause trigger
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.key === ' ') {
                // Ignore if currently focused inside a text input or textarea
                if (
                    typeof document !== 'undefined' &&
                    (document.activeElement?.tagName === 'INPUT' ||
                     document.activeElement?.tagName === 'TEXTAREA')
                ) {
                    return;
                }

                // Prevent page scroll when space bar is pressed
                e.preventDefault();

                if (breakActive) {
                    setBreakPaused(prev => !prev);
                } else if (currentActiveTask) {
                    handleToggleTask();
                }
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('keydown', handleKeyDown);
            }
        };
    }, [breakActive, currentActiveTask, todayChat, handleToggleTask]);

    return (
        <main className="chat-page">
            <div className={`bg-mesh${breakActive ? ' bg-mesh--break' : ''}`}></div>

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
                        {/* Premium Stats Indicator Bar */}
                        <div style={{
                            display: 'flex', justifyContent: 'center', marginBottom: '2.5rem',
                            animation: 'fadeIn 0.6s ease-out'
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '14px',
                                padding: '10px 24px', borderRadius: '100px',
                                background: 'rgba(212, 160, 23, 0.04)',
                                border: '1px solid rgba(212, 160, 23, 0.15)',
                                backdropFilter: 'blur(12px)',
                                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
                                transition: 'all 0.3s ease'
                            }}>
                                <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 6px rgba(212,160,23,0.6))' }}>⚡</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: '850', color: 'rgba(255, 255, 255, 0.75)', letterSpacing: '0.08em' }}>
                                    TODAY&apos;S PROGRESS:
                                </span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '950', color: '#d4a017', background: 'rgba(212, 160, 23, 0.14)', padding: '3px 12px', borderRadius: '100px', border: '1px solid rgba(212, 160, 23, 0.25)', textShadow: '0 0 8px rgba(212,160,23,0.3)' }}>
                                    {todayTotalCycles} Focus Cycle{todayTotalCycles !== 1 ? 's' : ''} Completed
                                </span>
                            </div>
                        </div>

                        {breakActive ? (
                            /* Soothing Break Dashboard View */
                            <div className="active-running-dashboard active-running-dashboard--break" style={{ position: 'relative', width: '100%' }}>
                                <div className="active-running-title-block">
                                    <div className="active-running-goal" style={{ color: '#10b981', letterSpacing: '0.3em' }}>
                                        ☕ RECHARGE & RECOVER
                                    </div>
                                    <h2 className="active-running-task" style={{ textShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>
                                        {breakPaused ? 'Break Paused' : 'Taking a Relaxing Break'}
                                    </h2>
                                </div>

                                <div className="active-running-quotes-row" style={{ minHeight: '120px', margin: '2rem 0' }}>
                                    <div className="quote-flank left" style={{ opacity: 0.85, textAlign: 'center', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
                                        <p className="quote-flank-text" style={{ fontSize: '1rem', fontStyle: 'italic', lineHeight: '1.5' }}>
                                            &ldquo;Rest is not idleness, and to lie sometimes on the grass under trees on a summer&apos;s day, listening to the murmur of the water, or watching the clouds float across the sky, is by no means a waste of time.&rdquo;
                                        </p>
                                        <span className="quote-flank-author" style={{ fontSize: '0.65rem', marginTop: '8px', display: 'block' }}>&mdash; Sir John Lubbock</span>
                                    </div>
                                </div>

                                <div className="timer-progress-block" style={{ width: '100%', maxWidth: '680px' }}>
                                    {/* Glowing Progress/Loading Bar */}
                                    <div className="timer-loading-bar-bg" style={{ borderColor: 'rgba(16, 185, 129, 0.1)', overflow: 'hidden' }}>
                                        <div 
                                            className="timer-loading-bar-fill"
                                            style={{ 
                                                width: `${Math.min(100, ((breakTotalDuration - breakTimeRemaining) / breakTotalDuration) * 100)}%`,
                                                background: 'linear-gradient(90deg, #34d399, #10b981)',
                                                boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
                                            }}
                                        ></div>
                                    </div>

                                    <div className="timer-numbers" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 4px', margin: '12px 0 6px 0' }}>
                                        <span className="timer-elapsed" style={{ fontSize: '3rem', fontWeight: '950', fontFamily: 'monospace', letterSpacing: '-0.02em', color: '#10b981' }}>
                                            {`${String(Math.floor(breakTimeRemaining / 60000)).padStart(2, '0')}:${String(Math.floor((breakTimeRemaining % 60000) / 1000)).padStart(2, '0')}`}
                                        </span>
                                        <span className="timer-total" style={{ fontSize: '0.7rem', fontWeight: '900', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                                            TOTAL BREAK: {Math.round(breakTotalDuration / 60000)} MINS
                                        </span>
                                    </div>

                                    {/* Mission detail on break page */}
                                    {currentActiveTask && (
                                        <div style={{
                                            marginTop: '1.25rem', padding: '14px 20px', borderRadius: '18px',
                                            background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                                        }}>
                                            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '800', letterSpacing: '0.05em' }}>ON DECK:</span>
                                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>{currentActiveTask.name}</span>
                                            <span style={{
                                                fontSize: '0.65rem', padding: '2px 10px', borderRadius: '100px',
                                                background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontWeight: '900',
                                                border: '1px solid rgba(16, 185, 129, 0.25)', letterSpacing: '0.02em'
                                            }}>
                                                CYCLE #{ (currentActiveTask.completedCycles || 0) + 1 } NEXT
                                            </span>
                                        </div>
                                    )}

                                    {/* Soothing Controls */}
                                    <div className="timer-controls-row" style={{ marginTop: '1.5rem' }}>
                                        <button 
                                            type="button"
                                            className="timer-btn-pause"
                                            onClick={() => setBreakPaused(!breakPaused)}
                                        >
                                            {breakPaused ? 'RESUME BREAK' : 'PAUSE BREAK'}
                                        </button>
                                        <button 
                                            type="button"
                                            className="timer-btn-finish"
                                            onClick={handleEndBreak}
                                            style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                                        >
                                            SKIP BREAK (BACK TO WORK)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : !currentActiveTask ? (
                            /* Setup Form View */
                             <form onSubmit={(e) => { e.preventDefault(); handleStartTask(); }} className="active-task-setup-card">
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '1.5rem', letterSpacing: '0.05em', textAlign: 'center', color: 'white' }}>LAUNCH ACTIVE MISSION</h2>
                                
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', marginBottom: '1.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                                        style={{
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                            color: 'white', padding: '8px 16px', borderRadius: '100px', fontSize: '0.75rem',
                                            fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                            letterSpacing: '0.05em', transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showSettingsPanel ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s ease' }}>
                                            <circle cx="12" cy="12" r="3"></circle>
                                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                        </svg>
                                        {showSettingsPanel ? 'CLOSE SETTINGS' : 'POMODORO SETTINGS'}
                                    </button>
                                </div>

                                {showSettingsPanel && (
                                    <div style={{
                                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '20px', padding: '1.5rem', marginBottom: '2.5rem',
                                        display: 'flex', flexDirection: 'column', gap: '1.25rem'
                                    }}>
                                        <div>
                                            <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white', marginBottom: '10px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Focus Blueprint</h3>
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                                {[
                                                    { id: 'classic', label: '⏳ Classic Pomo (25m)', desc: '25m Focus / 5m Break' },
                                                    { id: 'monk', label: '🧘 Monk Sprint (50m)', desc: '50m Focus / 10m Break' },
                                                    { id: 'ultra', label: '⚡ Ultra-Focus (90m)', desc: '90m Focus / 15m Break' },
                                                    { id: 'custom', label: '⚙️ Custom', desc: 'Personalized times' }
                                                ].map(bp => {
                                                    const active = pomoSettings.activeBlueprint === bp.id;
                                                    return (
                                                        <button
                                                            key={bp.id}
                                                            type="button"
                                                            onClick={() => {
                                                                let focus = pomoSettings.focusMins;
                                                                let short = pomoSettings.shortBreakMins;
                                                                let long = pomoSettings.longBreakMins;
                                                                if (bp.id === 'classic') { focus = 25; short = 5; long = 15; }
                                                                else if (bp.id === 'monk') { focus = 50; short = 10; long = 20; }
                                                                else if (bp.id === 'ultra') { focus = 90; short = 15; long = 30; }
                                                                
                                                                updatePreferences({
                                                                    pomodoroSettings: {
                                                                        ...pomoSettings,
                                                                        activeBlueprint: bp.id as 'classic' | 'monk' | 'ultra' | 'custom',
                                                                        focusMins: focus,
                                                                        shortBreakMins: short,
                                                                        longBreakMins: long
                                                                    }
                                                                });
                                                            }}
                                                            style={{
                                                                flex: '1 1 180px', padding: '10px 12px', borderRadius: '12px', textAlign: 'left',
                                                                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                                                                background: active ? '#d4a017' : 'rgba(255,255,255,0.03)',
                                                                color: active ? 'black' : 'rgba(255,255,255,0.7)',
                                                                transition: '0.2s ease'
                                                            }}
                                                        >
                                                            <div style={{ fontWeight: '900', fontSize: '0.7rem', marginBottom: '2px' }}>{bp.label}</div>
                                                            <div style={{ fontSize: '0.6rem', opacity: active ? 0.8 : 0.5 }}>{bp.desc}</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                                            <div>
                                                <label style={{ fontSize: '0.6rem', fontWeight: '900', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>FOCUS MINS</label>
                                                <input
                                                    type="number"
                                                    min="1" max="480"
                                                    value={pomoSettings.focusMins}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 25;
                                                        updatePreferences({
                                                            pomodoroSettings: { ...pomoSettings, focusMins: val, activeBlueprint: 'custom' }
                                                        });
                                                    }}
                                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 10px', borderRadius: '10px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.6rem', fontWeight: '900', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>SHORT BREAK</label>
                                                <input
                                                    type="number"
                                                    min="1" max="120"
                                                    value={pomoSettings.shortBreakMins}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 5;
                                                        updatePreferences({
                                                            pomodoroSettings: { ...pomoSettings, shortBreakMins: val, activeBlueprint: 'custom' }
                                                        });
                                                    }}
                                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 10px', borderRadius: '10px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.6rem', fontWeight: '900', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>LONG BREAK</label>
                                                <input
                                                    type="number"
                                                    min="1" max="240"
                                                    value={pomoSettings.longBreakMins}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 15;
                                                        updatePreferences({
                                                            pomodoroSettings: { ...pomoSettings, longBreakMins: val, activeBlueprint: 'custom' }
                                                        });
                                                    }}
                                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 10px', borderRadius: '10px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.6rem', fontWeight: '900', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>LONG INTERVAL</label>
                                                <input
                                                    type="number"
                                                    min="1" max="20"
                                                    value={pomoSettings.longBreakInterval}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 4;
                                                        updatePreferences({
                                                            pomodoroSettings: { ...pomoSettings, longBreakInterval: val }
                                                        });
                                                    }}
                                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 10px', borderRadius: '10px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                                            <div>
                                                <h4 style={{ fontSize: '0.7rem', fontWeight: '900', color: 'white', marginBottom: '6px', letterSpacing: '0.05em' }}>ALARM AUDIO</h4>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {[
                                                        { id: 'persona', label: 'AI Mentor ⚡' },
                                                        { id: 'chime', label: 'Chime' },
                                                        { id: 'silent', label: 'Silent' }
                                                    ].map(t => (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => updatePreferences({ pomodoroSettings: { ...pomoSettings, soundType: t.id as 'persona' | 'chime' | 'silent' } })}
                                                            style={{
                                                                flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
                                                                background: pomoSettings.soundType === t.id ? '#d4a017' : 'rgba(255,255,255,0.03)',
                                                                color: pomoSettings.soundType === t.id ? 'black' : 'rgba(255,255,255,0.6)',
                                                                fontWeight: 'bold', fontSize: '0.65rem', cursor: 'pointer', transition: '0.2s'
                                                            }}
                                                        >
                                                            {t.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div style={{ marginTop: '10px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                                                        <span>VOLUME</span>
                                                        <span>{pomoSettings.soundVolume}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="100"
                                                        value={pomoSettings.soundVolume}
                                                        onChange={(e) => updatePreferences({ pomodoroSettings: { ...pomoSettings, soundVolume: parseInt(e.target.value) || 50 } })}
                                                        style={{ width: '100%', accentColor: '#d4a017', cursor: 'pointer' }}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <h4 style={{ fontSize: '0.7rem', fontWeight: '900', color: 'white', marginBottom: '6px', letterSpacing: '0.05em' }}>FOCUS BACKGROUND SOUND</h4>
                                                <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                                                    {[
                                                        { id: 'none', label: 'None' },
                                                        { id: 'pink_noise', label: 'Pink Noise' },
                                                        { id: 'binaural_beats', label: 'Binaural Beats (Alpha 10Hz)' }
                                                    ].map(t => (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => updatePreferences({ pomodoroSettings: { ...pomoSettings, ambientSound: t.id as 'none' | 'pink_noise' | 'binaural_beats' } })}
                                                            style={{
                                                                padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left',
                                                                background: pomoSettings.ambientSound === t.id ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                                                                color: pomoSettings.ambientSound === t.id ? '#10b981' : 'rgba(255,255,255,0.6)',
                                                                borderColor: pomoSettings.ambientSound === t.id ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)',
                                                                fontWeight: 'bold', fontSize: '0.65rem', cursor: 'pointer', transition: '0.2s'
                                                            }}
                                                        >
                                                            {t.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.7)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={pomoSettings.autoStartBreaks}
                                                    onChange={(e) => updatePreferences({ pomodoroSettings: { ...pomoSettings, autoStartBreaks: e.target.checked } })}
                                                    style={{ accentColor: '#d4a017', width: '14px', height: '14px' }}
                                                />
                                                AUTO-START BREAKS
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.7)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={pomoSettings.autoStartFocus}
                                                    onChange={(e) => updatePreferences({ pomodoroSettings: { ...pomoSettings, autoStartFocus: e.target.checked } })}
                                                    style={{ accentColor: '#d4a017', width: '14px', height: '14px' }}
                                                />
                                                AUTO-START NEXT FOCUS CYCLE
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.7)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={pomoSettings.useReflectionPrompts}
                                                    onChange={(e) => updatePreferences({ pomodoroSettings: { ...pomoSettings, useReflectionPrompts: e.target.checked } })}
                                                    style={{ accentColor: '#d4a017', width: '14px', height: '14px' }}
                                                />
                                                ENABLE PERSONA REFLECTION PROMPTS
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <div className="active-task-form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label className="active-task-form-label">Goal / Category</label>
                                        {filteredGoals.length > 0 && (
                                            <button 
                                                type="button" 
                                                className="suggestion-toggle-btn"
                                                onClick={() => setExpandGoals(!expandGoals)}
                                            >
                                                {expandGoals ? 'Show Less' : `See All (${filteredGoals.length})`}
                                            </button>
                                        )}
                                    </div>
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
                                        <div 
                                            ref={goalsContainerRef}
                                            className={`suggestion-container${expandGoals ? ' suggestion-container--expanded' : ''}`}
                                        >
                                            {filteredGoals.map(g => {
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label className="active-task-form-label">Specific Task</label>
                                        {filteredTasks.length > 0 && (
                                            <button 
                                                type="button" 
                                                className="suggestion-toggle-btn"
                                                onClick={() => setExpandTasks(!expandTasks)}
                                            >
                                                {expandTasks ? 'Show Less' : `See All (${filteredTasks.length})`}
                                            </button>
                                        )}
                                    </div>
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
                                        <div 
                                            ref={tasksContainerRef}
                                            className={`suggestion-container${expandTasks ? ' suggestion-container--expanded' : ''}`}
                                        >
                                            {filteredTasks.map(s => {
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
                                            {suggestions.filter(s => s.goal.toLowerCase() === goalName.toLowerCase()).length > 0 && filteredTasks.length === 0 && taskName.trim() !== '' && (
                                                <span className="suggestion-hint">No matching registered tasks.</span>
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
                                             onChange={(e) => {
                                                 const val = parseInt(e.target.value) || 25;
                                                 setDurationMins(val);
                                                 updatePreferences({
                                                     pomodoroSettings: {
                                                         ...pomoSettings,
                                                         focusMins: val,
                                                         activeBlueprint: 'custom'
                                                     }
                                                 });
                                             }}
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
                            <div className="active-running-dashboard" style={{ position: 'relative', width: '100%' }}>
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
                                                src={preferences?.persona === 'disciplinist' ? "/video/hardcore.mp4" : "/video/focus-loop.mp4.mp4"}
                                                key={preferences?.persona === 'disciplinist' ? "hardcore" : "focus-loop"}
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
                                                    transform: preferences?.persona === 'disciplinist' ? 'scale(1.2) translate3d(0, 0, 0)' : 'translate3d(0, 0, 0)'
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
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <span className="timer-total" style={{ fontSize: '0.7rem', fontWeight: '900', color: '#d4a017', letterSpacing: '0.1em', opacity: 0.8 }}>
                                                {timerStats?.subtitleString}
                                            </span>
                                            {currentActiveTask.completedCycles !== undefined && (
                                                <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '100px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                    CYCLES COMPLETED: {currentActiveTask.completedCycles}
                                                </span>
                                            )}
                                        </div>
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

                                {showFinishedOptions && (
                                    <div className="session-complete-overlay" style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        background: 'rgba(10, 12, 18, 0.88)', backdropFilter: 'blur(20px)',
                                        zIndex: 500, display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', borderRadius: '35px',
                                        padding: '2.5rem', border: '1px solid rgba(255, 255, 255, 0.08)',
                                        boxShadow: '0 30px 80px rgba(0,0,0,0.8)'
                                    }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(212, 160, 23, 0.15)', border: '1.5px solid #d4a017', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                            <span style={{ fontSize: '1.5rem' }}>🎉</span>
                                        </div>
                                        <h2 style={{ fontSize: '1.75rem', fontWeight: '950', letterSpacing: '0.05em', color: 'white', marginBottom: '0.5rem', textTransform: 'uppercase', textAlign: 'center' }}>MISSION COMPLETE</h2>
                                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: '420px', marginBottom: '2rem', fontWeight: '600', lineHeight: '1.5', background: 'rgba(255,255,255,0.02)', padding: '12px 18px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                            {pomoSettings.useReflectionPrompts ? reflectionPrompt : "Excellent focus. You completed your target time. Ready to rest or extend?"}
                                        </p>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
                                            <button 
                                                type="button"
                                                className="session-complete-btn"
                                                onClick={() => handleStartBreak(pomoSettings.shortBreakMins)}
                                                style={{
                                                    background: '#10b981', color: 'black', fontWeight: '950', border: 'none',
                                                    padding: '14px', borderRadius: '100px', fontSize: '0.85rem', cursor: 'pointer',
                                                    letterSpacing: '0.05em', transition: '0.2s', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)'
                                                }}
                                            >
                                                ☕ TAKE A {pomoSettings.shortBreakMins}M SHORT BREAK
                                            </button>
                                            <button 
                                                type="button"
                                                className="session-complete-btn"
                                                onClick={() => handleStartBreak(pomoSettings.longBreakMins)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: '900', border: '1px solid rgba(255,255,255,0.1)',
                                                    padding: '14px', borderRadius: '100px', fontSize: '0.85rem', cursor: 'pointer',
                                                    letterSpacing: '0.05em', transition: '0.2s'
                                                }}
                                            >
                                                🌴 TAKE A {pomoSettings.longBreakMins}M LONG BREAK
                                            </button>
                                            <button 
                                                type="button"
                                                className="session-complete-btn"
                                                onClick={handleEndBreak}
                                                style={{
                                                    background: 'rgba(212,160,23,0.12)', color: '#d4a017', fontWeight: '950', border: '1px solid rgba(212,160,23,0.3)',
                                                    padding: '14px', borderRadius: '100px', fontSize: '0.85rem', cursor: 'pointer',
                                                    letterSpacing: '0.05em', transition: '0.2s', boxShadow: '0 4px 15px rgba(212, 160, 23, 0.1)'
                                                }}
                                            >
                                                ⏭️ SKIP BREAK & FOCUS AGAIN
                                            </button>
                                            <button 
                                                type="button"
                                                className="session-complete-btn"
                                                onClick={() => handleExtendSession(5)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)', fontWeight: '900', border: '1px solid rgba(255,255,255,0.08)',
                                                    padding: '14px', borderRadius: '100px', fontSize: '0.85rem', cursor: 'pointer',
                                                    letterSpacing: '0.05em', transition: '0.2s'
                                                }}
                                            >
                                                ⏱️ EXTEND FOCUS (+5M)
                                            </button>
                                            <button 
                                                type="button"
                                                className="session-complete-btn"
                                                onClick={handleFinishTask}
                                                style={{
                                                    background: 'transparent', color: 'rgba(255,255,255,0.4)', fontWeight: '800', border: 'none',
                                                    padding: '10px', fontSize: '0.8rem', cursor: 'pointer',
                                                    textDecoration: 'underline', transition: '0.2s'
                                                }}
                                            >
                                                FINISH & LOG SESSION
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <MobileBottomNav />
            </div>
        </main>
    );
}
