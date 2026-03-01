import { supabase } from './supabase';
import { DailyChat, UserPreferences } from './storage';

// ─── Cloud sync layer that talks directly to Supabase ──────────────────────

export const cloudStorage = {

    // ── Chats ──────────────────────────────────────────────────────────────

    getAllChats: async (): Promise<Record<string, DailyChat>> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return {};

        const { data, error } = await supabase
            .from('disciplinist_daily_chats')
            .select('date, data')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (error) { console.error('Cloud fetch chats error:', error); return {}; }

        const result: Record<string, DailyChat> = {};
        (data || []).forEach((row) => {
            result[row.date] = row.data as DailyChat;
        });

        // Verify data integrity
        const totalTodos = Object.values(result).reduce((sum, chat) => sum + (chat.todos?.length || 0), 0);
        const totalDailies = Object.values(result).reduce((sum, chat) => sum + (chat.dailies?.length || 0), 0);
        console.log('Cloud fetch successful:', {
            chatsCount: Object.keys(result).length,
            totalTodos,
            totalDailies,
            dates: Object.keys(result)
        });

        return result;
    },

    getChat: async (date: string): Promise<DailyChat | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('disciplinist_daily_chats')
            .select('data')
            .eq('date', date)
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) { console.error('Cloud fetch chat error:', error); return null; }
        return data ? (data.data as DailyChat) : null;
    },

    saveChat: async (date: string, chatData: Partial<DailyChat>): Promise<void> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Smart merge: load existing then merge – but ONLY if chatData is partial
        // If chatData contains critical arrays like todos/dailies, we favor it as the current state
        const isFullState = !!(chatData.todos && chatData.dailies && chatData.messages);

        let merged: DailyChat;
        if (isFullState) {
            // If it's a full state, we only need to preserve fields NOT in the payload (like artifactUrl if not provided)
            const existing = await cloudStorage.getChat(date);
            merged = {
                date,
                messages: [], status: 'OPEN', activeTasks: [], distractions: [], todos: [], dailies: [], expenses: [],
                ...(existing || {}),
                ...(chatData as any)
            };
        } else {
            const existing = await cloudStorage.getChat(date);
            const defaults: DailyChat = {
                date,
                messages: [], status: 'OPEN', activeTasks: [], distractions: [], todos: [], dailies: [], expenses: []
            };
            merged = { ...(existing || defaults), ...chatData };
        }

        const { error } = await supabase
            .from('disciplinist_daily_chats')
            .upsert({ user_id: user.id, date, data: merged }, { onConflict: 'user_id,date' });

        if (error) {
            console.error('Cloud save chat error:', error);
        } else {
            console.log(`Cloud saved successfully: ${date} (${merged.todos?.length || 0} todos, ${merged.dailies?.length || 0} dailies)`);
        }
    },

    closeChat: async (date: string): Promise<void> => {
        await cloudStorage.saveChat(date, { status: 'CLOSED' });
    },

    // ── Preferences ────────────────────────────────────────────────────────

    getPreferences: async (): Promise<UserPreferences | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('disciplinist_preferences')
            .select('data')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) { console.error('Cloud fetch prefs error:', error); return null; }
        return data ? (data.data as UserPreferences) : null;
    },

    savePreferences: async (prefs: UserPreferences): Promise<void> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('disciplinist_preferences')
            .upsert({ user_id: user.id, data: prefs }, { onConflict: 'user_id' });

        if (error) console.error('Cloud save prefs error:', error);
    },

    // ── Data Verification ─────────────────────────────────────────────────────

    verifyDataIntegrity: async (): Promise<{ status: 'ok' | 'error', details: any }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { status: 'error', details: 'No user authenticated' };

        try {
            // Test fetch all data
            const allData = await cloudStorage.getAllChats();
            const today = new Date().toISOString().split('T')[0];
            const todayData = allData[today];

            const verification = {
                status: 'ok' as const,
                details: {
                    user: user.id,
                    totalChats: Object.keys(allData).length,
                    todayDataExists: !!todayData,
                    todayTodos: todayData?.todos?.length || 0,
                    todayDailies: todayData?.dailies?.length || 0,
                    allTodos: Object.values(allData).reduce((sum, chat) => sum + (chat.todos?.length || 0), 0),
                    allDailies: Object.values(allData).reduce((sum, chat) => sum + (chat.dailies?.length || 0), 0),
                    datesWithData: Object.keys(allData)
                }
            };

            console.log('Data integrity verification:', verification);
            return verification;
        } catch (error) {
            return {
                status: 'error' as const,
                details: error instanceof Error ? error.message : String(error)
            };
        }
    }
};
