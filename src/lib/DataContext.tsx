'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { DailyChat, UserPreferences, storage } from '@/lib/storage';
import { cloudStorage } from '@/lib/cloudStorage';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';
import { useDeviceHeartbeat } from '@/hooks/useDeviceHeartbeat';

interface DataContextType {
    allChats: Record<string, DailyChat>;
    preferences: UserPreferences | null;
    isCloudSynced: boolean;
    refreshData: () => Promise<void>;
    updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
    setLocalChat: (date: string, chatData: Partial<DailyChat>) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (open: boolean) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
    const { userId } = useClerkAuth();
    const { user } = useUser();

    // Start EMPTY — cloud is the source of truth.
    // localStorage is only a write-through cache, never the initial source.
    const [allChats, setAllChats] = useState<Record<string, DailyChat>>({});
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [isCloudSynced, setIsCloudSynced] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Run device heartbeat on every page automatically
    useDeviceHeartbeat(user?.id);

    const normalizePrefs = (prefs: UserPreferences): UserPreferences => {
        const normalized = { ...prefs };
        if (!normalized.persona && normalized.mentorLevel) {
            normalized.persona = normalized.mentorLevel === 1 ? 'friend' : normalized.mentorLevel === 2 ? 'monk' : 'disciplinist';
        }
        if (normalized.inspirationQuotes === undefined) {
            normalized.inspirationQuotes = '';
        }
        return normalized;
    };

    const refreshData = useCallback(async () => {
        if (!userId) return;

        try {
            console.log('☁️ Cloud-first sync starting for user:', userId);
            setIsCloudSynced(false);

            // Step 1: Run one-time migration of old localStorage data up to cloud
            const migrationKey = `disciplinist_migrated_v2_${userId}`;
            if (typeof window !== 'undefined' && !localStorage.getItem(migrationKey)) {
                console.log('🔄 Running one-time local→cloud migration...');
                const localChats = storage.getChats(); // No userId to get old data
                const hasLocalData = Object.keys(localChats).length > 0;
                if (hasLocalData) {
                    await Promise.all(
                        Object.entries(localChats).map(([date, chat]) =>
                            cloudStorage.saveChat(date, chat, userId)
                        )
                    );
                    console.log(`✅ Migrated ${Object.keys(localChats).length} local chats to cloud`);
                }
                const localPrefs = storage.getUserPreferences();
                if (localPrefs?.name && localPrefs.name !== 'Disciple') {
                    await cloudStorage.savePreferences(localPrefs, userId);
                    console.log('✅ Migrated local preferences to cloud');
                }
                localStorage.setItem(migrationKey, 'true');
            }

            // Step 2: Fetch cloud data — ALWAYS. This is the source of truth.
            const [fetchedChats, fetchedPrefs] = await Promise.all([
                cloudStorage.getAllChats(userId, 30),
                cloudStorage.getPreferences(userId)
            ]) as [Record<string, DailyChat>, UserPreferences | null];

            // Step 3: Cloud data WINS — replace state entirely (not merge into local)
            if (fetchedChats && Object.keys(fetchedChats).length > 0) {
                setAllChats(fetchedChats);
                // Write-through cache: update localStorage so next load is fast
                Object.entries(fetchedChats).forEach(([date, chat]) => {
                    storage.saveChat(date, chat, userId);
                });
                console.log(`✅ Loaded ${Object.keys(fetchedChats).length} chats from CLOUD`);
            } else {
                // Cloud empty — load from local as fallback, push up to cloud
                const localChats = storage.getChats(userId);
                if (Object.keys(localChats).length > 0) {
                    setAllChats(localChats);
                    // Push local up to cloud silently
                    Promise.all(
                        Object.entries(localChats).map(([date, chat]) =>
                            cloudStorage.saveChat(date, chat, userId)
                        )
                    );
                    console.log('📤 No cloud data — pushed local data to cloud');
                }
            }

            if (fetchedPrefs) {
                const normalized = normalizePrefs(fetchedPrefs);
                setPreferences(normalized);
                storage.saveUserPreferences(normalized, userId);
                console.log('✅ Preferences loaded from CLOUD');
            } else {
                // Fallback to local prefs
                const localPrefs = storage.getUserPreferences(userId);
                setPreferences(localPrefs);
            }

        } catch (err) {
            console.error('Cloud sync failed — falling back to localStorage:', err);
            // Only use localStorage when cloud is genuinely unreachable
            const localChats = storage.getChats(userId);
            const localPrefs = storage.getUserPreferences(userId);
            if (Object.keys(localChats).length > 0) setAllChats(localChats);
            setPreferences(localPrefs);
        } finally {
            // Mark cloud sync complete either way — page can now initialize
            setIsCloudSynced(true);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) {
            refreshData();
        }
    }, [userId, refreshData]);

    const updatePreferences = async (updates: Partial<UserPreferences>) => {
        const base = preferences || storage.getUserPreferences(userId || undefined);
        const newPrefs = { ...base, ...updates };
        setPreferences(newPrefs);
        storage.saveUserPreferences(newPrefs, userId || undefined);
        if (userId) {
            await cloudStorage.savePreferences(newPrefs, userId);
        }
    };

    const setLocalChat = useCallback((date: string, chatData: Partial<DailyChat>) => {
        setAllChats(prev => {
            const updated = {
                ...prev,
                [date]: { ...prev[date], ...chatData } as DailyChat
            };
            storage.saveChat(date, chatData, userId || undefined);
            return updated;
        });
    }, [userId]);

    return (
        <DataContext.Provider value={{
            allChats,
            preferences,
            isCloudSynced,
            refreshData,
            updatePreferences,
            setLocalChat,
            isSettingsOpen,
            setIsSettingsOpen
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
