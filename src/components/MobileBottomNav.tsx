'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

const NAV_ROUTES = ['/', '/expenses', '/analytics', '/records'];

interface MobileNavProps {
    onTasksPress?: () => void;
    tasksActive?: boolean;
}

export function MobileBottomNav({ onTasksPress, tasksActive }: MobileNavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const isChatPage = pathname === '/';

    const prefetchRoute = useCallback((href: string) => {
        if (href !== pathname) {
            router.prefetch(href);
        }
    }, [router, pathname]);

    useEffect(() => {
        NAV_ROUTES.forEach((route) => prefetchRoute(route));
    }, [prefetchRoute]);

    return (
        <nav className="mobile-bottom-nav">
            {/* Tasks button — only on chat page */}
            {isChatPage && (
                <button
                    onClick={onTasksPress}
                    className={`mbn-item${tasksActive ? ' mbn-item--active' : ''}`}
                    aria-label="Tasks"
                >
                    <span className="mbn-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 11l3 3L22 4" />
                            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                        </svg>
                    </span>
                    <span className="mbn-label">TASKS</span>
                    {tasksActive && <span className="mbn-active-dot" />}
                </button>
            )}

            <Link
                href="/"
                prefetch
                onMouseEnter={() => prefetchRoute('/')}
                onFocus={() => prefetchRoute('/')}
                className={`mbn-item${pathname === '/' ? ' mbn-item--current' : ''}`}
            >
                <span className="mbn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                </span>
                <span className="mbn-label">CHAT</span>
            </Link>

            <Link
                href="/expenses"
                prefetch
                onMouseEnter={() => prefetchRoute('/expenses')}
                onFocus={() => prefetchRoute('/expenses')}
                className={`mbn-item${pathname === '/expenses' ? ' mbn-item--current' : ''}`}
            >
                <span className="mbn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                    </svg>
                </span>
                <span className="mbn-label">EXPENSES</span>
            </Link>

            <Link
                href="/analytics"
                prefetch
                onMouseEnter={() => prefetchRoute('/analytics')}
                onFocus={() => prefetchRoute('/analytics')}
                className={`mbn-item${pathname === '/analytics' ? ' mbn-item--current' : ''}`}
            >
                <span className="mbn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                </span>
                <span className="mbn-label">ANALYTICS</span>
            </Link>

            <Link
                href="/records"
                prefetch
                onMouseEnter={() => prefetchRoute('/records')}
                onFocus={() => prefetchRoute('/records')}
                className={`mbn-item${pathname === '/records' ? ' mbn-item--current' : ''}`}
            >
                <span className="mbn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                </span>
                <span className="mbn-label">RECORDS</span>
            </Link>
        </nav>
    );
}
