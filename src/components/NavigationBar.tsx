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
            gap: '6px',
            background: 'rgba(255,255,255,0.03)',
            padding: '6px',
            borderRadius: '100px',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            flexShrink: 0
        }}>
            {menu.map((item) => {
                const active = pathname === item.href;
                return (
                    <Link key={item.href} href={item.href} className="nav-item" style={{
                        padding: '8px 24px',
                        borderRadius: '100px',
                        textDecoration: 'none',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        color: active ? 'white' : 'rgba(255,255,255,0.45)',
                        background: active ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.1))' : 'transparent',
                        border: active ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                        boxShadow: active ? '0 4px 15px rgba(139, 92, 246, 0.15)' : 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        letterSpacing: '0.06em'
                    }}>
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
