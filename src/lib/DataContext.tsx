'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { DailyChat, UserPreferences, storage } from '@/lib/storage';
import { cloudStorage } from '@/lib/cloudStorage';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';

interface DataContextType {
    allChats: Record<string, DailyChat>;
    preferences: UserPreferences | null;
    isLoadingData: boolean;
    refreshData: () => Promise<void>;
    updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
    setLocalChat: (date: string, chatData: Partial<DailyChat>) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
    const { userId } = useClerkAuth();
    const { user } = useUser();
    // Sudden loading: Start with local storage immediately if available
    const [allChats, setAllChats] = useState<Record<string, DailyChat>>(() => {
        if (typeof window !== 'undefined') return storage.getChats();
        return {};
    });
    const [preferences, setPreferences] = useState<UserPreferences | null>(() => {
        if (typeof window !== 'undefined') return storage.getUserPreferences();
        return null;
    });
    const [isLoadingData, setIsLoadingData] = useState(false); // No longer blocks by default

    const refreshData = useCallback(async () => {
        if (!userId) return;

        try {
            console.log("Sudden data sync starting for user:", userId);

            // Fetch in background
            const [fetchedChats, fetchedPrefs] = await Promise.all([
                cloudStorage.getAllChats(userId, 30),
                cloudStorage.getPreferences(userId)
            ]) as [Record<string, DailyChat>, UserPreferences | null];

            // UI Refresh: Merge cloud data into local state carefully
            setAllChats(prev => {
                const merged = { ...prev };
                if (fetchedChats) {
                    Object.entries(fetchedChats).forEach(([date, cloudChat]) => {
                        const localChat = prev[date];
                        if (!localChat) {
                            merged[date] = cloudChat;
                        } else {
                            // Merge logic: If cloud has more messages, it's likely newer from another device
                            // We prefer cloud version but preserve local if it looks significantly different
                            const cloudMsgCount = cloudChat.messages?.length || 0;
                            const localMsgCount = localChat.messages?.length || 0;

                            if (cloudMsgCount >= localMsgCount) {
                                merged[date] = cloudChat;
                            }
                        }
                    });
                }
                return merged;
            });
            if (fetchedPrefs) setPreferences(fetchedPrefs);

            // Background migration
            setTimeout(async () => {
                const localChats = storage.getChats();
                const hasLocalData = Object.keys(localChats).length > 0;
                const hasCloudData = fetchedChats && Object.keys(fetchedChats).length > 0;

                if (hasLocalData && !hasCloudData) {
                    const migrationPromises = Object.entries(localChats).map(([date, lChat]) =>
                        cloudStorage.saveChat(date, lChat, userId)
                    );
                    await Promise.all(migrationPromises);
                }

                if (!fetchedPrefs && preferences) {
                    cloudStorage.savePreferences(preferences, userId);
                }
            }, 100);

        } catch (err) {
            console.error('Background sync failed:', err);
        }
    }, [userId, preferences]);

    useEffect(() => {
        refreshData();
    }, [userId, refreshData]);

    const updatePreferences = async (updates: Partial<UserPreferences>) => {
        const newPrefs = { ...(preferences || storage.getUserPreferences()), ...updates };
        setPreferences(newPrefs);
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
            storage.saveChat(date, chatData);
            return updated;
        });
    }, []);

    return (
        <DataContext.Provider value={{ allChats, preferences, isLoadingData, refreshData, updatePreferences, setLocalChat }}>
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
