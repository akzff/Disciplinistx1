import { addMonths, addWeeks, addDays, isAfter, getDay, format } from 'date-fns';
import { DailyChat } from '@/lib/storage';

const DAY_MAP: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

type Todo = DailyChat['todos'][number];
type Daily = DailyChat['dailies'][number];

export function shouldShowToday(task: Todo | Daily): boolean {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const vis = task.visibility ?? {};
    const rec = task.recurrence ?? {};

    const snoozedUntil = (task as Todo).snoozed_until;
    if (snoozedUntil && snoozedUntil > todayStr) {
        return false;
    }

    switch (vis.type) {
        case 'blackout_until':
            return vis.date ? todayStr >= vis.date : true;
        case 'pre_due': {
            const dueDate = (task as Todo).due_date;
            if (!dueDate) return true;
            const showFrom = format(
                addDays(new Date(dueDate), -(vis.days_before || 0)),
                'yyyy-MM-dd'
            );
            return todayStr >= showFrom;
        }
        case 'seasonal': {
            if (!vis.next_show) return true;
            const windowEnd = format(
                addDays(new Date(vis.next_show), 7),
                'yyyy-MM-dd'
            );
            return todayStr >= vis.next_show && todayStr <= windowEnd;
        }
        case 'weekdays': {
            const todayKey = Object.keys(DAY_MAP).find(
                k => DAY_MAP[k] === getDay(today)
            );
            return todayKey ? (vis.days || []).includes(todayKey) : true;
        }
        default:
            break;
    }

    const lastCompleted = (task as Todo).last_completed;
    if (!lastCompleted) return true;

    const lastDone = new Date(lastCompleted);

    switch (rec.type) {
        case 'every_n_days':
            return isAfter(today, addDays(lastDone, (rec.n || 1) - 1));
        case 'every_n_weeks':
            return isAfter(today, addWeeks(lastDone, (rec.n || 1) - 1));
        case 'every_n_months':
            return isAfter(today, addMonths(lastDone, (rec.n || 1) - 1));
        case 'weekly': {
            const todayKey = Object.keys(DAY_MAP).find(
                k => DAY_MAP[k] === getDay(today)
            );
            return todayKey ? (rec.days || []).includes(todayKey) : true;
        }
        case 'weekly_count':
            return true;
        case 'monthly_date':
            return new Date().getDate() === rec.day;
        default:
            return true;
    }
}

export function getNextSeasonalDate(every_months: number): string {
    return format(addMonths(new Date(), every_months), 'yyyy-MM-dd');
}

export function filterTasksForToday<T extends Todo | Daily>(tasks: T[]): T[] {
    return tasks.filter(shouldShowToday);
}
