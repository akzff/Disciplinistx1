import { supabase } from './supabase';
import { DailyChat, UserPreferences } from './storage';

// Helper function to get current user ID from Clerk
// Note: This function should only be called with userId parameter from React components
async function getCurrentUserId(userId?: string): Promise<string | null> {
    // Return the provided userId or null
    return userId || null;
}

// ─── Cloud sync layer that talks directly to Supabase with Clerk auth ──────────────────────

export const cloudStorage = {

    // ── Chats ──────────────────────────────────────────────────────────────

    getAllChats: async (userId?: string, limit?: number): Promise<Record<string, DailyChat>> => {
        const currentUserId = userId;
        if (!currentUserId) return {};

        let query = supabase
            .from('disciplinist_daily_chats')
            .select('date, data')
            .eq('user_id', currentUserId)
            .order('date', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) { console.error('Cloud fetch chats error:', error); return {}; }

        const result: Record<string, DailyChat> = {};
        (data || []).forEach((row) => {
            result[row.date] = row.data as DailyChat;
        });

        console.log('Cloud fetch successful:', {
            chatsCount: Object.keys(result).length,
            limitApplied: !!limit
        });

        return result;
    },

    getChat: async (date: string, userId?: string): Promise<DailyChat | null> => {
        const currentUserId = userId;
        if (!currentUserId) return null;

        const { data, error } = await supabase
            .from('disciplinist_daily_chats')
            .select('data')
            .eq('user_id', currentUserId)
            .eq('date', date)
            .single();

        if (error) {
            console.error('Cloud fetch chat error:', error);
            return null;
        }

        return data.data as DailyChat;
    },

    saveChat: async (date: string, chatData: Partial<DailyChat>, userId?: string, skipFetch: boolean = false): Promise<void> => {
        const currentUserId = userId;
        if (!currentUserId) return;

        let merged = chatData;
        if (!skipFetch) {
            // Upsert: load existing then merge
            const existing = await cloudStorage.getChat(date, currentUserId);
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
            merged = { ...(existing || defaults), ...chatData };
        }

        const { error } = await supabase
            .from('disciplinist_daily_chats')
            .upsert({ user_id: currentUserId, date, data: merged }, { onConflict: 'user_id,date' });

        if (error) console.error('Cloud save chat error:', error);
    },

    closeChat: async (date: string, userId?: string): Promise<void> => {
        await cloudStorage.saveChat(date, { status: 'CLOSED' }, userId);
    },

    // ── Preferences ────────────────────────────────────────────────────────

    getPreferences: async (userId?: string): Promise<UserPreferences | null> => {
        const currentUserId = userId;
        if (!currentUserId) return null;

        const { data, error } = await supabase
            .from('disciplinist_preferences')
            .select('data')
            .eq('user_id', currentUserId)
            .single();

        if (error) {
            console.error('Cloud fetch prefs error:', error);
            return null;
        }

        return data.data as UserPreferences;
    },

    savePreferences: async (prefs: UserPreferences, userId?: string): Promise<void> => {
        const currentUserId = userId;
        if (!currentUserId) return;

        const { error } = await supabase
            .from('disciplinist_preferences')
            .upsert({ user_id: currentUserId, data: prefs }, { onConflict: 'user_id' });

        if (error) console.error('Cloud save prefs error:', error);
    },

    // ── Data Verification ─────────────────────────────────────────────────────

    verifyDataIntegrity: async (userId?: string): Promise<{
        status: 'ok' | 'error', details: {
            user?: string;
            totalChats?: number;
            todayDataExists?: boolean;
            todayTodos?: number;
            todayDailies?: number;
            allTodos?: number;
            allDailies?: number;
            datesWithData?: string[];
            error?: string;
        }
    }> => {
        const currentUserId = userId;
        if (!currentUserId) return { status: 'error', details: { error: 'No user authenticated' } };

        try {
            // Test fetch all data
            const allData = await cloudStorage.getAllChats(currentUserId);
            const today = new Date().toISOString().split('T')[0];
            const todayData = allData[today];

            const verification = {
                status: 'ok' as const,
                details: {
                    user: currentUserId,
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
                details: { error: error instanceof Error ? error.message : String(error) }
            };
        }
    }
};
