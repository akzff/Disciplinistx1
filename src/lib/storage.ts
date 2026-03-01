export interface Message {
    role: 'user' | 'assistant';
    content: string;
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
    };
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
}

export interface HabitIssue {
    id: string;
    date: string;
    context: string;
    issue: string;
}

export interface DailyChat {
    date: string; // YYYY-MM-DD
    messages: Message[];
    status: 'OPEN' | 'CLOSED';
    activeTasks: ActiveTask[];
    distractions: string[];
    botMood?: 'NEUTRAL' | 'DISAPPOINTED' | 'HOPEFUL' | 'DOMINATOR';
    todos: {
        id: string;
        text: string;
        completed: boolean;
        color?: string;
        date?: string;
        time?: string;
        isTimed?: boolean;
        subtasks?: { id: string; text: string; completed: boolean }[]
    }[];
    dailies: {
        id: string;
        text: string;
        completed: boolean;
        color?: string;
        time?: string;
        isTimed?: boolean;
        frequency?: { count: number; period: 'WEEK' | 'MONTH' };
        recurringDays?: string[]; // ['Mon', 'Tue', etc]
        subtasks?: { id: string; text: string; completed: boolean }[]
    }[];
    completedTasks?: {
        name: string;
        activeTime: number;
        pausedTime: number;
        finishedAt: number;
        abandonmentReason?: string;
    }[];
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
    mentorLevel: 1 | 2 | 3;
    habitNotes: HabitIssue[];
    selectedModel: string;
}

const STORAGE_KEYS = {
    CHATS: 'disciplinist_chats',
    PREFERENCES: 'disciplinist_preferences',
};

export const storage = {
    getChats: (): Record<string, DailyChat> => {
        if (typeof window === 'undefined') return {};
        const stored = localStorage.getItem(STORAGE_KEYS.CHATS);
        return stored ? JSON.parse(stored) : {};
    },

    getChat: (date: string): DailyChat | null => {
        const chats = storage.getChats();
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

    saveChat: (date: string, chatData: Partial<DailyChat>) => {
        const chats = storage.getChats();
        const existing = chats[date] || { date, messages: [], status: 'OPEN', activeTasks: [], distractions: [], todos: [], dailies: [] };
        chats[date] = { ...existing, ...chatData };
        localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    },

    closeChat: (date: string) => {
        storage.saveChat(date, { status: 'CLOSED' });
    },

    getUserPreferences: (): UserPreferences => {
        const defaults: UserPreferences = {
            name: 'Disciple',
            bio: '',
            pfp: '',
            dayVision: '',
            dailyModel: '',
            ambition: '',
            mentorLevel: 1,
            habitNotes: [],
            selectedModel: 'qwen/qwen3-32b'
        };
        if (typeof window === 'undefined') return defaults;
        const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
        return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    },

    saveUserPreferences: (prefs: UserPreferences) => {
        localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
    },

    getPreviousDay: (dateString: string): string => {
        const date = new Date(dateString);
        date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    },

    getCurrentDate: (): string => {
        return new Date().toISOString().split('T')[0];
    },

    initializeNewDay: (today: string): DailyChat => {
        const chats = storage.getChats();
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

        storage.saveChat(today, newChat);
        return newChat;
    },

    exportData: () => {
        const chats = localStorage.getItem(STORAGE_KEYS.CHATS);
        const prefs = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
        return JSON.stringify({
            chats: chats ? JSON.parse(chats) : {},
            preferences: prefs ? JSON.parse(prefs) : {},
            exportedAt: new Date().toISOString()
        }, null, 2);
    },

    importData: (jsonStr: string) => {
        try {
            const data = JSON.parse(jsonStr);
            if (data.chats) {
                localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(data.chats));
            }
            if (data.preferences) {
                localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(data.preferences));
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
