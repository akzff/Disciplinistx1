'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavigationBar() {
    const pathname = usePathname();

    const menu = [
        { label: 'CHAT', href: '/' },
        { label: 'EXPENSES', href: '/expenses' },
        { label: 'ANALYTICS', href: '/analytics' },
        { label: 'RECORDS', href: '/records' },
    ];

    return (
        <nav className="mobile-scroll-x" style={{
            display: 'flex',
            gap: '4px',
            background: 'rgba(0,0,0,0.3)',
            padding: '6px',
            borderRadius: '100px',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(10px)',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
            flexShrink: 0
        }}>
            {menu.map((item) => {
                const active = pathname === item.href;
                return (
                    <Link key={item.href} href={item.href} style={{
                        padding: '8px 20px',
                        borderRadius: '100px',
                        textDecoration: 'none',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        color: active ? 'white' : 'rgba(255,255,255,0.4)',
                        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                        boxShadow: active ? '0 4px 15px rgba(0,0,0,0.2)' : 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        letterSpacing: '0.05em'
                    }}>
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
