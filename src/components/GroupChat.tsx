'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGroupChat, GroupMessage } from '@/hooks/useGroupChat';

interface GroupChatProps {
    userId: string;
    userName: string;
    userAvatar?: string;
}

function formatTime(isoString: string): string {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getAvatarColor(userId: string): string {
    const colors = [
        '#d4a017', '#8b5cf6', '#06b6d4', '#10b981',
        '#f59e0b', '#ec4899', '#3b82f6', '#ef4444',
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
    if (avatar) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={avatar}
                alt={name}
                style={{
                    width: size, height: size, borderRadius: '50%',
                    objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)',
                    flexShrink: 0,
                }}
            />
        );
    }
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: getAvatarColor(name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.4, fontWeight: '800', color: '#000',
            flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)',
            letterSpacing: '-0.02em',
        }}>
            {name?.[0]?.toUpperCase() || '?'}
        </div>
    );
}

function MessageBubble({
    msg,
    isOwn,
    onDelete,
}: {
    msg: GroupMessage;
    isOwn: boolean;
    onDelete: (id: string) => void;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            className="gc-message-wrapper"
            style={{
                display: 'flex',
                flexDirection: isOwn ? 'row-reverse' : 'row',
                gap: '10px',
                alignItems: 'flex-end',
                position: 'relative',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Avatar */}
            <Avatar name={msg.user_name} avatar={msg.user_avatar} size={30} />

            {/* Bubble */}
            <div className="gc-bubble" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {/* Name + time */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'baseline',
                    flexDirection: isOwn ? 'row-reverse' : 'row',
                }}>
                    <span style={{
                        fontSize: '0.65rem', fontWeight: '800',
                        color: getAvatarColor(msg.user_id),
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                        {isOwn ? 'You' : msg.user_name}
                    </span>
                    <span style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: '500' }}>
                        {formatTime(msg.created_at)}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                    {/* Message content */}
                    <div style={{
                        padding: '10px 14px',
                        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: isOwn
                            ? 'linear-gradient(135deg, rgba(212,160,23,0.25), rgba(212,160,23,0.12))'
                            : 'rgba(255,255,255,0.06)',
                        border: isOwn
                            ? '1px solid rgba(212,160,23,0.35)'
                            : '1px solid rgba(255,255,255,0.08)',
                        fontSize: '0.9rem',
                        lineHeight: '1.5',
                        color: 'white',
                        wordBreak: 'break-word',
                        backdropFilter: 'blur(8px)',
                        boxShadow: isOwn
                            ? '0 4px 20px rgba(212,160,23,0.08)'
                            : '0 4px 20px rgba(0,0,0,0.2)',
                    }}>
                        {msg.content}
                    </div>

                    {/* Delete button */}
                    {isOwn && hovered && (
                        <button
                            onClick={() => onDelete(msg.id)}
                            title="Delete message"
                            style={{
                                background: 'rgba(239,68,68,0.15)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '6px',
                                color: '#ef4444',
                                fontSize: '0.65rem',
                                padding: '3px 6px',
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'all 0.15s ease',
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function GroupChat({ userId, userName, userAvatar }: GroupChatProps) {
    const { messages, loading, sending, onlineCount, sendMessage, deleteMessage } =
        useGroupChat(userId, userName);

    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new messages
    useEffect(() => {
        if (autoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, autoScroll]);

    const handleScroll = useCallback(() => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setAutoScroll(distanceFromBottom < 60);
    }, []);

    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || sending) return;
        const content = inputValue;
        setInputValue('');
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = '24px';
        }
        await sendMessage(content, userAvatar);
    }, [inputValue, sending, sendMessage, userAvatar]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        // Auto-resize
        e.target.style.height = '24px';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    const handleDelete = useCallback(async (id: string) => {
        await deleteMessage(id);
    }, [deleteMessage]);

    return (
        <div className="chat-container" style={{ height: '100%' }}>
            {/* Header */}
            <div className="chat-header">
                <div className="chat-header__left" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="app-title">
                        <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: '#10b981',
                            boxShadow: '0 0 10px #10b981',
                            flexShrink: 0,
                            animation: 'gc-pulse 2s ease-in-out infinite',
                        }} />
                        <span className="app-title__brand">LIVE CHAT</span>
                        <span style={{
                            fontSize: '0.6rem',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: 'rgba(16,185,129,0.15)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            color: '#10b981',
                            letterSpacing: '0.05em',
                        }}>
                            REALTIME
                        </span>
                    </div>
                    <div className="chat-header__subtitleRow">
                        <p className="session-subtitle">
                            Cross-platform · End-to-end sync
                        </p>
                    </div>
                </div>

                <div className="header-controls">
                    {/* Online count */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.25)',
                    }}>
                        <div style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            background: '#10b981',
                            boxShadow: '0 0 6px #10b981',
                        }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#10b981' }}>
                            {onlineCount} online
                        </span>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                className="chat-messages"
                onScroll={handleScroll}
                style={{ gap: '12px' }}
            >
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', opacity: 0.5 }}>
                        <div className="typing-indicator">
                            <div className="dot" />
                            <div className="dot" />
                            <div className="dot" />
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', flex: 1, gap: '12px', opacity: 0.4,
                        padding: '4rem 2rem', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '2.5rem' }}>💬</div>
                        <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>No messages yet</p>
                        <p style={{ fontSize: '0.75rem' }}>Be the first to say something</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            msg={msg}
                            isOwn={msg.user_id === userId}
                            onDelete={handleDelete}
                        />
                    ))
                )}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
            </div>

            {/* Scroll-to-bottom button */}
            {!autoScroll && (
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                            setAutoScroll(true);
                        }}
                        style={{
                            position: 'absolute',
                            bottom: '24px',
                            right: '24px',
                            background: 'var(--accent)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '38px',
                            height: '38px',
                            color: '#000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 100,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                            transition: 'all 0.2s',
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="7 13 12 18 17 13"></polyline>
                            <polyline points="12 18 12 6"></polyline>
                        </svg>
                    </button>
                </div>
            )}

            {/* Input */}
            <div className="input-area">
                <div className="input-wrapper">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Message everyone..."
                        rows={1}
                        style={{ minHeight: '24px', maxHeight: '120px' }}
                        disabled={sending}
                    />
                </div>
                <button
                    className="send-button"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || sending}
                    title="Send (Enter)"
                >
                    {sending ? (
                        <div className="typing-indicator" style={{ padding: 0 }}>
                            <div className="dot" style={{ width: '4px', height: '4px' }} />
                            <div className="dot" style={{ width: '4px', height: '4px' }} />
                            <div className="dot" style={{ width: '4px', height: '4px' }} />
                        </div>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
}
