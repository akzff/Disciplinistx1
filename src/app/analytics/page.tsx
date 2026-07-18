'use client';

import { useState, useMemo, useEffect } from 'react';
import { TodoHistoryEntry, formatTime, WrapUpData, DailyChat, SleepData, PhysicalData } from '@/lib/storage';
import { NavigationBar } from '@/components/NavigationBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useData } from '@/lib/DataContext';
import { useAuthContext } from '@/lib/AuthContext';
import Image from 'next/image';
import WrapUpModal from '@/components/WrapUpModal';
import SleepModal from '@/components/SleepModal';
import PhysicalHealthModal from '@/components/PhysicalHealthModal';
import { cloudStorage } from '@/lib/cloudStorage';

export default function AnalyticsPage() {
    const { allChats, preferences, setLocalChat } = useData();
    const { signOut, user } = useAuthContext();

    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [trackingStep, setTrackingStep] = useState<'sleep' | 'physical' | 'mental' | null>(null);

    const handleEditWrapUpClick = (date: string) => {
        setEditingDate(date);
        setTrackingStep('sleep');
    };

    const handleSaveSleep = async (sleepData: SleepData) => {
        if (!editingDate) return;
        const currentChat = allChats[editingDate];
        if (!currentChat) return;

        const updatedChat: DailyChat = {
            ...currentChat,
            sleep: sleepData
        };

        await cloudStorage.saveChat(editingDate, updatedChat, user?.id || undefined, true);
        setLocalChat(editingDate, updatedChat);
        setTrackingStep('physical');
    };

    const handleSavePhysical = async (physicalData: PhysicalData) => {
        if (!editingDate) return;
        const currentChat = allChats[editingDate];
        if (!currentChat) return;

        const updatedChat: DailyChat = {
            ...currentChat,
            physical: physicalData
        };

        await cloudStorage.saveChat(editingDate, updatedChat, user?.id || undefined, true);
        setLocalChat(editingDate, updatedChat);
        setTrackingStep('mental');
    };

    const handleSaveWrapUp = async (wrapUpData: WrapUpData) => {
        if (!editingDate) return;
        const currentChat = allChats[editingDate];
        if (!currentChat) return;

        const updatedChat: DailyChat = {
            ...currentChat,
            wrapUp: wrapUpData,
            status: 'CLOSED'
        };

        await cloudStorage.saveChat(editingDate, updatedChat, user?.id || undefined, true);
        setLocalChat(editingDate, updatedChat);
        setTrackingStep(null);
        setEditingDate(null);
    };
    
    // TAB NAVIGATION
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'wrapup' | 'health'>('overview');
    const [historyFilter, setHistoryFilter] = useState<'all' | 'todo' | 'daily' | 'stopwatch' | 'pomodoro'>('all');

    // DATE RANGE SELECTION
    const [dateRange, setDateRange] = useState<'7' | '14' | '30' | 'all'>('14');

    // Load preference from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedRange = localStorage.getItem('disciplinist_analytics_date_range');
            if (savedRange && ['7', '14', '30', 'all'].includes(savedRange)) {
                setDateRange(savedRange as '7' | '14' | '30' | 'all');
            }
        }
    }, []);

    // Save preference to localStorage when dateRange changes
    const handleSetDateRange = (range: '7' | '14' | '30' | 'all') => {
        setDateRange(range);
        if (typeof window !== 'undefined') {
            localStorage.setItem('disciplinist_analytics_date_range', range);
        }
    };

    // Real-time clock to sync live active tasks
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // EXPANDED GOALS FOR SUBTASK BREAKDOWN
    const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});

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
            let dailyFocusMs = 0;
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
                            dailyFocusMs += entry.activeTime || 0;
                        }
                    });
                }
                // Include active task in progress time
                if (chat.activeTasks && Array.isArray(chat.activeTasks)) {
                    const todayStr = new Date(now).toISOString().split('T')[0];
                    chat.activeTasks.forEach(task => {
                        let taskActive = (task.accumulatedActiveTime || 0) + (task.totalActiveTime || 0);
                        if (date === todayStr && task.status === 'RUNNING') {
                            taskActive += Math.max(0, now - (task.lastStartedAt || task.startTime || now));
                        }
                        if (taskActive > 0) {
                            dailyFocusMs += taskActive;
                            totalActiveMissions++;
                        }
                    });
                }
            }
            // Cap daily focus time at 24 hours
            totalFocusTimeMs += Math.min(24 * 3600000, dailyFocusMs);
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
        const todayStr = new Date(now).toISOString().split('T')[0];
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
                        if (date === todayStr && task.status === 'RUNNING') {
                            taskActive += Math.max(0, now - (task.lastStartedAt || task.startTime || now));
                        }
                        focusHours += taskActive / 3600000;
                    });
                }
            }

            return {
                date,
                displayDate: (() => { const p = date.split('-'); return `${p[2]}/${p[1]}`; })(), // DD/MM
                dailies: dailiesCompleted,
                todos: todosCompleted,
                focusHours: Math.min(24.0, parseFloat(focusHours.toFixed(1)))
            };
        });
    }, [allChats, filteredDates, now]);

    const healthStats = useMemo(() => {
        let totalSleepHours = 0;
        let sleepHoursCount = 0;
        let totalSleepQuality = 0;
        let sleepQualityCount = 0;
        let totalEnergy = 0;
        let energyCount = 0;
        let totalPain = 0;
        let painCount = 0;
        let workoutDays = 0;
        let daysWithWorkoutLogged = 0;

        let highSleepQualityFocusHrsTotal = 0;
        let highSleepQualityCount = 0;
        let lowSleepQualityFocusHrsTotal = 0;
        let lowSleepQualityCount = 0;

        let highEnergyFocusHrsTotal = 0;
        let highEnergyCount = 0;
        let lowEnergyFocusHrsTotal = 0;
        let lowEnergyCount = 0;

        filteredDates.forEach(date => {
            const chat = allChats[date];
            if (!chat) return;

            let dailyFocusHours = 0;
            if (chat.todoHistory && Array.isArray(chat.todoHistory)) {
                chat.todoHistory.forEach(entry => {
                    if (entry.type === 'active') {
                        dailyFocusHours += (entry.activeTime || 0) / 3600000;
                    }
                });
            }
            if (chat.activeTasks && Array.isArray(chat.activeTasks)) {
                chat.activeTasks.forEach(task => {
                    const todayStr = new Date(now).toISOString().split('T')[0];
                    let taskActive = (task.accumulatedActiveTime || 0) + (task.totalActiveTime || 0);
                    if (date === todayStr && task.status === 'RUNNING') {
                        taskActive += Math.max(0, now - (task.lastStartedAt || task.startTime || now));
                    }
                    dailyFocusHours += taskActive / 3600000;
                });
            }
            dailyFocusHours = Math.min(24.0, dailyFocusHours);

            if (chat.sleep) {
                totalSleepHours += chat.sleep.hours;
                sleepHoursCount++;
                totalSleepQuality += chat.sleep.rating;
                sleepQualityCount++;

                if (chat.sleep.rating >= 4) {
                    highSleepQualityFocusHrsTotal += dailyFocusHours;
                    highSleepQualityCount++;
                } else if (chat.sleep.rating <= 2) {
                    lowSleepQualityFocusHrsTotal += dailyFocusHours;
                    lowSleepQualityCount++;
                }
            }

            if (chat.physical) {
                totalEnergy += chat.physical.energy;
                energyCount++;
                totalPain += chat.physical.pain;
                painCount++;

                daysWithWorkoutLogged++;
                if (chat.physical.workout) {
                    workoutDays++;
                }

                if (chat.physical.energy >= 4) {
                    highEnergyFocusHrsTotal += dailyFocusHours;
                    highEnergyCount++;
                } else if (chat.physical.energy <= 2) {
                    lowEnergyFocusHrsTotal += dailyFocusHours;
                    lowEnergyCount++;
                }
            }
        });

        return {
            avgSleepHours: sleepHoursCount > 0 ? parseFloat((totalSleepHours / sleepHoursCount).toFixed(1)) : 0,
            avgSleepQuality: sleepQualityCount > 0 ? parseFloat((totalSleepQuality / sleepQualityCount).toFixed(1)) : 0,
            avgEnergy: energyCount > 0 ? parseFloat((totalEnergy / energyCount).toFixed(1)) : 0,
            avgPain: painCount > 0 ? parseFloat((totalPain / painCount).toFixed(1)) : 0,
            workoutConsistency: daysWithWorkoutLogged > 0 ? Math.round((workoutDays / daysWithWorkoutLogged) * 100) : 0,
            
            highSleepFocus: highSleepQualityCount > 0 ? parseFloat((highSleepQualityFocusHrsTotal / highSleepQualityCount).toFixed(1)) : 0,
            lowSleepFocus: lowSleepQualityCount > 0 ? parseFloat((lowSleepQualityFocusHrsTotal / lowSleepQualityCount).toFixed(1)) : 0,
            highEnergyFocus: highEnergyCount > 0 ? parseFloat((highEnergyFocusHrsTotal / highEnergyCount).toFixed(1)) : 0,
            lowEnergyFocus: lowEnergyCount > 0 ? parseFloat((lowEnergyFocusHrsTotal / lowEnergyCount).toFixed(1)) : 0
        };
    }, [allChats, filteredDates, now]);

    // DETAILED ACTIVE TASK DATA ANALYSIS
    const activeTasksAnalysis = useMemo(() => {
        const goalFocusMap: Record<string, { 
            totalActive: number; 
            totalPaused: number; 
            sessions: number;
            subtasks: Record<string, { totalActive: number; totalPaused: number; sessions: number }>
        }> = {};
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
                        const subtask = parts.length > 1 ? parts.slice(1).join(' - ')?.trim() : 'General';
                        
                        const active = entry.activeTime || 0;
                        const paused = entry.pausedTime || 0;
                        const cycles = entry.completedCycles || 0;

                        if (!goalFocusMap[goal]) {
                            goalFocusMap[goal] = { totalActive: 0, totalPaused: 0, sessions: 0, subtasks: {} };
                        }
                        goalFocusMap[goal].totalActive += active;
                        goalFocusMap[goal].totalPaused += paused;
                        goalFocusMap[goal].sessions += 1;

                        if (!goalFocusMap[goal].subtasks[subtask]) {
                            goalFocusMap[goal].subtasks[subtask] = { totalActive: 0, totalPaused: 0, sessions: 0 };
                        }
                        goalFocusMap[goal].subtasks[subtask].totalActive += active;
                        goalFocusMap[goal].subtasks[subtask].totalPaused += paused;
                        goalFocusMap[goal].subtasks[subtask].sessions += 1;

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
                    
                    if (date === todayStr) {
                        if (task.status === 'RUNNING') {
                            taskActive += Math.max(0, now - (task.lastStartedAt || task.startTime || now));
                        } else if (task.status === 'PAUSED') {
                            taskPaused += Math.max(0, now - (task.lastPausedAt || task.startTime || now));
                        }
                    }

                    if (taskActive > 0 || taskPaused > 0) {
                        const parts = task.name.split(' - ');
                        const goal = parts[0]?.trim() || 'General';
                        const subtask = parts.length > 1 ? parts.slice(1).join(' - ')?.trim() : 'General';

                        if (!goalFocusMap[goal]) {
                            goalFocusMap[goal] = { totalActive: 0, totalPaused: 0, sessions: 0, subtasks: {} };
                        }
                        goalFocusMap[goal].totalActive += taskActive;
                        goalFocusMap[goal].totalPaused += taskPaused;
                        goalFocusMap[goal].sessions += 1;

                        if (!goalFocusMap[goal].subtasks[subtask]) {
                            goalFocusMap[goal].subtasks[subtask] = { totalActive: 0, totalPaused: 0, sessions: 0 };
                        }
                        goalFocusMap[goal].subtasks[subtask].totalActive += taskActive;
                        goalFocusMap[goal].subtasks[subtask].totalPaused += taskPaused;
                        goalFocusMap[goal].subtasks[subtask].sessions += 1;

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
            percentage: grandTotalActive > 0 ? Math.round((stats.totalActive / grandTotalActive) * 100) : 0,
            subtaskStats: Object.entries(stats.subtasks).map(([subtask, subStats]) => ({
                subtask,
                ...subStats,
                percentage: stats.totalActive > 0 ? Math.round((subStats.totalActive / stats.totalActive) * 100) : 0
            })).sort((a, b) => b.totalActive - a.totalActive)
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

    // FILTERED MISSION LOG HISTORY
    const filteredHistory = useMemo(() => {
        if (historyFilter === 'all') return fullTodoHistory;
        return fullTodoHistory.filter(entry => {
            if (historyFilter === 'todo') {
                return entry.sessionType === 'todo' || (entry.type === 'todo' && !entry.sessionType);
            }
            if (historyFilter === 'daily') {
                return entry.sessionType === 'daily' || (entry.type === 'daily' && !entry.sessionType);
            }
            return entry.sessionType === historyFilter;
        });
    }, [fullTodoHistory, historyFilter]);

    // WRAP-UP CORRELATION ENGINE STATS
    const wrapUpStats = useMemo(() => {
        const allWrapUps: { date: string; wrapUp: WrapUpData }[] = [];
        sortedDates.forEach(date => {
            const chat = allChats[date];
            if (chat && chat.wrapUp) {
                allWrapUps.push({ date, wrapUp: chat.wrapUp });
            }
        });

        let flowCount = 0;
        let anxiousCount = 0;
        let calmCount = 0;
        let drainedCount = 0;
        const totalWrapUps = allWrapUps.length;

        // Filtered wrap ups for display
        const filteredWrapUps = allWrapUps.filter(item => filteredDates.includes(item.date));

        // Calculate distributions
        const distributionSource = dateRange === 'all' ? allWrapUps : filteredWrapUps;
        const distTotal = distributionSource.length;

        distributionSource.forEach(item => {
            const label = item.wrapUp.mood?.label;
            if (label === 'Flow / Inspired') flowCount++;
            else if (label === 'Anxious / Frustrated') anxiousCount++;
            else if (label === 'Calm / Clear-Headed') calmCount++;
            else if (label === 'Drained / Bored') drainedCount++;
        });

        const flowPct = distTotal > 0 ? Math.round((flowCount / distTotal) * 100) : 0;
        const anxiousPct = distTotal > 0 ? Math.round((anxiousCount / distTotal) * 100) : 0;
        const calmPct = distTotal > 0 ? Math.round((calmCount / distTotal) * 100) : 0;
        const drainedPct = distTotal > 0 ? Math.round((drainedCount / distTotal) * 100) : 0;

        // Focus sessions on Calm vs Flow days (All-Time)
        const calmSessionDurations: number[] = [];
        const flowSessionDurations: number[] = [];
        const allSessionDurations: number[] = [];

        // Daily total focus times
        const dailyTotalFocusTimes: number[] = [];
        const panicHangoverDailyTotalFocusTimes: number[] = [];
        const panicHangoverSessionDurations: number[] = [];

        sortedDates.forEach((date, index) => {
            const chat = allChats[date];
            if (!chat) return;

            const sessions: number[] = [];
            let dailyTotal = 0;

            if (chat.todoHistory && Array.isArray(chat.todoHistory)) {
                chat.todoHistory.forEach(entry => {
                    if (entry.type === 'active' && entry.activeTime && entry.activeTime > 0) {
                        sessions.push(entry.activeTime);
                        dailyTotal += entry.activeTime;
                    }
                });
            }
            if (chat.activeTasks && Array.isArray(chat.activeTasks)) {
                chat.activeTasks.forEach(task => {
                    const taskActive = (task.accumulatedActiveTime || 0) + (task.totalActiveTime || 0);
                    if (taskActive > 0) {
                        sessions.push(taskActive);
                        dailyTotal += taskActive;
                    }
                });
            }

            allSessionDurations.push(...sessions);
            dailyTotalFocusTimes.push(dailyTotal);

            if (chat.wrapUp && chat.wrapUp.mood) {
                const label = chat.wrapUp.mood.label;
                if (label === 'Calm / Clear-Headed') {
                    calmSessionDurations.push(...sessions);
                } else if (label === 'Flow / Inspired') {
                    flowSessionDurations.push(...sessions);
                }
            }

            // Check if previous day was Anxious/Frustrated
            if (index > 0) {
                const prevDate = sortedDates[index - 1];
                const prevChat = allChats[prevDate];
                if (prevChat && prevChat.wrapUp && prevChat.wrapUp.mood?.label === 'Anxious / Frustrated') {
                    panicHangoverSessionDurations.push(...sessions);
                    panicHangoverDailyTotalFocusTimes.push(dailyTotal);
                }
            }
        });

        const avgCalmSessionMs = calmSessionDurations.length > 0
            ? calmSessionDurations.reduce((a, b) => a + b, 0) / calmSessionDurations.length
            : 0;

        const avgFlowSessionMs = flowSessionDurations.length > 0
            ? flowSessionDurations.reduce((a, b) => a + b, 0) / flowSessionDurations.length
            : 0;

        const avgOverallSessionMs = allSessionDurations.length > 0
            ? allSessionDurations.reduce((a, b) => a + b, 0) / allSessionDurations.length
            : 0;

        const avgPanicHangoverSessionMs = panicHangoverSessionDurations.length > 0
            ? panicHangoverSessionDurations.reduce((a, b) => a + b, 0) / panicHangoverSessionDurations.length
            : 0;

        const panicDropPct = avgOverallSessionMs > 0 && avgPanicHangoverSessionMs < avgOverallSessionMs
            ? Math.round(((avgOverallSessionMs - avgPanicHangoverSessionMs) / avgOverallSessionMs) * 100)
            : 0;

        const avgOverallDailyFocusMs = dailyTotalFocusTimes.length > 0
            ? dailyTotalFocusTimes.reduce((a, b) => a + b, 0) / dailyTotalFocusTimes.length
            : 0;

        const avgPanicHangoverDailyFocusMs = panicHangoverDailyTotalFocusTimes.length > 0
            ? panicHangoverDailyTotalFocusTimes.reduce((a, b) => a + b, 0) / panicHangoverDailyTotalFocusTimes.length
            : 0;

        const panicDailyDropPct = avgOverallDailyFocusMs > 0 && avgPanicHangoverDailyFocusMs < avgOverallDailyFocusMs
            ? Math.round(((avgOverallDailyFocusMs - avgPanicHangoverDailyFocusMs) / avgOverallDailyFocusMs) * 100)
            : 0;

        return {
            totalWrapUps,
            distTotal,
            flowCount,
            anxiousCount,
            calmCount,
            drainedCount,
            flowPct,
            anxiousPct,
            calmPct,
            drainedPct,
            avgCalmSessionMs,
            avgFlowSessionMs,
            avgOverallSessionMs,
            avgPanicHangoverSessionMs,
            panicDropPct,
            avgOverallDailyFocusMs,
            avgPanicHangoverDailyFocusMs,
            panicDailyDropPct,
            filteredWrapUps,
            allWrapUps
        };
    }, [allChats, sortedDates, filteredDates, dateRange]);

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

                                <button 
                                    onClick={() => setActiveTab('wrapup')}
                                    style={{ padding: '1rem 0', background: 'none', border: 'none', color: activeTab === 'wrapup' ? '#d4a017' : 'rgba(255,255,255,0.3)', fontWeight: '900', fontSize: '0.8rem', letterSpacing: '0.2em', cursor: 'pointer', borderBottom: activeTab === 'wrapup' ? '2.5px solid #d4a017' : '2.5px solid transparent', transition: 'all 0.3s' }}
                                >
                                    WRAP-UP ANALYTICS
                                </button>
                                <button 
                                    onClick={() => setActiveTab('health')}
                                    style={{ padding: '1rem 0', background: 'none', border: 'none', color: activeTab === 'health' ? '#06b6d4' : 'rgba(255,255,255,0.3)', fontWeight: '900', fontSize: '0.8rem', letterSpacing: '0.2em', cursor: 'pointer', borderBottom: activeTab === 'health' ? '2.5px solid #06b6d4' : '2.5px solid transparent', transition: 'all 0.3s' }}
                                >
                                    HEALTH & SLEEP
                                </button>
                            </div>

                            {/* CONTROLS */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>


                                {/* DATE RANGE SEGMENT CONTROL */}
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    {[
                                        { id: '7', label: '7 DAYS' },
                                        { id: '14', label: '14 DAYS' },
                                        { id: '30', label: '30 DAYS' },
                                        { id: 'all', label: 'ALL TIME' }
                                    ].map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => handleSetDateRange(r.id as '7' | '14' | '30' | 'all')}
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
                        </div>

                        {/* --- TAB 1: OVERVIEW --- */}
                        {activeTab === 'overview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                                
                                {/* PERFORMANCE OVERVIEW GRID */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                    <div className="stat-card-deep" style={{ borderLeft: '4px solid #10b981', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
                                        <p style={{ fontSize: '0.65rem', fontWeight: '900', color: '#10b981', opacity: 0.8, letterSpacing: '0.05em' }}>DAILIES</p>
                                        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', margin: '4px 0' }}>{rangeStats.dailySuccessRate}%</h2>
                                        <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>{rangeStats.totalDailiesCompleted} of {rangeStats.totalDailiesAssigned} synced</p>
                                    </div>

                                    <div className="stat-card-deep" style={{ borderLeft: '4px solid #8b5cf6', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
                                        <p style={{ fontSize: '0.65rem', fontWeight: '900', color: '#8b5cf6', opacity: 0.8, letterSpacing: '0.05em' }}>TASKS CLEARED</p>
                                        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', margin: '4px 0' }}>{rangeStats.totalTodosCompleted}</h2>
                                        <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>One-offs ticked off</p>
                                    </div>

                                    <div className="stat-card-deep" style={{ borderLeft: '4px solid #d4a017', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
                                        <p style={{ fontSize: '0.65rem', fontWeight: '900', color: '#d4a017', opacity: 0.8, letterSpacing: '0.05em' }}>FOCUSED SESSION TIME</p>
                                        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', margin: '4px 0' }}>
                                            {formatTime(rangeStats.totalFocusTimeMs, false)}
                                        </h2>
                                        <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>Accumulated over {rangeStats.totalActiveMissions} live focus slots</p>
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
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', margin: '4px 0 0 0', letterSpacing: '0.02em' }}>Focus Time by Goal</h3>
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
                                                    const isExpanded = !!expandedGoals[item.goal];
                                                    return (
                                                        <div key={item.goal} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            <div 
                                                                onClick={() => setExpandedGoals(prev => ({ ...prev, [item.goal]: !prev[item.goal] }))}
                                                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ fontSize: '0.65rem', opacity: 0.5, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: '850', color: 'rgba(255,255,255,0.85)' }}>{item.goal}</span>
                                                                </div>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: '900', color: barColor }}>
                                                                    {formatTime(item.totalActive, false)} ({item.percentage}%)
                                                                </span>
                                                            </div>
                                                            <div 
                                                                onClick={() => setExpandedGoals(prev => ({ ...prev, [item.goal]: !prev[item.goal] }))}
                                                                style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '100px', overflow: 'hidden', cursor: 'pointer' }}
                                                            >
                                                                <div style={{ width: `${item.percentage}%`, height: '100%', background: barColor, borderRadius: '100px' }} />
                                                            </div>

                                                            {/* Nested Subtasks Breakdown */}
                                                            {isExpanded && (
                                                                <div style={{ 
                                                                    display: 'flex', 
                                                                    flexDirection: 'column', 
                                                                    gap: '8px', 
                                                                    marginLeft: '14px', 
                                                                    paddingLeft: '10px', 
                                                                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                                                                    marginTop: '4px',
                                                                    marginBottom: '8px'
                                                                }}>
                                                                    {item.subtaskStats.map((sub) => (
                                                                        <div key={sub.subtask} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>{sub.subtask}</span>
                                                                                <span style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.85 }}>
                                                                                    {formatTime(sub.totalActive, false)} ({sub.percentage}%)
                                                                                </span>
                                                                            </div>
                                                                            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '100px', overflow: 'hidden' }}>
                                                                                <div style={{ width: `${sub.percentage}%`, height: '100%', background: barColor, opacity: 0.7, borderRadius: '100px' }} />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
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
                                                DAILIES
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



                        {/* --- TAB 2: WRAP-UP & CORRELATION --- */}
                        {activeTab === 'wrapup' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                                
                                {/* CORRELATION INSIGHTS PANEL */}
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '900', letterSpacing: '0.15em', marginBottom: '1.25rem', color: 'rgba(255,255,255,0.9)' }}>CORRELATION INSIGHTS</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                                        
                                        {/* INSIGHT A: MINDFULNESS VS MOMENTUM */}
                                        <div className="block-card insight-card" style={{ borderLeft: '4px solid #06b6d4', padding: '2rem 2.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                            <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#06b6d4', letterSpacing: '0.15em' }}>INSIGHT A • COGNITIVE STATE VS SESSION LENGTH</span>
                                            <h4 style={{ fontSize: '1.1rem', fontWeight: '900', margin: '6px 0 1rem 0', color: 'white' }}>Mindfulness vs. Momentum</h4>
                                            
                                            {wrapUpStats.avgCalmSessionMs === 0 && wrapUpStats.avgFlowSessionMs === 0 ? (
                                                <p style={{ fontSize: '0.75rem', opacity: 0.4 }}>No active focus sessions logged on Calm or Flow days yet.</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                            <span style={{ opacity: 0.6 }}>Calm / Clear-Headed sessions</span>
                                                            <span style={{ fontWeight: '800', color: '#3b82f6' }}>{formatTime(wrapUpStats.avgCalmSessionMs, false)}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: wrapUpStats.avgCalmSessionMs + wrapUpStats.avgFlowSessionMs > 0
                                                                    ? `${(wrapUpStats.avgCalmSessionMs / (wrapUpStats.avgCalmSessionMs + wrapUpStats.avgFlowSessionMs)) * 100}%`
                                                                    : '0%',
                                                                height: '100%',
                                                                background: '#3b82f6'
                                                            }} />
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                            <span style={{ opacity: 0.6 }}>Flow / Inspired sessions</span>
                                                            <span style={{ fontWeight: '800', color: '#06b6d4' }}>{formatTime(wrapUpStats.avgFlowSessionMs, false)}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: wrapUpStats.avgCalmSessionMs + wrapUpStats.avgFlowSessionMs > 0
                                                                    ? `${(wrapUpStats.avgFlowSessionMs / (wrapUpStats.avgCalmSessionMs + wrapUpStats.avgFlowSessionMs)) * 100}%`
                                                                    : '0%',
                                                                height: '100%',
                                                                background: '#06b6d4'
                                                            }} />
                                                        </div>
                                                    </div>

                                                    <p style={{ fontSize: '0.75rem', opacity: 0.5, lineHeight: '1.4', marginTop: '0.5rem', margin: 0 }}>
                                                        {wrapUpStats.avgCalmSessionMs > wrapUpStats.avgFlowSessionMs ? (
                                                            <span>
                                                                <strong>Calm states promote sustained focus.</strong> Your sessions are on average{' '}
                                                                <span style={{ color: '#3b82f6', fontWeight: '800' }}>
                                                                    {Math.round(((wrapUpStats.avgCalmSessionMs - wrapUpStats.avgFlowSessionMs) / (wrapUpStats.avgFlowSessionMs || 1)) * 100)}%
                                                                </span>{' '}
                                                                longer than during high-energy Flow states. Calm minds avoid premature distraction.
                                                            </span>
                                                        ) : wrapUpStats.avgFlowSessionMs > wrapUpStats.avgCalmSessionMs ? (
                                                            <span>
                                                                <strong>Flow states drive momentum.</strong> Your sessions are on average{' '}
                                                                <span style={{ color: '#06b6d4', fontWeight: '800' }}>
                                                                    {Math.round(((wrapUpStats.avgFlowSessionMs - wrapUpStats.avgCalmSessionMs) / (wrapUpStats.avgCalmSessionMs || 1)) * 100)}%
                                                                </span>{' '}
                                                                longer when inspired. Energy fuels longer execution blocks.
                                                            </span>
                                                        ) : (
                                                            <span>Your focus session durations are equal between Calm and Flow states. Keep logging data to discover patterns.</span>
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* INSIGHT B: THE PANIC HANGOVER */}
                                        <div className="block-card insight-card" style={{ borderLeft: '4px solid #f97316', padding: '2rem 2.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                            <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#f97316', letterSpacing: '0.15em' }}>INSIGHT B • ANXIETY HANGOVER DROP</span>
                                            <h4 style={{ fontSize: '1.1rem', fontWeight: '900', margin: '6px 0 1rem 0', color: 'white' }}>The Panic Hangover</h4>
                                            
                                            {wrapUpStats.anxiousCount === 0 ? (
                                                <p style={{ fontSize: '0.75rem', opacity: 0.4 }}>No Anxious / Frustrated days logged yet to calculate hangover metrics.</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.55rem', opacity: 0.4, fontWeight: '800', display: 'block', marginBottom: '4px' }}>SESSION DURATION DROP</span>
                                                            <h5 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0, color: wrapUpStats.panicDropPct > 0 ? '#f97316' : '#10b981' }}>
                                                                {wrapUpStats.panicDropPct > 0 ? `-${wrapUpStats.panicDropPct}%` : '0%'}
                                                            </h5>
                                                            <span style={{ fontSize: '0.6rem', opacity: 0.35 }}>
                                                                {formatTime(wrapUpStats.avgPanicHangoverSessionMs, false)} vs {formatTime(wrapUpStats.avgOverallSessionMs, false)} avg
                                                            </span>
                                                        </div>

                                                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.55rem', opacity: 0.4, fontWeight: '800', display: 'block', marginBottom: '4px' }}>DAILY TOTAL FOCUS DROP</span>
                                                            <h5 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0, color: wrapUpStats.panicDailyDropPct > 0 ? '#f97316' : '#10b981' }}>
                                                                {wrapUpStats.panicDailyDropPct > 0 ? `-${wrapUpStats.panicDailyDropPct}%` : '0%'}
                                                            </h5>
                                                            <span style={{ fontSize: '0.6rem', opacity: 0.35 }}>
                                                                {formatTime(wrapUpStats.avgPanicHangoverDailyFocusMs, false)} vs {formatTime(wrapUpStats.avgOverallDailyFocusMs, false)} avg
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <p style={{ fontSize: '0.75rem', opacity: 0.5, lineHeight: '1.4', margin: 0 }}>
                                                        {wrapUpStats.panicDailyDropPct > 0 || wrapUpStats.panicDropPct > 0 ? (
                                                            <span>
                                                                <strong>Emotional friction leaves a hangover.</strong> The day following an Anxious / Frustrated state shows a{' '}
                                                                <span style={{ color: '#f97316', fontWeight: '800' }}>{wrapUpStats.panicDailyDropPct}% drop</span> in total daily focus time. Emotional fatigue drags productivity down.
                                                            </span>
                                                        ) : (
                                                            <span>No significant focus drop detected following Anxious / Frustrated days. You maintain stability well!</span>
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* MOOD MATRIX QUADRANT DISTRIBUTION */}
                                <div className="block-card" style={{ padding: '2.5rem 3rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: '900', letterSpacing: '0.1em' }}>MOOD MATRIX QUADRANT DISTRIBUTION</h3>
                                            <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '2px' }}>
                                                Current view based on {wrapUpStats.distTotal} logged days in selected range.
                                            </p>
                                        </div>
                                    </div>

                                    {wrapUpStats.distTotal === 0 ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.3, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                                            No wrap-up mood logs recorded in the selected date range.
                                        </div>
                                    ) : (
                                        <div className="mood-matrix-container" style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '1.5rem',
                                            maxWidth: '640px',
                                            margin: '1.5rem auto',
                                            position: 'relative'
                                        }}>
                                            {/* Labels for Energy / Tone */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '-24px',
                                                left: 0,
                                                right: 0,
                                                textAlign: 'center',
                                                fontSize: '0.6rem',
                                                fontWeight: '800',
                                                letterSpacing: '0.15em',
                                                opacity: 0.3
                                            }}>HIGH ENERGY (Wired / Driven)</div>

                                            <div style={{
                                                position: 'absolute',
                                                bottom: '-28px',
                                                left: 0,
                                                right: 0,
                                                textAlign: 'center',
                                                fontSize: '0.6rem',
                                                fontWeight: '800',
                                                letterSpacing: '0.15em',
                                                opacity: 0.3
                                            }}>LOW ENERGY (Sluggish / Quiet)</div>

                                            <div style={{
                                                position: 'absolute',
                                                left: '-40px',
                                                top: 0,
                                                bottom: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transform: 'rotate(-90deg)',
                                                fontSize: '0.6rem',
                                                fontWeight: '800',
                                                letterSpacing: '0.15em',
                                                opacity: 0.3,
                                                whiteSpace: 'nowrap'
                                            }}>NEGATIVE TONE</div>

                                            <div style={{
                                                position: 'absolute',
                                                right: '-40px',
                                                top: 0,
                                                bottom: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transform: 'rotate(90deg)',
                                                fontSize: '0.6rem',
                                                fontWeight: '800',
                                                letterSpacing: '0.15em',
                                                opacity: 0.3,
                                                whiteSpace: 'nowrap'
                                            }}>POSITIVE TONE</div>

                                            {/* QUADRANTS */}
                                            {/* TOP-LEFT: ANXIOUS / FRUSTRATED */}
                                            <div className="matrix-quadrant quad-anxious" style={{
                                                background: 'rgba(249, 115, 22, 0.02)',
                                                border: '1.5px solid rgba(249, 115, 22, 0.08)',
                                                borderRadius: '20px',
                                                padding: '2rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                textAlign: 'center',
                                                transition: 'all 0.3s ease',
                                                minHeight: '130px'
                                            }}>
                                                <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#f97316', letterSpacing: '0.15em', marginBottom: '6px' }}>ANXIOUS / FRUSTRATED</span>
                                                <h4 style={{ fontSize: '2.5rem', fontWeight: '950', margin: 0, color: 'white' }}>{wrapUpStats.anxiousPct}%</h4>
                                                <span style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '4px' }}>{wrapUpStats.anxiousCount} of {wrapUpStats.distTotal} logs</span>
                                            </div>

                                            {/* TOP-RIGHT: FLOW / INSPIRED */}
                                            <div className="matrix-quadrant quad-flow" style={{
                                                background: 'rgba(6, 182, 212, 0.02)',
                                                border: '1.5px solid rgba(6, 182, 212, 0.08)',
                                                borderRadius: '20px',
                                                padding: '2rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                textAlign: 'center',
                                                transition: 'all 0.3s ease',
                                                minHeight: '130px'
                                            }}>
                                                <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#06b6d4', letterSpacing: '0.15em', marginBottom: '6px' }}>FLOW / INSPIRED</span>
                                                <h4 style={{ fontSize: '2.5rem', fontWeight: '950', margin: 0, color: 'white' }}>{wrapUpStats.flowPct}%</h4>
                                                <span style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '4px' }}>{wrapUpStats.flowCount} of {wrapUpStats.distTotal} logs</span>
                                            </div>

                                            {/* BOTTOM-LEFT: DRAINED / BORED */}
                                            <div className="matrix-quadrant quad-drained" style={{
                                                background: 'rgba(156, 163, 175, 0.02)',
                                                border: '1.5px solid rgba(156, 163, 175, 0.08)',
                                                borderRadius: '20px',
                                                padding: '2rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                textAlign: 'center',
                                                transition: 'all 0.3s ease',
                                                minHeight: '130px'
                                            }}>
                                                <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#9ca3af', letterSpacing: '0.15em', marginBottom: '6px' }}>DRAINED / BORED</span>
                                                <h4 style={{ fontSize: '2.5rem', fontWeight: '950', margin: 0, color: 'white' }}>{wrapUpStats.drainedPct}%</h4>
                                                <span style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '4px' }}>{wrapUpStats.drainedCount} of {wrapUpStats.distTotal} logs</span>
                                            </div>

                                            {/* BOTTOM-RIGHT: CALM / CLEAR-HEADED */}
                                            <div className="matrix-quadrant quad-calm" style={{
                                                background: 'rgba(59, 130, 246, 0.02)',
                                                border: '1.5px solid rgba(59, 130, 246, 0.08)',
                                                borderRadius: '20px',
                                                padding: '2rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                textAlign: 'center',
                                                transition: 'all 0.3s ease',
                                                minHeight: '130px'
                                            }}>
                                                <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#3b82f6', letterSpacing: '0.15em', marginBottom: '6px' }}>CALM / CLEAR-HEADED</span>
                                                <h4 style={{ fontSize: '2.5rem', fontWeight: '950', margin: 0, color: 'white' }}>{wrapUpStats.calmPct}%</h4>
                                                <span style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '4px' }}>{wrapUpStats.calmCount} of {wrapUpStats.distTotal} logs</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* JOURNAL LOG timeline FEED */}
                                <div className="block-card" style={{ padding: '2.5rem 3rem' }}>
                                    <div style={{ marginBottom: '2.5rem' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '900', letterSpacing: '0.1em' }}>MICRO-JOURNAL HISTORY</h3>
                                        <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '2px' }}>
                                            Logged daily reflections and hashtags.
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        {wrapUpStats.filteredWrapUps.length === 0 ? (
                                            <div style={{ padding: '2.5rem', textAlign: 'center', opacity: 0.3, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                                                No micro-journal logs found in the selected date range.
                                            </div>
                                        ) : (
                                            [...wrapUpStats.filteredWrapUps].reverse().map((item, idx) => {
                                                const label = item.wrapUp.mood?.label;
                                                const badgeColor =
                                                    label === 'Flow / Inspired' ? '#06b6d4' :
                                                    label === 'Anxious / Frustrated' ? '#f97316' :
                                                    label === 'Calm / Clear-Headed' ? '#3b82f6' : '#9ca3af';

                                                return (
                                                    <div key={idx} style={{
                                                        padding: '1.5rem',
                                                        background: 'rgba(255,255,255,0.01)',
                                                        border: '1px solid rgba(255,255,255,0.04)',
                                                        borderRadius: '16px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.75rem'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                <span style={{ fontSize: '0.95rem', fontWeight: '900', color: 'white' }}>
                                                                    {new Date(item.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </span>
                                                                <span style={{
                                                                    padding: '3px 8px',
                                                                    borderRadius: '100px',
                                                                    fontSize: '0.55rem',
                                                                    fontWeight: '900',
                                                                    background: `${badgeColor}15`,
                                                                    color: badgeColor,
                                                                    border: `1px solid ${badgeColor}30`,
                                                                    letterSpacing: '0.05em'
                                                                }}>
                                                                    {label.toUpperCase()}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleEditWrapUpClick(item.date)}
                                                                    style={{
                                                                        background: 'none',
                                                                        color: '#d4a017',
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: '900',
                                                                        cursor: 'pointer',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        backgroundColor: 'rgba(212, 160, 23, 0.05)',
                                                                        border: '1px solid rgba(212, 160, 23, 0.15)',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = 'rgba(212, 160, 23, 0.15)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = 'rgba(212, 160, 23, 0.05)';
                                                                    }}
                                                                >
                                                                    ✏️ EDIT
                                                                </button>
                                                            </div>
                                                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
                                                                Tone: {item.wrapUp.mood?.x >= 0 ? '+' : ''}{item.wrapUp.mood?.x} | Energy: {item.wrapUp.mood?.y >= 0 ? '+' : ''}{item.wrapUp.mood?.y}
                                                            </div>
                                                        </div>

                                                        {item.wrapUp.journal ? (
                                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5' }}>
                                                                {item.wrapUp.journal}
                                                            </p>
                                                        ) : (
                                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                                                                No written reflection logged.
                                                            </p>
                                                        )}

                                                        {item.wrapUp.tags && item.wrapUp.tags.length > 0 && (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                                                {item.wrapUp.tags.map(tag => (
                                                                    <span key={tag} style={{
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: '800',
                                                                        color: '#d4a017',
                                                                        background: 'rgba(212, 160, 23, 0.05)',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid rgba(212, 160, 23, 0.15)'
                                                                    }}>
                                                                        #{tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* --- TAB 3: MISSION LOG --- */}
                        {activeTab === 'history' && (
                            <div className="block-card" style={{ padding: '3rem', marginTop: '1rem' }}>
                                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '900', letterSpacing: '0.1em' }}>MISSION LOG (HISTORY)</h3>
                                        <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '2px' }}>Detailed unique execution history across all goals</p>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {([
                                            { id: 'all', label: 'ALL' },
                                            { id: 'todo', label: '📋 TO-DOS' },
                                            { id: 'daily', label: '🔄 DAILIES' },
                                            { id: 'stopwatch', label: '⏱️ STOPWATCH' },
                                            { id: 'pomodoro', label: '⏳ POMODORO' }
                                        ] as const).map(f => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => setHistoryFilter(f.id)}
                                                style={{
                                                    background: historyFilter === f.id ? '#d4a017' : 'rgba(255, 255, 255, 0.03)',
                                                    border: historyFilter === f.id ? '1px solid #d4a017' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    color: historyFilter === f.id ? 'black' : 'rgba(255, 255, 255, 0.6)',
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.62rem',
                                                    fontWeight: '900',
                                                    letterSpacing: '0.03em',
                                                    transition: 'all 0.25s ease'
                                                }}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {filteredHistory.length === 0 ? (
                                        <div style={{ padding: '3rem 2rem', textAlign: 'center', opacity: 0.3, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '0.78rem' }}>
                                            No matching history entries found. Complete some missions to populate this log.
                                        </div>
                                    ) : (
                                        filteredHistory.map((entry, idx) => (
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
                                                                entry.sessionType === 'todo' ? 'rgba(6, 182, 212, 0.15)' :
                                                                entry.sessionType === 'daily' ? 'rgba(16, 185, 129, 0.15)' :
                                                                entry.sessionType === 'stopwatch' ? 'rgba(245, 158, 11, 0.15)' :
                                                                entry.sessionType === 'pomodoro' ? 'rgba(249, 115, 22, 0.15)' :
                                                                entry.type === 'active' ? '#d4a01720' : 
                                                                entry.type === 'daily' ? '#10b98120' : '#8b5cf620',
                                                            color: 
                                                                entry.sessionType === 'todo' ? '#06b6d4' :
                                                                entry.sessionType === 'daily' ? '#10b981' :
                                                                entry.sessionType === 'stopwatch' ? '#f59e0b' :
                                                                entry.sessionType === 'pomodoro' ? '#f97316' :
                                                                entry.type === 'active' ? '#d4a017' : 
                                                                entry.type === 'daily' ? '#10b981' : '#8b5cf6',
                                                            letterSpacing: '0.1em'
                                                        }}>
                                                            {entry.sessionType === 'todo' ? 'TO DO TASK' :
                                                             entry.sessionType === 'daily' ? 'DAILY HABIT' :
                                                             entry.sessionType === 'stopwatch' ? 'STOPWATCH' :
                                                             entry.sessionType === 'pomodoro' ? 'POMODORO' :
                                                             entry.type === 'active' ? 'ACTIVE MISSION' : 
                                                             entry.type === 'daily' ? 'DAILY' : 'ONE-OFF'}
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

                        {/* --- TAB 4: HEALTH & SLEEP --- */}
                        {activeTab === 'health' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', marginTop: '1rem' }}>
                                
                                {/* HEALTH SUMMARY CARDS */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                                    <div className="block-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #06b6d4' }}>
                                        <span style={{ fontSize: '0.6rem', fontWeight: '900', letterSpacing: '0.1em', opacity: 0.4 }}>AVERAGE SLEEP</span>
                                        <h4 style={{ fontSize: '1.8rem', fontWeight: '950', margin: 0, color: 'white' }}>{healthStats.avgSleepHours}h</h4>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: 0 }}>With quality: <strong style={{ color: '#06b6d4' }}>{healthStats.avgSleepQuality} / 5 ★</strong></p>
                                    </div>
                                    <div className="block-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #10b981' }}>
                                        <span style={{ fontSize: '0.6rem', fontWeight: '900', letterSpacing: '0.1em', opacity: 0.4 }}>ENERGY LEVEL</span>
                                        <h4 style={{ fontSize: '1.8rem', fontWeight: '950', margin: 0, color: 'white' }}>{healthStats.avgEnergy} / 5</h4>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: 0 }}>Average physical vitality score</p>
                                    </div>
                                    <div className="block-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #8b5cf6' }}>
                                        <span style={{ fontSize: '0.6rem', fontWeight: '900', letterSpacing: '0.1em', opacity: 0.4 }}>WORKOUT CONSISTENCY</span>
                                        <h4 style={{ fontSize: '1.8rem', fontWeight: '950', margin: 0, color: 'white' }}>{healthStats.workoutConsistency}%</h4>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: 0 }}>Of logged days completed</p>
                                    </div>
                                    <div className="block-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #ef4444' }}>
                                        <span style={{ fontSize: '0.6rem', fontWeight: '900', letterSpacing: '0.1em', opacity: 0.4 }}>PAIN & DISCOMFORT</span>
                                        <h4 style={{ fontSize: '1.8rem', fontWeight: '950', margin: 0, color: 'white' }}>{healthStats.avgPain} / 5</h4>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: 0 }}>Lower is better</p>
                                    </div>
                                </div>

                                {/* SLEEP TRENDS & ENERGY PATTERNS CHARTS */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
                                    
                                    {/* Sleep Hours Trend SVG */}
                                    <div className="block-card" style={{ padding: '2rem', minHeight: '320px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                            <div>
                                                <h4 style={{ fontSize: '0.85rem', fontWeight: '900', letterSpacing: '0.05em', color: 'white' }}>SLEEP HOURS TREND</h4>
                                                <p style={{ fontSize: '0.7rem', opacity: 0.4, margin: '2px 0 0' }}>Daily duration & quality rating over time</p>
                                            </div>
                                        </div>

                                        <div style={{ position: 'relative', width: '100%', height: '200px' }}>
                                            <svg viewBox="0 0 500 200" width="100%" height="100%" preserveAspectRatio="none">
                                                <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                                                <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                                                <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                                                
                                                {(() => {
                                                    const dataPoints = filteredDates.map((date, idx) => {
                                                        const chat = allChats[date];
                                                        const hrs = chat?.sleep?.hours ?? 0;
                                                        const x = (idx / Math.max(1, filteredDates.length - 1)) * 500;
                                                        const y = 200 - (hrs / 12) * 180;
                                                        return { x, y, logged: !!chat?.sleep };
                                                    }).filter(p => p.logged);

                                                    if (dataPoints.length < 2) return null;
                                                    
                                                    const pathD = `M ${dataPoints[0].x} ${dataPoints[0].y} ` + dataPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
                                                    return (
                                                        <>
                                                            <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
                                                            {dataPoints.map((p, i) => (
                                                                <circle key={i} cx={p.x} cy={p.y} r="4" fill="#0f0f0f" stroke="#06b6d4" strokeWidth="2" />
                                                            ))}
                                                        </>
                                                    );
                                                })()}
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Physical Vitality & Pain SVG */}
                                    <div className="block-card" style={{ padding: '2rem', minHeight: '320px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                            <div>
                                                <h4 style={{ fontSize: '0.85rem', fontWeight: '900', letterSpacing: '0.05em', color: 'white' }}>PHYSICAL ENERGY PATTERNS</h4>
                                                <p style={{ fontSize: '0.7rem', opacity: 0.4, margin: '2px 0 0' }}>Daily physical energy level (1-5)</p>
                                            </div>
                                        </div>

                                        <div style={{ position: 'relative', width: '100%', height: '200px' }}>
                                            <svg viewBox="0 0 500 200" width="100%" height="100%" preserveAspectRatio="none">
                                                <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                                                <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                                                <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                                                {(() => {
                                                    const count = filteredDates.length;
                                                    const barWidth = Math.max(2, 500 / count - 6);
                                                    return filteredDates.map((date, idx) => {
                                                        const chat = allChats[date];
                                                        const energy = chat?.physical?.energy ?? 0;
                                                        const x = (idx / Math.max(1, count - 1)) * 480 + 10;
                                                        const barHeight = (energy / 5) * 160;
                                                        const y = 200 - barHeight;
                                                        
                                                        if (!chat?.physical) return null;
                                                        return (
                                                            <rect
                                                                key={idx}
                                                                x={x}
                                                                y={y}
                                                                width={barWidth}
                                                                height={barHeight}
                                                                fill="url(#energyGrad)"
                                                                rx="2"
                                                            />
                                                        );
                                                    });
                                                })()}
                                                <defs>
                                                    <linearGradient id="energyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#10b981" />
                                                        <stop offset="100%" stopColor="#10b98110" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* FOCUS CORRELATIONS PANEL */}
                                <div className="block-card" style={{ padding: '2rem' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: '900', letterSpacing: '0.05em', color: 'white', marginBottom: '1.5rem' }}>HEALTH-TO-FOCUS CORRELATION ANALYTICS</h4>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
                                        {/* Sleep to Focus */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.5 }}>Sleep Quality vs. Daily Focus Hours</span>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                    <span>On High Quality Sleep Days (★ 4-5)</span>
                                                    <strong style={{ color: '#06b6d4' }}>{healthStats.highSleepFocus} hrs avg</strong>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                    <span>On Low Quality Sleep Days (★ 1-2)</span>
                                                    <strong style={{ color: 'rgba(255,255,255,0.4)' }}>{healthStats.lowSleepFocus} hrs avg</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Energy to Focus */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.5 }}>Physical Energy Level vs. Daily Focus Hours</span>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                    <span>On High Energy Days (4-5)</span>
                                                    <strong style={{ color: '#10b981' }}>{healthStats.highEnergyFocus} hrs avg</strong>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                    <span>On Low Energy Days (1-2)</span>
                                                    <strong style={{ color: 'rgba(255,255,255,0.4)' }}>{healthStats.lowEnergyFocus} hrs avg</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* DAY-BY-DAY LIST FOR METRIC REVIEWS */}
                                <div className="block-card" style={{ padding: '2rem' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: '900', letterSpacing: '0.05em', color: 'white', marginBottom: '1.5rem' }}>DAILY METRICS LOG & REVIEWS</h4>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {filteredDates.map(date => {
                                            const chat = allChats[date];
                                            if (!chat) return null;

                                            return (
                                                <div key={date} className="history-entry" style={{
                                                    padding: '1rem',
                                                    background: 'rgba(255,255,255,0.01)',
                                                    borderRadius: '12px',
                                                    border: '1px solid rgba(255,255,255,0.04)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: '900', color: 'white' }}>{date}</span>
                                                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                                            Sleep: <strong style={{ color: '#06b6d4' }}>{chat.sleep ? `${chat.sleep.hours}h (${chat.sleep.rating}★)` : 'N/A'}</strong>
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                                            Energy: <strong style={{ color: '#10b981' }}>{chat.physical ? `${chat.physical.energy}/5` : 'N/A'}</strong>
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                                            Workout: <strong style={{ color: '#8b5cf6' }}>{chat.physical ? (chat.physical.workout ? 'YES' : 'NO') : 'N/A'}</strong>
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => handleEditWrapUpClick(date)}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.04)',
                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                            color: 'white',
                                                            borderRadius: '8px',
                                                            padding: '6px 14px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: '900',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        EDIT DATA
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
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
                .matrix-quadrant:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
                }
                .quad-anxious:hover {
                    border-color: rgba(249, 115, 22, 0.3) !important;
                    background: rgba(249, 115, 22, 0.04) !important;
                }
                .quad-flow:hover {
                    border-color: rgba(6, 182, 212, 0.3) !important;
                    background: rgba(6, 182, 212, 0.04) !important;
                }
                .quad-drained:hover {
                    border-color: rgba(156, 163, 175, 0.3) !important;
                    background: rgba(156, 163, 175, 0.04) !important;
                }
                .quad-calm:hover {
                    border-color: rgba(59, 130, 246, 0.3) !important;
                    background: rgba(59, 130, 246, 0.04) !important;
                }
                .insight-card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .insight-card:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 20px rgba(255,255,255,0.01);
                }
            `}</style>

            <SleepModal
                open={trackingStep === 'sleep'}
                onClose={() => {
                    setTrackingStep(null);
                    setEditingDate(null);
                }}
                onSave={handleSaveSleep}
                initialData={editingDate ? allChats[editingDate]?.sleep : undefined}
                dateLabel={editingDate || undefined}
            />
            <PhysicalHealthModal
                open={trackingStep === 'physical'}
                onClose={() => {
                    setTrackingStep(null);
                    setEditingDate(null);
                }}
                onSave={handleSavePhysical}
                initialData={editingDate ? allChats[editingDate]?.physical : undefined}
                dateLabel={editingDate || undefined}
            />
            <WrapUpModal
                open={trackingStep === 'mental'}
                onClose={() => {
                    setTrackingStep(null);
                    setEditingDate(null);
                }}
                onSave={handleSaveWrapUp}
                initialData={editingDate ? allChats[editingDate]?.wrapUp : undefined}
                dateLabel={editingDate || undefined}
            />
        </main>
    );
}
