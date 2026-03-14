import { differenceInCalendarDays, format, parse, parseISO } from 'date-fns';

function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatRecurrence(rec: any): string {
    if (!rec || !rec.type) return '';
    switch (rec.type) {
        case 'weekly':
            return rec.days.map((d: string) =>
                d.charAt(0).toUpperCase() + d.slice(1, 3)
            ).join(', ');
        case 'weekly_count':
            return `${rec.count}×/week`;
        case 'monthly_count':
            return `${rec.count}×/month`;
        case 'every_n_days':
            return `every ${rec.n}d`;
        case 'every_n_weeks':
            return `every ${rec.n}w`;
        case 'every_n_months':
            return `every ${rec.n}mo`;
        case 'monthly_date':
            return `monthly on ${rec.day}${ordinal(rec.day)}`;
        default:
            return '';
    }
}

export function formatDueDate(date: string): string {
    const d = parseISO(date);
    const diff = differenceInCalendarDays(d, new Date());
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 7) return `${diff}d left`;
    return format(d, 'MMM d');
}

export function formatHour(time: string): string {
    if (!time) return '';
    const parsed = time.length > 5
        ? parse(time, 'HH:mm:ss', new Date())
        : parse(time, 'HH:mm', new Date());
    return format(parsed, 'h:mm a');
}
