export const IMPORTANCE = [
    { level: 0, label: 'NONE', color: 'rgba(255,255,255,0.2)', icon: '' },
    { level: 1, label: 'LOW', color: '#4ade80', icon: '🟢' },
    { level: 2, label: 'MEDIUM', color: '#fbbf24', icon: '🟡' },
    { level: 3, label: 'HIGH', color: '#f97316', icon: '🟠' },
    { level: 4, label: 'CRITICAL', color: '#ef4444', icon: '⚡' },
];

export const TIME_SLOTS = [
    { id: 'morning', label: 'Morning', icon: '🌅', time: '05:00–09:00' },
    { id: 'noon', label: 'Noon', icon: '☀️', time: '11:00–13:00' },
    { id: 'afternoon', label: 'Afternoon', icon: '🌤', time: '13:00–17:00' },
    { id: 'evening', label: 'Evening', icon: '🌆', time: '17:00–20:00' },
    { id: 'night', label: 'Night', icon: '🌙', time: '20:00–23:00' },
    { id: 'anytime', label: 'Anytime', icon: '⏰', time: 'flexible' },
];

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
