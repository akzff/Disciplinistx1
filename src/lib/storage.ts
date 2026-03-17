export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
    taskRequest?: {
        name: string;
        status: 'PENDING' | 'APPROVED' | 'IGNORED';
    };
    completedMission?: {
        name: string;
        startTime: number;
        endTime: number;
        activeTime: number;
        pausedTime: number;
        notes?: TaskNote[];
        rating?: number;
    };
}

export interface TaskNote {
    text: string;
    timestamp: number;
}

export interface ActiveTask {
    id: string;
    name: string;
    startTime: number;
    endTime?: number;
    status: 'RUNNING' | 'PAUSED' | 'COMPLETED';
    totalActiveTime: number; // in milliseconds
    totalPausedTime: number; // in milliseconds
    lastStartedAt: number;
    lastPausedAt?: number;
    notes?: TaskNote[];
}

export interface TodoHistoryEntry {
    id: string;
    todoId: string;
    text: string;
    tickedAt: number;
    createdAt?: number;
    importance?: number;
    tags?: string[];
    notes?: string;
    type: 'todo' | 'daily';
}

export interface HabitIssue {
    id: string;
    date: string;
    context: string;
    issue: string;
}

export type PersonaId = 'monk' | 'friend' | 'disciplinist';

export interface CompletedTask {
    name: string;
    activeTime: number;
    pausedTime: number;
    finishedAt: number;
    abandonmentReason?: string;
    notes?: TaskNote[];
    rating?: number;
}

export interface DailyChat {
    date: string; // YYYY-MM-DD
    messages: Message[];
    status: 'OPEN' | 'CLOSED';
    activeTasks: ActiveTask[];
    distractions: string[];
    botMood?: 'NEUTRAL' | 'DISAPPOINTED' | 'HOPEFUL' | 'DOMINATOR';
    clientId?: string;
    todos: {
        id: string;
        text: string;
        completed: boolean;
        created_at?: number;
        color?: string;
        date?: string;
        time?: string;
        isTimed?: boolean;
        subtasks?: { id: string; text: string; completed: boolean }[]
        importance?: number;
        due_date?: string;
        emergency_date?: string;
        due_time?: string;
        recurrence?: {
            type?: string;
            days?: string[];
            count?: number;
            n?: number;
            day?: number;
        };
        visibility?: {
            type?: string;
            days?: string[];
            every_months?: number;
            next_show?: string;
            days_before?: number;
            date?: string;
        };
        tags?: string[];
        notes?: string;
        snoozed_until?: string;
        last_completed?: string;
    }[];
    dailies: {
        id: string;
        text: string;
        completed: boolean;
        created_at?: number;
        color?: string;
        time?: string;
        isTimed?: boolean;
        subtasks?: { id: string; text: string; completed: boolean }[]
        importance?: number;
        time_slot?: 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'anytime';
        time_slot_time?: string;
        notes?: string;
        tags?: string[];
        recurrence?: {
            type?: string;
            days?: string[];
            count?: number;
            n?: number;
            day?: number;
        };
        visibility?: {
            type?: string;
            days?: string[];
            every_months?: number;
            next_show?: string;
            days_before?: number;
            date?: string;
        };
    }[];
    completedTasks?: CompletedTask[];
    todoHistory?: TodoHistoryEntry[];
    aiSummary?: string;
    artifactUrl?: string;
    expenses?: { id: string; amount: number; text: string }[];
    financialAudit?: string;
}

export interface UserPreferences {
    name: string;
    bio: string;
    pfp: string; // Base64 string or URL
    dayVision: string;
    dailyModel: string;
    ambition: string;
    inspirationQuotes: string;
    persona: PersonaId;
    mentorLevel?: 1 | 2 | 3;
    habitNotes: HabitIssue[];
    selectedModel: string;
}

const getChatsKey = (userId?: string) => userId ? `disciplinist_chats_${userId}` : 'disciplinist_chats';
const getPrefsKey = (userId?: string) => userId ? `disciplinist_preferences_${userId}` : 'disciplinist_preferences';

export const storage = {
    getChats: (userId?: string): Record<string, DailyChat> => {
        if (typeof window === 'undefined') return {};
        const stored = localStorage.getItem(getChatsKey(userId));
        return stored ? JSON.parse(stored) : {};
    },

    getChat: (date: string, userId?: string): DailyChat | null => {
        const chats = storage.getChats(userId);
        const chat = chats[date];
        if (!chat) return null;

        const defaults: Partial<DailyChat> = {
            messages: [],
            status: 'OPEN',
            activeTasks: [],
            distractions: [],
            todos: [],
            dailies: [],
            expenses: []
        };

        return { ...defaults, ...chat } as DailyChat;
    },

    saveChat: (date: string, chatData: Partial<DailyChat>, userId?: string) => {
        const chats = storage.getChats(userId);
        const existing = chats[date] || { date, messages: [], status: 'OPEN', activeTasks: [], distractions: [], todos: [], dailies: [] };
        chats[date] = { ...existing, ...chatData };
        localStorage.setItem(getChatsKey(userId), JSON.stringify(chats));
    },

    closeChat: (date: string, userId?: string) => {
        storage.saveChat(date, { status: 'CLOSED' }, userId);
    },

    getUserPreferences: (userId?: string): UserPreferences => {
        const defaults: UserPreferences = {
            name: 'Disciple',
            bio: '',
            pfp: '',
            dayVision: '',
            dailyModel: '',
            ambition: '',
            inspirationQuotes: '',
            persona: 'friend',
            habitNotes: [],
            selectedModel: 'qwen/qwen3-32b'
        };
        if (typeof window === 'undefined') return defaults;
        const stored = localStorage.getItem(getPrefsKey(userId));
        const merged = stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
        // Backward compatibility: map old mentorLevel to persona if missing
        if (!merged.persona && merged.mentorLevel) {
            merged.persona = merged.mentorLevel === 1 ? 'friend' : merged.mentorLevel === 2 ? 'monk' : 'disciplinist';
        }
        return merged;
    },

    saveUserPreferences: (prefs: UserPreferences, userId?: string) => {
        localStorage.setItem(getPrefsKey(userId), JSON.stringify(prefs));
    },

    getPreviousDay: (dateString: string): string => {
        const date = new Date(dateString);
        date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    },

    getCurrentDate: (): string => {
        return new Date().toISOString().split('T')[0];
    },

    initializeNewDay: (today: string, userId?: string): DailyChat => {
        const chats = storage.getChats(userId);
        if (chats[today]) return chats[today];

        const dates = Object.keys(chats).sort().reverse();
        const lastDate = dates.find(d => d < today);
        const lastChat = lastDate ? chats[lastDate] : null;

        const newChat: DailyChat = {
            date: today,
            messages: [],
            status: 'OPEN',
            activeTasks: [],
            distractions: [],
            todos: lastChat ? lastChat.todos.filter(t => !t.completed) : [],
            dailies: lastChat ? lastChat.dailies.map(d => ({ ...d, completed: false })) : []
        };

        storage.saveChat(today, newChat, userId);
        return newChat;
    },

    exportData: (userId?: string) => {
        const chats = localStorage.getItem(getChatsKey(userId));
        const prefs = localStorage.getItem(getPrefsKey(userId));
        return JSON.stringify({
            chats: chats ? JSON.parse(chats) : {},
            preferences: prefs ? JSON.parse(prefs) : {},
            exportedAt: new Date().toISOString()
        }, null, 2);
    },

    importData: (jsonStr: string, userId?: string) => {
        try {
            const data = JSON.parse(jsonStr);
            if (data.chats) {
                localStorage.setItem(getChatsKey(userId), JSON.stringify(data.chats));
            }
            if (data.preferences) {
                localStorage.setItem(getPrefsKey(userId), JSON.stringify(data.preferences));
            }
            return true;
        } catch (e) {
            console.error('Import failed', e);
            return false;
        }
    }
};

export function formatTime(ms: number, showSeconds: boolean = true): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (!showSeconds) return `${h > 0 ? h + 'h ' : ''}${m}m`;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
}
