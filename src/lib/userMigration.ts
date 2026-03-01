import { supabase } from './supabase';
import { DailyChat, UserPreferences, storage } from './storage';

// Interface for user ID mapping
interface UserMapping {
    oldUserId: string;
    newUserId: string;
    email: string;
    migratedAt: string;
}

// Table name for user mappings
const USER_MAPPINGS_TABLE = 'disciplinist_user_mappings';

export class UserMigration {
    // Save mapping between old and new user IDs
    static async saveUserMapping(oldUserId: string, newUserId: string, email: string): Promise<void> {
        try {
            const mapping: UserMapping = {
                oldUserId,
                newUserId,
                email,
                migratedAt: new Date().toISOString()
            };

            const { error } = await supabase
                .from(USER_MAPPINGS_TABLE)
                .upsert(mapping, { onConflict: 'oldUserId' });

            if (error) {
                console.error('Error saving user mapping:', error);
            } else {
                console.log('User mapping saved successfully:', { oldUserId, newUserId, email });
            }
        } catch (err) {
            console.error('Failed to save user mapping:', err);
        }
    }

    // Get mapping for a user
    static async getUserMapping(newUserId: string): Promise<UserMapping | null> {
        try {
            const { data, error } = await supabase
                .from(USER_MAPPINGS_TABLE)
                .select('*')
                .eq('newUserId', newUserId)
                .single();

            if (error) {
                console.log('No user mapping found for new user ID:', newUserId);
                return null;
            }

            return data as UserMapping;
        } catch (err) {
            console.error('Failed to get user mapping:', err);
            return null;
        }
    }

    // Get all data for old user ID
    static async getOldData(oldUserId: string): Promise<{
        chats: Record<string, DailyChat>;
        preferences: UserPreferences | null;
    }> {
        try {
            // Get old chats
            const { data: chatData, error: chatError } = await supabase
                .from('disciplinist_daily_chats')
                .select('date, data')
                .eq('user_id', oldUserId)
                .order('date', { ascending: false });

            if (chatError) {
                console.error('Error fetching old chats:', chatError);
                return { chats: {}, preferences: null };
            }

            const oldChats: Record<string, DailyChat> = {};
            (chatData || []).forEach((row) => {
                oldChats[row.date] = row.data as DailyChat;
            });

            // Get old preferences
            const { data: prefData, error: prefError } = await supabase
                .from('disciplinist_preferences')
                .select('data')
                .eq('user_id', oldUserId)
                .single();

            if (prefError) {
                console.log('No old preferences found');
            }

            return {
                chats: oldChats,
                preferences: prefData?.data as UserPreferences || null
            };
        } catch (err) {
            console.error('Failed to get old data:', err);
            return { chats: {}, preferences: null };
        }
    }

    // Migrate all data from old user to new user
    static async migrateUserData(oldUserId: string, newUserId: string): Promise<{
        success: boolean;
        chatsMigrated: number;
        preferencesMigrated: boolean;
        error?: string;
    }> {
        try {
            console.log('Starting data migration from', oldUserId, 'to', newUserId);

            // Get old data
            const { chats, preferences } = await this.getOldData(oldUserId);

            let chatsMigrated = 0;
            let preferencesMigrated = false;

            // Migrate chats
            for (const [date, chatData] of Object.entries(chats)) {
                try {
                    const { error } = await supabase
                        .from('disciplinist_daily_chats')
                        .upsert({
                            user_id: newUserId,
                            date,
                            data: chatData
                        }, { onConflict: 'user_id,date' });

                    if (!error) {
                        chatsMigrated++;
                    } else {
                        console.error('Error migrating chat for date:', date, error);
                    }
                } catch (err) {
                    console.error('Failed to migrate chat for date:', date, err);
                }
            }

            // Migrate preferences
            if (preferences) {
                try {
                    const { error } = await supabase
                        .from('disciplinist_preferences')
                        .upsert({
                            user_id: newUserId,
                            data: preferences
                        }, { onConflict: 'user_id' });

                    if (!error) {
                        preferencesMigrated = true;
                    } else {
                        console.error('Error migrating preferences:', error);
                    }
                } catch (err) {
                    console.error('Failed to migrate preferences:', err);
                }
            }

            console.log('Migration completed:', {
                chatsMigrated,
                preferencesMigrated,
                totalChats: Object.keys(chats).length
            });

            return {
                success: true,
                chatsMigrated,
                preferencesMigrated
            };

        } catch (err) {
            console.error('Migration failed:', err);
            return {
                success: false,
                chatsMigrated: 0,
                preferencesMigrated: false,
                error: err instanceof Error ? err.message : String(err)
            };
        }
    }

    // Check if user needs migration and perform it
    static async checkAndMigrateUser(newUserId: string, email: string): Promise<boolean> {
        try {
            // Check if we already have a mapping for this user
            const existingMapping = await this.getUserMapping(newUserId);
            
            if (existingMapping) {
                console.log('User already migrated:', existingMapping.email);
                return true;
            }

            // Try to find old user by email (this would require an additional table or query)
            // For now, we'll check if there's any data in local storage that indicates an old user
            const localPrefs = storage.getUserPreferences();
            const localChats = storage.getChats();

            // If there's local data, assume it's from an old user and migrate it
            if (Object.keys(localChats).length > 0 || localPrefs.name !== 'Disciple') {
                console.log('Found local data, attempting migration...');
                
                // We need to get the old user ID - this is tricky without email lookup
                // For now, let's migrate local data to the new user
                let migratedChats = 0;
                
                for (const [date, chatData] of Object.entries(localChats)) {
                    try {
                        const { error } = await supabase
                            .from('disciplinist_daily_chats')
                            .upsert({
                                user_id: newUserId,
                                date,
                                data: chatData
                            }, { onConflict: 'user_id,date' });

                        if (!error) {
                            migratedChats++;
                        }
                    } catch (err) {
                        console.error('Failed to migrate local chat:', err);
                    }
                }

                // Migrate preferences
                if (localPrefs.name !== 'Disciple') {
                    try {
                        const { error } = await supabase
                            .from('disciplinist_preferences')
                            .upsert({
                                user_id: newUserId,
                                data: localPrefs
                            }, { onConflict: 'user_id' });

                        if (!error) {
                            console.log('Local preferences migrated successfully');
                        }
                    } catch (err) {
                        console.error('Failed to migrate local preferences:', err);
                    }
                }

                console.log(`Migrated ${migratedChats} chats from local storage`);
                
                // Save mapping to prevent re-migration
                await this.saveUserMapping('local_user', newUserId, email);
                
                return migratedChats > 0;
            }

            return false;

        } catch (err) {
            console.error('Check and migrate failed:', err);
            return false;
        }
    }
}
