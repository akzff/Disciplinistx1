import { supabase } from './supabase';
import { storage } from './storage';

// Manual migration tool for users who lost data after Clerk integration
export class ManualMigration {
    // Get all users from Supabase (for debugging)
    static async getAllUsers(): Promise<{ user_id: string }[]> {
        try {
            // Get unique user IDs from chats
            const { data: chatData } = await supabase
                .from('disciplinist_daily_chats')
                .select('user_id');

            const { data: prefData } = await supabase
                .from('disciplinist_preferences')
                .select('user_id');

            console.log('Users with chat data:', chatData);
            console.log('Users with preferences:', prefData);
            
            return [];
        } catch (err) {
            console.error('Error getting users:', err);
            return [];
        }
    }

    // Migrate data from local storage to current Clerk user
    static async migrateFromLocalStorage(clerkUserId: string): Promise<{
        success: boolean;
        chatsMigrated: number;
        preferencesMigrated: boolean;
        message: string;
    }> {
        try {
            console.log('Starting manual migration from local storage for user:', clerkUserId);

            // Get local data
            const localChats = storage.getChats();
            const localPrefs = storage.getUserPreferences();

            let chatsMigrated = 0;
            let preferencesMigrated = false;

            // Migrate chats
            for (const [date, chatData] of Object.entries(localChats)) {
                try {
                    const { error } = await supabase
                        .from('disciplinist_daily_chats')
                        .upsert({
                            user_id: clerkUserId,
                            date,
                            data: chatData
                        }, { onConflict: 'user_id,date' });

                    if (!error) {
                        chatsMigrated++;
                        console.log(`Migrated chat for date: ${date}`);
                    } else {
                        console.error('Error migrating chat for date:', date, error);
                    }
                } catch (err) {
                    console.error('Failed to migrate chat for date:', date, err);
                }
            }

            // Migrate preferences
            if (localPrefs && localPrefs.name !== 'Disciple') {
                try {
                    const { error } = await supabase
                        .from('disciplinist_preferences')
                        .upsert({
                            user_id: clerkUserId,
                            data: localPrefs
                        }, { onConflict: 'user_id' });

                    if (!error) {
                        preferencesMigrated = true;
                        console.log('Migrated preferences successfully');
                    } else {
                        console.error('Error migrating preferences:', error);
                    }
                } catch (err) {
                    console.error('Failed to migrate preferences:', err);
                }
            }

            const message = `Migration completed: ${chatsMigrated} chats migrated, preferences: ${preferencesMigrated ? 'yes' : 'no'}`;
            console.log(message);

            return {
                success: true,
                chatsMigrated,
                preferencesMigrated,
                message
            };

        } catch (err) {
            console.error('Manual migration failed:', err);
            return {
                success: false,
                chatsMigrated: 0,
                preferencesMigrated: false,
                message: `Migration failed: ${err instanceof Error ? err.message : String(err)}`
            };
        }
    }

    // Export local data for backup
    static exportLocalData(): string {
        const localChats = storage.getChats();
        const localPrefs = storage.getUserPreferences();

        const exportData = {
            chats: localChats,
            preferences: localPrefs,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        return JSON.stringify(exportData, null, 2);
    }

    // Import data from backup
    static async importData(clerkUserId: string, jsonData: string): Promise<{
        success: boolean;
        message: string;
    }> {
        try {
            const data = JSON.parse(jsonData);
            
            if (!data.chats || !data.preferences) {
                return {
                    success: false,
                    message: 'Invalid backup data format'
                };
            }

            console.log('Importing data for user:', clerkUserId);

            // Clear existing data for this user
            await supabase
                .from('disciplinist_daily_chats')
                .delete()
                .eq('user_id', clerkUserId);

            await supabase
                .from('disciplinist_preferences')
                .delete()
                .eq('user_id', clerkUserId);

            // Import chats
            let chatsImported = 0;
            for (const [date, chatData] of Object.entries(data.chats)) {
                const { error } = await supabase
                    .from('disciplinist_daily_chats')
                    .upsert({
                        user_id: clerkUserId,
                        date,
                        data: chatData
                    }, { onConflict: 'user_id,date' });

                if (!error) {
                    chatsImported++;
                }
            }

            // Import preferences
            const { error: prefError } = await supabase
                .from('disciplinist_preferences')
                .upsert({
                    user_id: clerkUserId,
                    data: data.preferences
                }, { onConflict: 'user_id' });

            const message = `Import completed: ${chatsImported} chats imported, preferences: ${prefError ? 'failed' : 'success'}`;
            console.log(message);

            return {
                success: true,
                message
            };

        } catch (err) {
            return {
                success: false,
                message: `Import failed: ${err instanceof Error ? err.message : String(err)}`
            };
        }
    }

    // Check what data exists locally
    static checkLocalData(): {
        hasChats: boolean;
        chatCount: number;
        hasCustomPreferences: boolean;
        summary: string;
    } {
        const localChats = storage.getChats();
        const localPrefs = storage.getUserPreferences();

        const hasChats = Object.keys(localChats).length > 0;
        const hasCustomPreferences = localPrefs.name !== 'Disciple';

        const summary = `Local data check: ${Object.keys(localChats).length} chats, custom preferences: ${hasCustomPreferences ? 'yes' : 'no'}`;

        return {
            hasChats,
            chatCount: Object.keys(localChats).length,
            hasCustomPreferences,
            summary
        };
    }
}

// Make this available globally for manual triggering
if (typeof window !== 'undefined') {
    (window as { manualMigration?: typeof ManualMigration }).manualMigration = ManualMigration;
    console.log('Manual migration tool available at window.manualMigration');
}
