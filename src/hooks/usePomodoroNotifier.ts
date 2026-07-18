'use client';

import { useEffect, useRef } from 'react';
import { DailyChat, UserPreferences } from '@/lib/storage';
import { storage } from '@/lib/storage';

/**
 * usePomodoroNotifier
 *
 * Runs at the ROOT level (inside DataProvider) so it stays alive on every
 * page. It polls `allChats` once per second, finds any RUNNING Pomodoro task
 * and fires a browser notification the moment:
 *   1. A focus cycle completes  (activeTime >= duration)
 *   2. A break timer finishes   (stored as breakEndsAt timestamp in chat)
 *
 * It deduplicates notifications with refs so only one fires per event.
 */
export function usePomodoroNotifier(
    allChats: Record<string, DailyChat>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _preferences: UserPreferences | null
) {
    // Track which task IDs + cycle count we already notified for focus completion
    const notifiedFocusRef = useRef<Set<string>>(new Set());
    // Track which breakEndsAt timestamps we already notified for break end
    const notifiedBreakRef = useRef<Set<number>>(new Set());
    // Keep a ref to allChats so the interval always reads the latest value
    const allChatsRef = useRef(allChats);
    allChatsRef.current = allChats;

    useEffect(() => {
        // Request permission on first mount (safe to call multiple times)
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (
                Notification.permission !== 'granted' &&
                Notification.permission !== 'denied'
            ) {
                Notification.requestPermission();
            }
        }
    }, []);

    useEffect(() => {
        const sendNotif = (title: string, body: string) => {
            if (typeof window === 'undefined' || !('Notification' in window)) return;
            if (Notification.permission === 'granted') {
                try {
                    new Notification(title, {
                        body,
                        icon: '/favicon.ico',
                        tag: 'pomodoro', // replaces previous notif instead of stacking
                        requireInteraction: false,
                    });
                } catch {
                    // Notifications unavailable — silent fail
                }
            }
        };

        const check = () => {
            const today = storage.getCurrentDate();
            const todayChat = allChatsRef.current[today] as DailyChat & { breakEndsAt?: number };
            if (!todayChat) return;

            const now = Date.now();

            // ── Focus cycle detection ──────────────────────────────────────
            for (const task of todayChat.activeTasks || []) {
                if (task.status !== 'RUNNING') continue;
                if (task.sessionState === 'BREAK') continue;
                if (task.sessionType !== 'pomodoro') continue;

                const duration = task.duration;
                if (!duration || duration === 0) continue;

                const activeTime =
                    (task.totalActiveTime || 0) +
                    Math.max(0, now - (task.lastStartedAt || task.startTime || now));

                // Use task.id + cycle count as dedup key so new cycles work correctly
                const notifKey = `${task.id}_cycle${task.completedCycles || 0}`;
                if (activeTime >= duration && !notifiedFocusRef.current.has(notifKey)) {
                    notifiedFocusRef.current.add(notifKey);
                    const taskName = task.name.split(' - ')[1] || task.name;
                    sendNotif(
                        '⏰ Focus Cycle Complete!',
                        `"${taskName}" focus session is done. Time for a break!`
                    );
                }
            }

            // ── Break end detection ────────────────────────────────────────
            const breakEndsAt = todayChat.breakEndsAt;
            if (breakEndsAt && breakEndsAt > 0 && now >= breakEndsAt) {
                if (!notifiedBreakRef.current.has(breakEndsAt)) {
                    notifiedBreakRef.current.add(breakEndsAt);
                    sendNotif('☕ Break Over!', 'Time to focus and crush your goals.');
                }
            }
        };

        // Check immediately, then every second
        check();
        const interval = setInterval(check, 1000);
        return () => clearInterval(interval);
    // Only re-subscribe if nothing changes — allChats updates via the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
