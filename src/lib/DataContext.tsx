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
    const [allChats, setAllChats] = useState<Record<string, DailyChat>>({});
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const refreshData = useCallback(async () => {
        if (!userId) {
            setIsLoadingData(false);
            return;
        }

        try {
            console.log("Starting FAST data sync for user:", userId);
            
            // Parallel data fetching - all requests start at once
            const dataPromises = [
                cloudStorage.getAllChats(userId),
                cloudStorage.getPreferences(userId)
            ];

            // Wait for all data to arrive in parallel
            const [fetchedChats, fetchedPrefs] = await Promise.all(dataPromises) as [
                Record<string, DailyChat>,
                UserPreferences | null
            ];

            // Set initial state immediately for better UX
            setAllChats(fetchedChats);
            setPreferences(fetchedPrefs);
            setIsLoadingData(false);

            // Process data in background (non-blocking)
            setTimeout(async () => {
                // ─── Legacy Migration Logic ──────────────────────────────────────────
                // If the user has local data (e.g. they just logged in or guest mode before)
                // that is NOT in the cloud, we merge it up.
                const localChats = storage.getChats();
                const migrating = { ...fetchedChats };

                // Only migrate if there's local data not in cloud
                const hasLocalData = Object.keys(localChats).length > 0;
                const hasCloudData = fetchedChats && Object.keys(fetchedChats).length > 0;
                
                if (hasLocalData && !hasCloudData) {
                    console.log("Migrating local data to cloud...");
                    
                    // Batch migrate local data
                    const migrationPromises = Object.entries(localChats).map(([date, lChat]) => {
                        if (!fetchedChats || !fetchedChats[date]) {
                            console.log(`Migrating legacy local data to cloud for date: ${date}`);
                            return cloudStorage.saveChat(date, lChat, userId);
                        }
                        return Promise.resolve();
                    });
                    
                    // Wait for migration to complete
                    await Promise.all(migrationPromises);
                }

                // Update state with processed data
                setAllChats(migrating);

                // Preferences migration
                const finalPrefs = fetchedPrefs || storage.getUserPreferences();
                setPreferences(finalPrefs);
                if (!fetchedPrefs) {
                    cloudStorage.savePreferences(finalPrefs, userId);
                }

                console.log("Data sync completed:", {
                    chatsCount: Object.keys(migrating).length,
                    hasPreferences: !!finalPrefs,
                    hasLocalData,
                    hasCloudData
                });
            }, 100);

        } catch (err) {
            console.error('Data sync error:', err);
            // Fallback to local storage if cloud fails
            setAllChats(storage.getChats());
            setPreferences(storage.getUserPreferences());
            setIsLoadingData(false);
        }
    }, [userId]);

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
            // Also sync to localStorage as secondary backup for extreme consistency
            storage.saveChat(date, chatData);
            return updated;
        });
    }, []);

    if (isLoadingData) {
        return (
            <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: '#050505', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1, background: 'radial-gradient(circle at 20% 30%, #1e1b4b 0%, transparent 50%), radial-gradient(circle at 80% 70%, #312e81 0%, transparent 50%)', filter: 'blur(80px)', opacity: 0.5 }}></div>
                <div style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.5))' }}>⚡</div>
                <p style={{ fontSize: '0.75rem', opacity: 0.4, letterSpacing: '0.15em', fontWeight: '700' }}>SYNCING RESOURCES...</p>
            </main>
        );
    }

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
