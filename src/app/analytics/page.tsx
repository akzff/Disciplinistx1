'use client';

import { useState, useMemo, useEffect } from 'react';
import { TodoHistoryEntry, formatTime } from '@/lib/storage';
import { NavigationBar } from '@/components/NavigationBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useData } from '@/lib/DataContext';
import { useAuthContext } from '@/lib/AuthContext';
import Image from 'next/image';

export default function AnalyticsPage() {
    const { allChats, preferences } = useData();
    const { signOut } = useAuthContext();
    
    // TAB NAVIGATION
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

    // DATE RANGE SELECTION
    const [dateRange, setDateRange] = useState<'7' | '14' | '30' | 'all'>('14');

    // Real-time clock to sync live active tasks
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // CHART VISIBILITY FILTER
    const [chartFilters, setChartFilters] = useState({
        dailies: true,
        todos: true,
        active: true
    });

    const displayName = preferences?.name || 'User';
    const currentPfp = preferences?.pfp;

    // SORTED DATES
    const sortedDates = useMemo(() => Object.keys(allChats).sort(), [allChats]);

    // FILTERED DATES BY RANGE
    const filteredDates = useMemo(() => {
        if (sortedDates.length === 0) return [];
        if (dateRange === 'all') return sortedDates;

        const limit = parseInt(dateRange);
        const latestDateStr = sortedDates[sortedDates.length - 1];
        const latestDate = new Date(latestDateStr);
        const cutOffDate = new Date(latestDate);
        cutOffDate.setDate(cutOffDate.getDate() - limit + 1);
        const cutOffStr = cutOffDate.toISOString().split('T')[0];

        return sortedDates.filter(d => d >= cutOffStr);
    }, [sortedDates, dateRange]);

    // METRICS CALCULATION OVER FILTERED DATES
    const rangeStats = useMemo(() => {
        let totalDailiesAssigned = 0;
        let totalDailiesCompleted = 0;
        let totalTodosCompleted = 0;
        let totalFocusTimeMs = 0;
        let totalActiveMissions = 0;

        filteredDates.forEach(date => {
            const chat = allChats[date];
            if (chat) {
                if (chat.dailies) {
                    totalDailiesAssigned += chat.dailies.length;
                    totalDailiesCompleted += chat.dailies.filter(d => d.completed).length;
                }
                if (chat.todoHistory && Array.isArray(chat.todoHistory)) {
                    chat.todoHistory.forEach(entry => {
                        if (entry.type === 'todo') {
                            totalTodosCompleted++;
                        } else if (entry.type === 'active') {
                            totalActiveMissions++;
                            totalFocusTimeMs += entry.activeTime || 0;
                        }
                    });
                }
                // Include active task in progress time
                if (chat.activeTasks && Array.isArray(chat.activeTasks)) {
                    chat.activeTasks.forEach(task => {
                        let taskActive = (task.accumulatedActiveTime || 0) + (task.totalActiveTime || 0);
                        if (task.status === 'RUNNING') {
                            taskActive += Math.max(0, now - (task.lastStartedAt || task.startTime || now));
                        }
                        if (taskActive > 0) {
                            totalFocusTimeMs += taskActive;
                            totalActiveMissions++;
                        }
                    });
                }
            }
        });

        const dailySuccessRate = totalDailiesAssigned > 0 ? Math.round((totalDailiesCompleted / totalDailiesAssigned) * 100) : 0;
        const daysCount = filteredDates.length || 1;
        
        // Normalization target parameters for Discipline index
        const dailyScore = dailySuccessRate;
        const todoScore = Math.min(100, Math.round((totalTodosCompleted / (daysCount * 1.5)) * 100)); // Target 1.5 todos/day
        const focusHours = totalFocusTimeMs / 3600000;
        const focusScore = Math.min(100, Math.round((focusHours / (daysCount * 1)) * 100)); // Target 1 hr focus/day

        const disciplineIndex = Math.round((dailyScore * 0.4) + (todoScore * 0.3) + (focusScore * 0.3));

        return {
            dailySuccessRate,
            totalDailiesCompleted,
            totalDailiesAssigned,
            totalTodosCompleted,
            totalFocusTimeMs,
            totalActiveMissions,
            disciplineIndex
        };
    }, [allChats, filteredDates, now]);

    // DAY-BY-DAY DATASET FOR INTERACTIVE CHART
    const chartData = useMemo(() => {
        return filteredDates.map(date => {
            const chat = allChats[date];
            let dailiesCompleted = 0;
            let todosCompleted = 0;
            let focusHours = 0;

            if (chat) {
                if (chat.dailies) {
                    dailiesCompleted = chat.dailies.filter(d => d.completed).length;
                }
                if (chat.todoHistory && Array.isArray(chat.todoHistory)) {
                    chat.todoHistory.forEach(entry => {
                        if (entry.type === 'todo') {
                            todosCompleted++;
                        } else if (entry.type === 'active') {
                            focusHours += (entry.activeTime || 0) / 3600000;
                        }
                    });
                }
                // Include active task in progress time
                if (chat.activeTasks && Array.isArray(chat.activeTasks)) {
                    chat.activeTasks.forEach(task => {
                        let taskActive = (task.accumulatedActiveTime || 0) + (task.totalActiveTime || 0);
                        if (task.status === 'RUNNING') {
                            taskActive += Math.max(0, now - (task.lastStartedAt || task.startTime || now));
                        }
                        focusHours += taskActive / 3600000;
                    });
                }
            }

            return {
                date,
                displayDate: date.split('-').slice(1).join('/'), // MM/DD
                dailies: dailiesCompleted,
                todos: todosCompleted,
                focusHours: parseFloat(focusHours.toFixed(1))
            };
        });
    }, [allChats, filteredDates, now]);

    // DETAILED ACTIVE TASK DATA ANALYSIS
    const activeTasksAnalysis = useMemo(() => {
        const goalFocusMap: Record<string, { totalActive: number; totalPaused: number; sessions: number }> = {};
        let grandTotalActive = 0;
        let grandTotalPaused = 0;
        let totalCycles = 0;
        let totalSessionsCount = 0;
        
        const todayStr = new Date().toISOString().split('T')[0];
        const todayChat = allChats[todayStr];
        const currentLiveTask = todayChat?.activeTasks?.find(t => t.status === 'RUNNING' || t.status === 'PAUSED') || null;

        filteredDates.forEach(date => {
            const chat = allChats[date];
            if (!chat) return;

            // 1. Completed active tasks from todoHistory
            if (chat.todoHistory && Array.isArray(chat.todoHistory)) {
                chat.todoHistory.forEach(entry => {
                    if (entry.type === 'active') {
                        const name = entry.text || 'Unknown';
                        const parts = name.split(' - ');
                        const goal = parts[0]?.trim() || 'General';
                        
                        const active = entry.activeTime || 0;
                        const paused = entry.pausedTime || 0;
                        const cycles = entry.completedCycles || 0;

                        if (!goalFocusMap[goal]) {
                            goalFocusMap[goal] = { totalActive: 0, totalPaused: 0, sessions: 0 };
                        }
                        goalFocusMap[goal].totalActive += active;
                        goalFocusMap[goal].totalPaused += paused;
                        goalFocusMap[goal].sessions += 1;

                        grandTotalActive += active;
                        grandTotalPaused += paused;
                        totalCycles += cycles;
                        totalSessionsCount += 1;
                    }
                });
            }

            // 2. In-progress active tasks
            if (chat.activeTasks && Array.isArray(chat.activeTasks)) {
                chat.activeTasks.forEach(task => {
                    let taskActive = (task.accumulatedActiveTime || 0) + (task.totalActiveTime || 0);
                    let taskPaused = (task.accumulatedPausedTime || 0) + (task.totalPausedTime || 0);
                    
                    if (task.status === 'RUNNING') {
                        taskActive += Math.max(0, now - (task.lastStartedAt || task.startTime || now));
                    } else if (task.status === 'PAUSED') {
                        taskPaused += Math.max(0, now - (task.lastPausedAt || task.startTime || now));
                    }

                    if (taskActive > 0 || taskPaused > 0) {
                        const parts = task.name.split(' - ');
                        const goal = parts[0]?.trim() || 'General';

                        if (!goalFocusMap[goal]) {
                            goalFocusMap[goal] = { totalActive: 0, totalPaused: 0, sessions: 0 };
                        }
                        goalFocusMap[goal].totalActive += taskActive;
                        goalFocusMap[goal].totalPaused += taskPaused;
                        goalFocusMap[goal].sessions += 1;

                        grandTotalActive += taskActive;
                        grandTotalPaused += taskPaused;
                        totalCycles += task.completedCycles || 0;
                        totalSessionsCount += 1;
                    }
                });
            }
        });

        const goalStats = Object.entries(goalFocusMap).map(([goal, stats]) => ({
            goal,
            ...stats,
            percentage: grandTotalActive > 0 ? Math.round((stats.totalActive / grandTotalActive) * 100) : 0
        })).sort((a, b) => b.totalActive - a.totalActive);

        const activePercentage = (grandTotalActive + grandTotalPaused) > 0 
            ? Math.round((grandTotalActive / (grandTotalActive + grandTotalPaused)) * 100) 
            : 100;

        const averageSessionMs = totalSessionsCount > 0 ? grandTotalActive / totalSessionsCount : 0;

        return {
            goalStats,
            grandTotalActive,
            grandTotalPaused,
            totalCycles,
            totalSessionsCount,
            activePercentage,
            averageSessionMs,
            currentLiveTask
        };
    }, [allChats, filteredDates, now]);



    // DEDUPLICATED MISSION LOG HISTORY
    const fullTodoHistory = useMemo(() => {
        const history: (TodoHistoryEntry & { chatDate: string })[] = [];
        const seenKeys = new Set<string>();

        Object.keys(allChats).sort().reverse().forEach(date => {
            const chat = allChats[date];
            if (chat.todoHistory && Array.isArray(chat.todoHistory)) {
                chat.todoHistory.forEach((entry: TodoHistoryEntry) => {
                    // Create a robust composite key using all fallback details to filter duplicate uploads
                    const key = entry.id 
                        ? `${entry.id}` 
                        : `${entry.todoId || entry.text}-${entry.tickedAt}`;

                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        history.push({ ...entry, chatDate: date });
                    }
                });
            }
        });

        // Sort by tickedAt descending
        return history.sort((a, b) => b.tickedAt - a.tickedAt);
    }, [allChats]);

    // DYNAMIC SVG CHART DIMENSION CALCULATIONS
    const svgWidth = 800;
    const svgHeight = 240;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    const chartPoints = useMemo(() => {
        if (chartData.length === 0) return null;

        const maxDailies = Math.max(...chartData.map(d => d.dailies), 4);
        const maxTodos = Math.max(...chartData.map(d => d.todos), 4);
        const maxHours = Math.max(...chartData.map(d => d.focusHours), 4);

        const innerWidth = svgWidth - paddingLeft - paddingRight;
        const innerHeight = svgHeight - paddingTop - paddingBottom;

        return chartData.map((d, index) => {
            const x = paddingLeft + (chartData.length > 1 ? (index / (chartData.length - 1)) * innerWidth : innerWidth / 2);
            
            // Map values to Y coordinates (inverted since SVG 0 is top)
            const yDailies = paddingTop + innerHeight - (d.dailies / maxDailies) * innerHeight;
            const yTodos = paddingTop + innerHeight - (d.todos / maxTodos) * innerHeight;
            const yFocus = paddingTop + innerHeight - (d.focusHours / maxHours) * innerHeight;

            return {
                x,
                yDailies,
                yTodos,
                yFocus,
                ...d
            };
        });
    }, [chartData]);

    return (
        <main className="chat-page">
            <div className="bg-mesh"></div>

            <div className="chat-container">
                <header className="chat-header">
                    <div className="chat-header__left" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div
                            className="status-indicator"
                            style={{
                                '--mood-color': '#d4a017'
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
                                        style={{ borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #d4a017', flexShrink: 0 }}
                                    />
                                ) : (
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #d4a017, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '900', boxShadow: '0 2px 10px rgba(212, 160, 23, 0.3)' }}>
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

                <div style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

                        {/* PREMIUM CONTROLS GRID */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                            {/* TABS */}
                            <div style={{ display: 'flex', gap: '2rem' }}>
                                <button 
                                    onClick={() => setActiveTab('overview')}
                                    style={{ padding: '1rem 0', background: 'none', border: 'none', color: activeTab === 'overview' ? '#d4a017' : 'rgba(255,255,255,0.3)', fontWeight: '900', fontSize: '0.8rem', letterSpacing: '0.2em', cursor: 'pointer', borderBottom: activeTab === 'overview' ? '2.5px solid #d4a017' : '2.5px solid transparent', transition: 'all 0.3s' }}
                                >
                                    OVERVIEW
                                </button>

                                <button 
                                    onClick={() => setActiveTab('history')}
                                    style={{ padding: '1rem 0', background: 'none', border: 'none', color: activeTab === 'history' ? '#d4a017' : 'rgba(255,255,255,0.3)', fontWeight: '900', fontSize: '0.8rem', letterSpacing: '0.2em', cursor: 'pointer', borderBottom: activeTab === 'history' ? '2.5px solid #d4a017' : '2.5px solid transparent', transition: 'all 0.3s' }}
                                >
                                    MISSION LOG
                                </button>
                            </div>

                            {/* DATE RANGE SEGMENT CONTROL */}
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '10px' }}>
                                {[
                                    { id: '7', label: '7 DAYS' },
                                    { id: '14', label: '14 DAYS' },
                                    { id: '30', label: '30 DAYS' },
                                    { id: 'all', label: 'ALL TIME' }
                                ].map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => setDateRange(r.id as '7' | '14' | '30' | 'all')}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: '800',
                                            fontSize: '0.65rem',
                                            background: dateRange === r.id ? '#d4a017' : 'transparent',
                                            color: dateRange === r.id ? 'black' : 'rgba(255,255,255,0.6)',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            letterSpacing: '0.05em'
                                        }}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* --- TAB 1: OVERVIEW --- */}
                        {activeTab === 'overview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                                
                                {/* DISCIPLINE INDEX & PERFORMANCE OVERVIEW GRID */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                                    
                                    {/* Discipline Score Dial */}
                                    <div className="block-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: '1rem', left: '1.5rem' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '900', letterSpacing: '0.15em', opacity: 0.3 }}>RELIABILITY RATIO</span>
                                        </div>
                                        <div style={{ width: '160px', height: '160px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
                                            <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                                                <circle 
                                                    cx="50" 
                                                    cy="50" 
                                                    r="42" 
                                                    fill="none" 
                                                    stroke="url(#goldGradient)" 
                                                    strokeWidth="6.5" 
                                                    strokeDasharray="264"
                                                    strokeDashoffset={264 - (264 * rangeStats.disciplineIndex) / 100}
                                                    strokeLinecap="round"
                                                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                                                />
                                                <defs>
                                                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#d4a017" />
                                                        <stop offset="100%" stopColor="#10b981" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <span style={{ fontSize: '2.2rem', fontWeight: '950', color: 'white', lineHeight: 1 }}>{rangeStats.disciplineIndex}</span>
                                                <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#d4a017', opacity: 0.8, letterSpacing: '0.05em', marginTop: '4px' }}>DISCIPLINE INDEX</span>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.4, textAlign: 'center', marginTop: '1.5rem', maxWidth: '85%' }}>
                                            Weighted indicator matching Daily rites completed (40%), To-dos finished (30%), and Focus time (30%).
                                        </p>
                                    </div>

                                    {/* Stats Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div className="stat-card-deep" style={{ borderLeft: '4px solid #10b981' }}>
                                            <p style={{ fontSize: '0.65rem', fontWeight: '900', color: '#10b981', opacity: 0.8, letterSpacing: '0.05em' }}>DAILY RITES</p>
                                            <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', margin: '4px 0' }}>{rangeStats.dailySuccessRate}%</h2>
                                            <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>{rangeStats.totalDailiesCompleted} of {rangeStats.totalDailiesAssigned} synced</p>
                                        </div>

                                        <div className="stat-card-deep" style={{ borderLeft: '4px solid #8b5cf6' }}>
                                            <p style={{ fontSize: '0.65rem', fontWeight: '900', color: '#8b5cf6', opacity: 0.8, letterSpacing: '0.05em' }}>TASKS CLEARED</p>
                                            <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', margin: '4px 0' }}>{rangeStats.totalTodosCompleted}</h2>
                                            <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>One-offs ticked off</p>
                                        </div>

                                        <div className="stat-card-deep" style={{ borderLeft: '4px solid #d4a017', gridColumn: 'span 2' }}>
                                            <p style={{ fontSize: '0.65rem', fontWeight: '900', color: '#d4a017', opacity: 0.8, letterSpacing: '0.05em' }}>FOCUSED SESSION TIME</p>
                                            <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', margin: '4px 0' }}>
                                                {formatTime(rangeStats.totalFocusTimeMs, false)}
                                            </h2>
                                            <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>Accumulated over {rangeStats.totalActiveMissions} live focus slots</p>
                                        </div>
                                    </div>
                                </div>

                                {/* LIVE ACTIVE TASK ALERT CARD */}
                                {activeTasksAnalysis.currentLiveTask && (
                                    <div className="block-card" style={{
                                        padding: '1.5rem 2rem',
                                        background: 'linear-gradient(135deg, rgba(212, 160, 23, 0.08), rgba(16, 185, 129, 0.03))',
                                        border: '1.5px solid rgba(212, 160, 23, 0.3)',
                                        borderRadius: '24px',
                                        boxShadow: '0 8px 32px 0 rgba(212, 160, 23, 0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '1rem',
                                        animation: 'fadeIn 0.5s ease-out'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    borderRadius: '50%',
                                                    backgroundColor: activeTasksAnalysis.currentLiveTask.status === 'RUNNING' ? '#10b981' : '#f59e0b',
                                                    animation: activeTasksAnalysis.currentLiveTask.status === 'RUNNING' ? 'pulse 2s infinite' : 'none'
                                                }} />
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '0.55rem', fontWeight: '900', letterSpacing: '0.2em', color: '#d4a017' }}>
                                                    {activeTasksAnalysis.currentLiveTask.status === 'RUNNING' ? 'LIVE FOCUS SESSION' : 'LIVE FOCUS PAUSED'}
                                                </span>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '850', color: 'white', margin: '4px 0 0 0' }}>
                                                    {activeTasksAnalysis.currentLiveTask.name}
                                                </h4>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontSize: '0.55rem', fontWeight: '900', opacity: 0.4, letterSpacing: '0.1em' }}>ELAPSED</span>
                                                <p style={{ fontSize: '1.1rem', fontWeight: '900', color: 'white', margin: 0 }}>
                                                    {(() => {
                                                        const task = activeTasksAnalysis.currentLiveTask;
                                                        let taskActive = (task.accumulatedActiveTime || 0) + (task.totalActiveTime || 0);
                                                        if (task.status === 'RUNNING') {
                                                            taskActive += Math.max(0, now - (task.lastStartedAt || task.startTime || now));
                                                        }
                                                        return formatTime(taskActive, true);
                                                    })()}
                                                </p>
                                            </div>
                                            <a href="/active-task" style={{
                                                padding: '10px 20px',
                                                background: '#d4a017',
                                                border: 'none',
                                                borderRadius: '100px',
                                                color: 'black',
                                                fontWeight: '900',
                                                fontSize: '0.7rem',
                                                letterSpacing: '0.05em',
                                                textDecoration: 'none',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 14px rgba(212, 160, 23, 0.3)',
                                                transition: 'all 0.3s'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
                                                VIEW TIMER
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* FOCUS DATA ANALYSIS ROW */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                                    {/* Goal breakdown */}
                                    <div className="block-card" style={{ padding: '2rem 2.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '900', letterSpacing: '0.15em', opacity: 0.3 }}>GOAL DISTRIBUTION</span>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', margin: '4px 0 0 0', letterSpacing: '0.02em' }}>Focus Time by Strategy Core</h3>
                                        </div>
                                        {activeTasksAnalysis.goalStats.length === 0 ? (
                                            <div style={{ padding: '2rem 0', textAlign: 'center', opacity: 0.3, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px', fontSize: '0.75rem' }}>
                                                No focus distribution available. Log active sessions to see analysis.
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                {activeTasksAnalysis.goalStats.map((item, index) => {
                                                    const colors = ['#d4a017', '#10b981', '#8b5cf6', '#3b82f6', '#ec4899'];
                                                    const barColor = colors[index % colors.length];
                                                    return (
                                                        <div key={item.goal} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: '850', color: 'rgba(255,255,255,0.85)' }}>{item.goal}</span>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: '900', color: barColor }}>
                                                                    {formatTime(item.totalActive, false)} ({item.percentage}%)
                                                                </span>
                                                            </div>
                                                            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '100px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${item.percentage}%`, height: '100%', background: barColor, borderRadius: '100px' }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Focus Efficiency & Metrics breakdown */}
                                    <div className="block-card" style={{ padding: '2rem 2.5rem', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: '900', letterSpacing: '0.15em', opacity: 0.3 }}>EFFICIENCY METRICS</span>
                                                <h3 style={{ fontSize: '1.1rem', fontWeight: '900', margin: '4px 0 0 0', letterSpacing: '0.02em' }}>Execution Quality Summary</h3>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
                                                    <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: '700' }}>Active Focus Time</span>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white' }}>{formatTime(activeTasksAnalysis.grandTotalActive, false)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
                                                    <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: '700' }}>Paused Buffer Time</span>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white' }}>{formatTime(activeTasksAnalysis.grandTotalPaused, false)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
                                                    <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: '700' }}>Average Session Duration</span>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white' }}>{formatTime(activeTasksAnalysis.averageSessionMs, false)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px' }}>
                                                    <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: '700' }}>Completed Pomo Cycles</span>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#d4a017' }}>{activeTasksAnalysis.totalCycles} cycles</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            marginTop: '1.5rem',
                                            padding: '1rem',
                                            background: 'rgba(255,255,255,0.02)',
                                            borderRadius: '16px',
                                            border: '1px solid rgba(255,255,255,0.04)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.55rem', fontWeight: '900', opacity: 0.4, letterSpacing: '0.05em' }}>ACTIVE/PAUSED RATIO</p>
                                                <p style={{ margin: '2px 0 0 0', fontSize: '0.95rem', fontWeight: '900', color: '#10b981' }}>{activeTasksAnalysis.activePercentage}% Focus Intensity</p>
                                            </div>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #10b981' }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: '950', color: '#10b981' }}>{activeTasksAnalysis.activePercentage}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* BEAUTIFUL INTERACTIVE MULTI-SERIES CHART */}
                                <div className="block-card" style={{ padding: '2.5rem 3rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: '900', letterSpacing: '0.1em' }}>TIMELINE PERFORMANCE INSIGHTS</h3>
                                            <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '2px' }}>Day-by-day analysis. Toggle options to isolate custom trendlines.</p>
                                        </div>
                                        
                                        {/* Chart Filters Toggles */}
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            <button 
                                                onClick={() => setChartFilters(prev => ({ ...prev, dailies: !prev.dailies }))}
                                                className={`toggle-pill ${chartFilters.dailies ? 'active' : ''}`}
                                                style={{ '--pill-color': '#10b981' } as React.CSSProperties}
                                            >
                                                <span className="dot" style={{ backgroundColor: '#10b981' }} />
                                                DAILY RITES
                                            </button>
                                            <button 
                                                onClick={() => setChartFilters(prev => ({ ...prev, todos: !prev.todos }))}
                                                className={`toggle-pill ${chartFilters.todos ? 'active' : ''}`}
                                                style={{ '--pill-color': '#8b5cf6' } as React.CSSProperties}
                                            >
                                                <span className="dot" style={{ backgroundColor: '#8b5cf6' }} />
                                                TO-DOS
                                            </button>
                                            <button 
                                                onClick={() => setChartFilters(prev => ({ ...prev, active: !prev.active }))}
                                                className={`toggle-pill ${chartFilters.active ? 'active' : ''}`}
                                                style={{ '--pill-color': '#d4a017' } as React.CSSProperties}
                                            >
                                                <span className="dot" style={{ backgroundColor: '#d4a017' }} />
                                                FOCUS (HRS)
                                            </button>
                                        </div>
                                    </div>

                                    {chartPoints && chartPoints.length > 0 ? (
                                        <div className="mobile-scroll-x" style={{ width: '100%' }}>
                                            <div style={{ minWidth: '700px', position: 'relative' }}>
                                                <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: 'visible' }}>
                                                    {/* Y-Axis Gridlines */}
                                                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                                        const y = paddingTop + ratio * (svgHeight - paddingTop - paddingBottom);
                                                        return (
                                                            <line 
                                                                key={i} 
                                                                x1={paddingLeft} 
                                                                y1={y} 
                                                                x2={svgWidth - paddingRight} 
                                                                y2={y} 
                                                                stroke="rgba(255,255,255,0.03)" 
                                                                strokeWidth="1.5" 
                                                                strokeDasharray="4 4"
                                                            />
                                                        );
                                                    })}

                                                    {/* X-Axis labels & Gridlines */}
                                                    {chartPoints.map((pt, i) => {
                                                        // Show every label if N <= 10, or every 2nd/3rd depending on size to keep aesthetic
                                                        const showLabel = chartPoints.length <= 10 || i % Math.ceil(chartPoints.length / 10) === 0 || i === chartPoints.length - 1;
                                                        return (
                                                            <g key={i}>
                                                                {showLabel && (
                                                                    <>
                                                                        <line 
                                                                            x1={pt.x} 
                                                                            y1={paddingTop} 
                                                                            x2={pt.x} 
                                                                            y2={svgHeight - paddingBottom} 
                                                                            stroke="rgba(255,255,255,0.02)" 
                                                                            strokeWidth="1"
                                                                        />
                                                                        <text 
                                                                            x={pt.x} 
                                                                            y={svgHeight - paddingBottom + 20} 
                                                                            fill="rgba(255,255,255,0.3)" 
                                                                            fontSize="9" 
                                                                            fontWeight="800" 
                                                                            textAnchor="middle"
                                                                        >
                                                                            {pt.displayDate}
                                                                        </text>
                                                                    </>
                                                                )}
                                                            </g>
                                                        );
                                                    })}

                                                    {/* LINE 1: DAILIES */}
                                                    {chartFilters.dailies && chartPoints.length > 1 && (
                                                        <path 
                                                            d={chartPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.yDailies}`, '')}
                                                            fill="none" 
                                                            stroke="#10b981" 
                                                            strokeWidth="3.5" 
                                                            strokeLinecap="round" 
                                                            strokeLinejoin="round"
                                                            style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.2))' }}
                                                        />
                                                    )}

                                                    {/* LINE 2: TODOS */}
                                                    {chartFilters.todos && chartPoints.length > 1 && (
                                                        <path 
                                                            d={chartPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.yTodos}`, '')}
                                                            fill="none" 
                                                            stroke="#8b5cf6" 
                                                            strokeWidth="3.5" 
                                                            strokeLinecap="round" 
                                                            strokeLinejoin="round"
                                                            style={{ filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.2))' }}
                                                        />
                                                    )}

                                                    {/* LINE 3: FOCUS HOURS */}
                                                    {chartFilters.active && chartPoints.length > 1 && (
                                                        <path 
                                                            d={chartPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.yFocus}`, '')}
                                                            fill="none" 
                                                            stroke="#d4a017" 
                                                            strokeWidth="3.5" 
                                                            strokeLinecap="round" 
                                                            strokeLinejoin="round"
                                                            style={{ filter: 'drop-shadow(0 0 6px rgba(212, 160, 23, 0.25))' }}
                                                        />
                                                    )}

                                                    {/* Data Nodes & Interaction circles */}
                                                    {chartPoints.map((pt, i) => (
                                                        <g key={i} className="chart-node-group">
                                                            {chartFilters.dailies && (
                                                                <circle 
                                                                    cx={pt.x} 
                                                                    cy={pt.yDailies} 
                                                                    r="4" 
                                                                    fill="#10b981" 
                                                                    stroke="black" 
                                                                    strokeWidth="1.5"
                                                                />
                                                            )}
                                                            {chartFilters.todos && (
                                                                <circle 
                                                                    cx={pt.x} 
                                                                    cy={pt.yTodos} 
                                                                    r="4" 
                                                                    fill="#8b5cf6" 
                                                                    stroke="black" 
                                                                    strokeWidth="1.5"
                                                                />
                                                            )}
                                                            {chartFilters.active && (
                                                                <circle 
                                                                    cx={pt.x} 
                                                                    cy={pt.yFocus} 
                                                                    r="4" 
                                                                    fill="#d4a017" 
                                                                    stroke="black" 
                                                                    strokeWidth="1.5"
                                                                />
                                                            )}

                                                            {/* Custom Hover Tooltip triggers */}
                                                            <rect 
                                                                x={pt.x - 15} 
                                                                y={paddingTop} 
                                                                width="30" 
                                                                height={svgHeight - paddingTop - paddingBottom} 
                                                                fill="transparent"
                                                                className="chart-col-hitbox"
                                                            />
                                                            <g className="chart-tooltip-panel" style={{ pointerEvents: 'none' }}>
                                                                <rect 
                                                                    x={pt.x > svgWidth - 110 ? pt.x - 115 : pt.x + 10} 
                                                                    y={35} 
                                                                    width="105" 
                                                                    height="75" 
                                                                    rx="6" 
                                                                    fill="rgba(0, 0, 0, 0.9)" 
                                                                    stroke="rgba(255,255,255,0.08)"
                                                                    strokeWidth="1"
                                                                />
                                                                <text x={pt.x > svgWidth - 110 ? pt.x - 105 : pt.x + 20} y={50} fill="white" fontSize="9" fontWeight="900">{pt.date}</text>
                                                                <text x={pt.x > svgWidth - 110 ? pt.x - 105 : pt.x + 20} y={67} fill="#10b981" fontSize="8" fontWeight="800">Dailies: {pt.dailies}</text>
                                                                <text x={pt.x > svgWidth - 110 ? pt.x - 105 : pt.x + 20} y={81} fill="#8b5cf6" fontSize="8" fontWeight="800">To-dos: {pt.todos}</text>
                                                                <text x={pt.x > svgWidth - 110 ? pt.x - 105 : pt.x + 20} y={95} fill="#d4a017" fontSize="8" fontWeight="800">Focus: {pt.focusHours}h</text>
                                                            </g>
                                                        </g>
                                                    ))}
                                                </svg>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.3, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                                            Insufficient activity data in selected date range. Complete more focus sessions to generate chart maps.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}



                        {/* --- TAB 3: MISSION LOG --- */}
                        {activeTab === 'history' && (
                            <div className="block-card" style={{ padding: '3rem', marginTop: '1rem' }}>
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '900', letterSpacing: '0.1em' }}>MISSION LOG (HISTORY)</h3>
                                    <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '2px' }}>Detailed unique execution history across all strategy cores</p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {fullTodoHistory.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.3, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                                            No historical logs available yet. Complete some missions to begin data logging.
                                        </div>
                                    ) : (
                                        fullTodoHistory.map((entry, idx) => (
                                            <div key={entry.id || idx} className="history-entry" style={{
                                                padding: '1.25rem',
                                                background: 'rgba(255,255,255,0.02)',
                                                borderRadius: '16px',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.75rem',
                                                transition: 'transform 0.2s',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.55rem',
                                                            fontWeight: '900',
                                                            background: 
                                                                entry.type === 'active' ? '#d4a01720' : 
                                                                entry.type === 'daily' ? '#10b98120' : '#8b5cf620',
                                                            color: 
                                                                entry.type === 'active' ? '#d4a017' : 
                                                                entry.type === 'daily' ? '#10b981' : '#8b5cf6',
                                                            letterSpacing: '0.1em'
                                                        }}>
                                                            {entry.type === 'active' ? 'ACTIVE MISSION' : entry.type === 'daily' ? 'DAILY RITE' : 'ONE-OFF'}
                                                        </span>
                                                        <p style={{ margin: 0, fontWeight: '800', fontSize: '1rem', color: 'white' }}>{entry.text}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', color: '#10b981' }}>COMPLETED</p>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5 }}>{new Date(entry.tickedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                                    <div>
                                                        <p style={{ fontSize: '0.55rem', fontWeight: '900', opacity: 0.3, letterSpacing: '0.05em', marginBottom: '4px' }}>ORIGIN DATE</p>
                                                        <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>
                                                            {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.55rem', fontWeight: '900', opacity: 0.3, letterSpacing: '0.05em', marginBottom: '4px' }}>PRIORITY LEVEL</p>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (entry.importance || 0) >= 4 ? '#ef4444' : (entry.importance || 0) >= 2 ? '#f59e0b' : '#3b82f6', boxShadow: `0 0 10px ${(entry.importance || 0) >= 4 ? '#ef444480' : (entry.importance || 0) >= 2 ? '#f59e0b80' : '#3b82f680'}` }} />
                                                            <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>
                                                                {(entry.importance || 0) >= 4 ? 'Status: Critical' : (entry.importance || 0) >= 2 ? 'Status: High' : 'Status: Normal'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.55rem', fontWeight: '900', opacity: 0.3, letterSpacing: '0.05em', marginBottom: '4px' }}>METRIC ANALYSIS</p>
                                                        <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>
                                                            {entry.type === 'active' && entry.activeTime 
                                                                ? `${Math.floor(entry.activeTime / 60000)}m focused` 
                                                                : entry.createdAt 
                                                                    ? `${Math.floor((entry.tickedAt - entry.createdAt) / (1000 * 60 * 60 * 24))} day cycles delay` 
                                                                    : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <MobileBottomNav />
            </div>

            <style jsx>{`
                .stat-card-deep {
                    padding: 2rem;
                    background: rgba(255,255,255,0.02);
                    border-radius: 20px;
                    border: 1px solid rgba(255,255,255,0.04);
                    min-width: 140px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .history-entry:hover {
                    background: rgba(255,255,255,0.04) !important;
                    transform: translateX(4px);
                }
                .toggle-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 14px;
                    border-radius: 100px;
                    font-size: 0.65rem;
                    font-weight: 850;
                    letter-spacing: 0.05em;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.06);
                    color: rgba(255,255,255,0.4);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .toggle-pill:hover {
                    background: rgba(255,255,255,0.05);
                    color: rgba(255,255,255,0.8);
                }
                .toggle-pill.active {
                    background: var(--pill-color);
                    color: black;
                    border-color: transparent;
                    box-shadow: 0 0 15px rgba(255, 255, 255, 0.05);
                }
                .toggle-pill .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    transition: all 0.3s;
                }
                .toggle-pill.active .dot {
                    background-color: black !important;
                }
                .chart-col-hitbox:hover ~ .chart-tooltip-panel {
                    opacity: 1 !important;
                    visibility: visible !important;
                }
                .chart-tooltip-panel {
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.2s, visibility 0.2s;
                }
                .chart-node-group {
                    cursor: pointer;
                }
                .chart-node-group:hover circle {
                    r: 6px;
                    stroke-width: 2px;
                }
                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 0.5; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.5; }
                }
            `}</style>
        </main>
    );
}
