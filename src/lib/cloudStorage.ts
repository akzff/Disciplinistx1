import { supabase } from './supabase';
import { DailyChat, UserPreferences } from './storage';

// ─── Cloud sync layer that talks directly to Supabase ──────────────────────

export const cloudStorage = {

    // ── Chats ──────────────────────────────────────────────────────────────

    getAllChats: async (): Promise<Record<string, DailyChat>> => {
        const { data, error } = await supabase
            .from('disciplinist_daily_chats')
            .select('date, data')
            .order('date', { ascending: false });

        if (error) { console.error('Cloud fetch chats error:', error); return {}; }

        const result: Record<string, DailyChat> = {};
        (data || []).forEach((row) => {
            result[row.date] = row.data as DailyChat;
        });
        return result;
    },

    getChat: async (date: string): Promise<DailyChat | null> => {
        const { data, error } = await supabase
            .from('disciplinist_daily_chats')
            .select('data')
            .eq('date', date)
            .maybeSingle();

        if (error) { console.error('Cloud fetch chat error:', error); return null; }
        return data ? (data.data as DailyChat) : null;
    },

    saveChat: async (date: string, chatData: Partial<DailyChat>): Promise<void> => {
        // Upsert: load existing then merge
        const existing = await cloudStorage.getChat(date);
        const defaults: DailyChat = {
            date,
            messages: [],
            status: 'OPEN',
            activeTasks: [],
            distractions: [],
            todos: [],
            dailies: [],
            expenses: []
        };
        const merged = { ...(existing || defaults), ...chatData };

        const { error } = await supabase
            .from('disciplinist_daily_chats')
            .upsert({ date, data: merged }, { onConflict: 'user_id,date' });

        if (error) console.error('Cloud save chat error:', error);
    },

    closeChat: async (date: string): Promise<void> => {
        await cloudStorage.saveChat(date, { status: 'CLOSED' });
    },

    // ── Preferences ────────────────────────────────────────────────────────

    getPreferences: async (): Promise<UserPreferences | null> => {
        const { data, error } = await supabase
            .from('disciplinist_preferences')
            .select('data')
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
};
