'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { DailyChat, UserPreferences, storage } from '@/lib/storage';
import { cloudStorage } from '@/lib/cloudStorage';
import { useAuth } from '@/lib/AuthContext';

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
    const { user } = useAuth();
    const [allChats, setAllChats] = useState<Record<string, DailyChat>>({});
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const refreshData = useCallback(async () => {
        if (!user) {
            setIsLoadingData(false);
            return;
        }
        try {
            const [fetchedChats, fetchedPrefs] = await Promise.all([
                cloudStorage.getAllChats(),
                cloudStorage.getPreferences()
            ]);

            setAllChats(fetchedChats);
            // For new users or if cloud fails, use empty defaults to ensure isolation
            setPreferences(fetchedPrefs || {
                name: 'Disciple',
                bio: '',
                pfp: '',
                dayVision: '',
                dailyModel: '', // DETAILED DAILY MODEL - empty for new users
                ambition: '', // YOUR MOTIVATION - empty for new users
                mentorLevel: 1,
                habitNotes: [],
                selectedModel: 'qwen/qwen3-32b'
            });
        } catch (error) {
            console.error("Failed to load global data:", error);
        } finally {
            setIsLoadingData(false);
        }
    }, [user]);

    useEffect(() => {
        setIsLoadingData(true);
        refreshData();
    }, [refreshData]);

    const updatePreferences = async (updates: Partial<UserPreferences>) => {
        const newPrefs = { ...(preferences || storage.getUserPreferences()), ...updates };
        setPreferences(newPrefs);
        await cloudStorage.savePreferences(newPrefs);
    };

    const setLocalChat = useCallback((date: string, chatData: Partial<DailyChat>) => {
        setAllChats(prev => ({
            ...prev,
            [date]: { ...prev[date], ...chatData } as DailyChat
        }));
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
