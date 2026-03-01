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
    refreshData: () => Promise<{ success: boolean; message: string; syncedItems: number }>;
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

    const refreshData = useCallback(async (): Promise<{ success: boolean; message: string; syncedItems: number }> => {
        if (!userId) return { success: false, message: 'No user logged in', syncedItems: 0 };

        try {
            console.log("Manual sync starting for user:", userId);

            // Fetch in background - no limit for full sync
            const [fetchedChats, fetchedPrefs] = await Promise.all([
                cloudStorage.getAllChats(userId),
                cloudStorage.getPreferences(userId)
            ]) as [Record<string, DailyChat>, UserPreferences | null];

            let syncedItems = 0;
            const previousChatCount = Object.keys(allChats).length;

            // UI Refresh: Merge cloud data into local state carefully
            setAllChats(prev => {
                const merged = { ...prev };
                if (fetchedChats) {
                    Object.entries(fetchedChats).forEach(([date, cloudChat]) => {
                        const localChat = prev[date];
                        if (!localChat) {
                            merged[date] = cloudChat;
                            syncedItems++;
                        } else {
                            // Merge logic: If cloud has more messages, it's likely newer from another device
                            const cloudMsgCount = cloudChat.messages?.length || 0;
                            const localMsgCount = localChat.messages?.length || 0;

                            if (cloudMsgCount >= localMsgCount) {
                                merged[date] = cloudChat;
                                syncedItems++;
                            }
                        }
                    });
                }
                return merged;
            });
            
            if (fetchedPrefs) {
                setPreferences(fetchedPrefs);
                syncedItems++;
            }

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

            const finalChatCount = Object.keys(fetchedChats || {}).length;
            const message = syncedItems > 0 
                ? `Synced ${syncedItems} items (${finalChatCount} chats, preferences: ${!!fetchedPrefs})`
                : 'No new data to sync';

            return { success: true, message, syncedItems };

        } catch (err) {
            console.error('Manual sync failed:', err);
            return { success: false, message: `Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`, syncedItems: 0 };
        }
    }, [userId, preferences, allChats]);

    useEffect(() => {
        if (!userId) return;

        const syncInterval = setInterval(() => {
            console.log("Periodic sync triggered for user:", userId);
            refreshData();
        }, 30000); // Sync every 30 seconds

        return () => clearInterval(syncInterval);
    }, [userId, refreshData]);

    useEffect(() => {
        setIsLoadingData(true);
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
