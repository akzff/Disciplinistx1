import { DailyChat, UserPreferences, storage, HabitIssue } from './storage';
import { supabase } from './supabase';
import { cloudStorage } from './cloudStorage';

export interface ComprehensiveExportData {
    version: string;
    exportedAt: string;
    exportedBy: string;
    userEmail?: string;
    data: {
        chats: Record<string, DailyChat>;
        profile: {
            name: string;
            bio: string;
            pfp: string;
            dayVision: string;
            dailyModel: string;
            ambition: string;
            mentorLevel: 1 | 2 | 3;
            habitNotes: HabitIssue[];
            selectedModel: string;
        };
        preferences: UserPreferences;
        summary: {
            totalChats: number;
            totalTodos: number;
            totalDailies: number;
            totalExpenses: number;
            totalCompletedTasks: number;
            totalActiveTasks: number;
            dateRange: {
                earliest: string;
                latest: string;
            };
        };
    };
}

export interface ImportValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
        chatsToImport: number;
        hasPreferences: boolean;
        version: string;
        exportDate: string;
    };
}

export class EnhancedExportImport {
    // Comprehensive export including all data types
    static async exportAllData(userId?: string): Promise<string> {
        try {
            console.log('=== ENHANCED EXPORT DEBUG START ===');
            console.log('Starting comprehensive data export...');
            console.log('User ID provided:', !!userId);
            console.log('User ID value:', userId);
            
            // Get data from cloud (if userId provided) or local storage
            let allChats: Record<string, DailyChat> = {};
            let preferences: UserPreferences | null = null;
            
            if (userId) {
                // Export from cloud storage - explicitly no limit for all data
                console.log('Fetching from cloud storage...');
                console.log('Calling cloudStorage.getAllChats with userId:', userId);
                allChats = await cloudStorage.getAllChats(userId); // No limit parameter
                console.log('Cloud fetch completed. Chats found:', Object.keys(allChats).length);
                console.log('Cloud chat keys:', Object.keys(allChats).sort());
                
                preferences = await cloudStorage.getPreferences(userId);
                console.log('Preferences fetched:', !!preferences);
            } else {
                // Export from local storage
                console.log('Fetching from local storage...');
                allChats = storage.getChats();
                preferences = storage.getUserPreferences();
                console.log('Local fetch completed. Chats found:', Object.keys(allChats).length);
            }

            // Log all available dates for debugging
            const chatDates = Object.keys(allChats);
            console.log('All chat dates:', chatDates.sort());
            console.log('Sample chat data:', chatDates.slice(0, 3).map(date => ({
                date,
                hasData: !!allChats[date],
                messageCount: allChats[date]?.messages?.length || 0,
                todosCount: allChats[date]?.todos?.length || 0
            })));
            
            // Calculate summary statistics
            const totalTodos = Object.values(allChats).reduce((sum, chat) => sum + (chat.todos?.length || 0), 0);
            const totalDailies = Object.values(allChats).reduce((sum, chat) => sum + (chat.dailies?.length || 0), 0);
            const totalExpenses = Object.values(allChats).reduce((sum, chat) => sum + (chat.expenses?.length || 0), 0);
            const totalCompletedTasks = Object.values(allChats).reduce((sum, chat) => sum + (chat.completedTasks?.length || 0), 0);
            const totalActiveTasks = Object.values(allChats).reduce((sum, chat) => sum + (chat.activeTasks?.length || 0), 0);

            const sortedDates = chatDates.sort();
            const dateRange = {
                earliest: sortedDates[0] || '',
                latest: sortedDates[sortedDates.length - 1] || ''
            };

            console.log('Export summary:', {
                totalChats: chatDates.length,
                totalTodos,
                totalDailies,
                totalExpenses,
                totalCompletedTasks,
                totalActiveTasks,
                dateRange
            });

            // Get user information
            let userEmail = '';
            try {
                const clerkUser = (window as { Clerk?: { user?: { primaryEmailAddress?: { emailAddress?: string } } } }).Clerk?.user;
                if (clerkUser?.primaryEmailAddress?.emailAddress) {
                    userEmail = clerkUser.primaryEmailAddress.emailAddress;
                }
                console.log('User email found:', userEmail);
            } catch (err) {
                console.log('Could not get user email for export:', err);
            }

            const exportData: ComprehensiveExportData = {
                version: '2.0',
                exportedAt: new Date().toISOString(),
                exportedBy: userId || 'local_user',
                userEmail,
                data: {
                    chats: allChats,
                    profile: {
                        name: preferences?.name || 'Disciple',
                        bio: preferences?.bio || '',
                        pfp: preferences?.pfp || '',
                        dayVision: preferences?.dayVision || '',
                        dailyModel: preferences?.dailyModel || '',
                        ambition: preferences?.ambition || '',
                        mentorLevel: preferences?.mentorLevel || 1,
                        habitNotes: preferences?.habitNotes || [],
                        selectedModel: preferences?.selectedModel || ''
                    },
                    preferences: preferences || storage.getUserPreferences(),
                    summary: {
                        totalChats: chatDates.length,
                        totalTodos,
                        totalDailies,
                        totalExpenses,
                        totalCompletedTasks,
                        totalActiveTasks,
                        dateRange
                    }
                }
            };

            console.log('Export data structure created successfully');
            console.log('Export data keys:', Object.keys(exportData));
            console.log('Export data.data keys:', Object.keys(exportData.data));
            
            const jsonString = JSON.stringify(exportData, null, 2);
            console.log('JSON string length:', jsonString.length);
            console.log('=== ENHANCED EXPORT DEBUG END ===');
            
            return jsonString;

        } catch (error) {
            console.error('=== ENHANCED EXPORT ERROR ===');
            console.error('Export failed:', error);
            console.error('Error details:', {
                name: (error as Error)?.name,
                message: (error as Error)?.message,
                stack: (error as Error)?.stack
            });
            throw error;
        }
    }

    // Validate import data
    static validateImportData(jsonStr: string): ImportValidationResult {
        const result: ImportValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            summary: {
                chatsToImport: 0,
                hasPreferences: false,
                version: 'unknown',
                exportDate: 'unknown'
            }
        };

        try {
            const data = JSON.parse(jsonStr);

            // Check basic structure
            if (!data.version) {
                result.warnings.push('No version specified - assuming compatibility');
            } else {
                result.summary.version = data.version;
            }

            if (!data.exportedAt) {
                result.errors.push('Missing export timestamp');
                result.isValid = false;
            } else {
                result.summary.exportDate = data.exportedAt;
            }

            if (!data.data) {
                result.errors.push('Missing data section');
                result.isValid = false;
                return result;
            }

            // Validate chats
            if (!data.data.chats || typeof data.data.chats !== 'object') {
                result.errors.push('Invalid or missing chats data');
                result.isValid = false;
            } else {
                const chatCount = Object.keys(data.data.chats).length;
                result.summary.chatsToImport = chatCount;

                // Validate each chat structure
                for (const [date, chat] of Object.entries(data.data.chats)) {
                    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        result.warnings.push(`Invalid date format: ${date}`);
                    }
                    
                    if (!chat || typeof chat !== 'object') {
                        result.errors.push(`Invalid chat structure for date: ${date}`);
                        result.isValid = false;
                    }
                }
            }

            // Validate preferences
            if (data.data.preferences) {
                if (typeof data.data.preferences === 'object') {
                    result.summary.hasPreferences = true;
                } else {
                    result.errors.push('Invalid preferences format');
                    result.isValid = false;
                }
            }

            // Validate profile data (newer format)
            if (data.data.profile) {
                if (typeof data.data.profile === 'object') {
                    result.summary.hasPreferences = true; // Profile counts as preferences
                    console.log('Profile data found in export');
                } else {
                    result.errors.push('Invalid profile format');
                    result.isValid = false;
                }
            }

        } catch (error) {
            result.errors.push(`Invalid JSON format: ${error instanceof Error ? error.message : String(error)}`);
            result.isValid = false;
        }

        return result;
    }

    // Comprehensive import with cloud sync
    static async importAllData(jsonStr: string, userId?: string): Promise<{
        success: boolean;
        message: string;
        importedChats: number;
        importedPreferences: boolean;
        errors: string[];
    }> {
        const result = {
            success: false,
            message: '',
            importedChats: 0,
            importedPreferences: false,
            errors: [] as string[]
        };

        try {
            // Validate first
            const validation = this.validateImportData(jsonStr);
            if (!validation.isValid) {
                result.message = 'Import validation failed';
                result.errors = validation.errors;
                return result;
            }

            const data = JSON.parse(jsonStr);
            const { chats, profile } = data.data;

            // Import chats
            if (chats && userId) {
                console.log(`Importing ${Object.keys(chats).length} chats to cloud for user: ${userId}`);
                
                for (const [date, chatData] of Object.entries(chats)) {
                    try {
                        await cloudStorage.saveChat(date, chatData as DailyChat, userId);
                        result.importedChats++;
                    } catch (error) {
                        const errorMsg = `Failed to import chat for ${date}: ${error instanceof Error ? error.message : String(error)}`;
                        result.errors.push(errorMsg);
                        console.error(errorMsg);
                    }
                }
            } else if (chats && !userId) {
                // Import to local storage
                console.log('Importing chats to local storage');
                for (const [date, chatData] of Object.entries(chats)) {
                    storage.saveChat(date, chatData as DailyChat);
                }
                result.importedChats = Object.keys(chats).length;
            }

            // Import preferences and profile
            if (data.data.preferences && userId) {
                try {
                    await cloudStorage.savePreferences(data.data.preferences, userId);
                    result.importedPreferences = true;
                    console.log('Preferences imported to cloud successfully');
                } catch (error) {
                    const errorMsg = `Failed to import preferences: ${error instanceof Error ? error.message : String(error)}`;
                    result.errors.push(errorMsg);
                    console.error(errorMsg);
                }
            } else if (data.data.preferences && !userId) {
                // Import to local storage
                storage.saveUserPreferences(data.data.preferences);
                result.importedPreferences = true;
                console.log('Preferences imported to local storage');
            }

            // Import profile separately if available (for newer export format)
            if (profile && userId) {
                try {
                    // Update preferences with profile data
                    const existingPrefs = await cloudStorage.getPreferences(userId) || data.data.preferences;
                    const updatedPrefs = { ...existingPrefs, ...profile };
                    await cloudStorage.savePreferences(updatedPrefs, userId);
                    console.log('Profile data imported to cloud successfully');
                } catch (error) {
                    const errorMsg = `Failed to import profile: ${error instanceof Error ? error.message : String(error)}`;
                    result.errors.push(errorMsg);
                    console.error(errorMsg);
                }
            } else if (profile && !userId) {
                // Import profile to local storage
                const existingPrefs = storage.getUserPreferences();
                const updatedPrefs = { ...existingPrefs, ...profile };
                storage.saveUserPreferences(updatedPrefs);
                console.log('Profile data imported to local storage');
            }

            result.success = result.errors.length === 0;
            result.message = result.success 
                ? `Successfully imported ${result.importedChats} chats${result.importedPreferences ? ' and preferences' : ''}`
                : `Import completed with ${result.errors.length} errors`;

        } catch (error) {
            result.message = `Import failed: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(result.message);
            console.error('Import failed:', error);
        }

        return result;
    }

    // Create downloadable file
    static downloadFile(content: string, filename: string): void {
        try {
            console.log('=== DOWNLOAD DEBUG START ===');
            console.log('Download file called with:', { filename, contentLength: content.length });
            
            const blob = new Blob([content], { type: 'application/json' });
            console.log('Blob created:', blob.size, 'bytes');
            
            const url = URL.createObjectURL(blob);
            console.log('Object URL created:', url);
            
            const a = document.createElement('a');
            console.log('Anchor element created');
            
            a.href = url;
            a.download = filename;
            console.log('Anchor attributes set:', { href: a.href, download: a.download });
            
            document.body.appendChild(a);
            console.log('Anchor appended to body');
            
            a.click();
            console.log('Click triggered');
            
            document.body.removeChild(a);
            console.log('Anchor removed from body');
            
            URL.revokeObjectURL(url);
            console.log('Object URL revoked');
            console.log('=== DOWNLOAD DEBUG END ===');
        } catch (error) {
            console.error('=== DOWNLOAD ERROR ===');
            console.error('Download failed:', error);
            console.error('Error details:', {
                name: (error as Error)?.name,
                message: (error as Error)?.message,
                stack: (error as Error)?.stack
            });
            throw error;
        }
    }

    // Generate filename with timestamp
    static generateFilename(): string {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `disciplinist-backup-${timestamp}.json`;
    }

    // Get import statistics before importing
    static async getImportPreview(jsonStr: string): Promise<{
        canImport: boolean;
        preview: {
            totalChats: number;
            dateRange: { earliest: string; latest: string };
            hasPreferences: boolean;
            version: string;
            exportDate: string;
            warnings: string[];
        };
    }> {
        const validation = this.validateImportData(jsonStr);
        
        if (!validation.isValid) {
            return {
                canImport: false,
                preview: {
                    totalChats: 0,
                    dateRange: { earliest: '', latest: '' },
                    hasPreferences: false,
                    version: 'unknown',
                    exportDate: 'unknown',
                    warnings: validation.errors
                }
            };
        }

        const data = JSON.parse(jsonStr);
        const chats = data.data.chats || {};
        const dates = Object.keys(chats).sort();
        
        return {
            canImport: true,
            preview: {
                totalChats: dates.length,
                dateRange: {
                    earliest: dates[0] || '',
                    latest: dates[dates.length - 1] || ''
                },
                hasPreferences: !!data.data.preferences || !!data.data.profile,
                version: data.version || '1.0',
                exportDate: data.exportedAt || 'unknown',
                warnings: validation.warnings
            }
        };
    }
}

// Make available globally for manual use
if (typeof window !== 'undefined') {
    (window as { enhancedExportImport?: typeof EnhancedExportImport }).enhancedExportImport = EnhancedExportImport;
    console.log('Enhanced export/import available at window.enhancedExportImport');
}
