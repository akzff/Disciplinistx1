'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface GroupMessage {
    id: string;
    user_id: string;
    user_name: string;
    user_avatar?: string;
    content: string;
    created_at: string;
}

const FETCH_LIMIT = 80;

export function useGroupChat(currentUserId: string | null, currentUserName: string) {
    const [messages, setMessages] = useState<GroupMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [onlineCount, setOnlineCount] = useState(1);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    // ── Fetch initial messages ──────────────────────────────────────────────
    const fetchMessages = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('disciplinist_group_chat')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(FETCH_LIMIT);

        if (!error && data) {
            // Reverse so oldest is at top
            setMessages(data.reverse() as GroupMessage[]);
        }
        setLoading(false);
    }, []);

    // ── Subscribe to realtime inserts ───────────────────────────────────────
    useEffect(() => {
        fetchMessages();

        // Postgres changes channel for new inserts
        const channel = supabase
            .channel('group_chat_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'disciplinist_group_chat',
                },
                (payload) => {
                    const newMsg = payload.new as GroupMessage;
                    setMessages((prev) => {
                        // Avoid duplicates
                        if (prev.some((m) => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'disciplinist_group_chat',
                },
                (payload) => {
                    setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchMessages]);

    // ── Presence tracking for online count ─────────────────────────────────
    useEffect(() => {
        if (!currentUserId) return;

        const presenceChannel = supabase.channel('group_chat_presence', {
            config: { presence: { key: currentUserId } },
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                setOnlineCount(Object.keys(state).length);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        user_id: currentUserId,
                        user_name: currentUserName,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        presenceChannelRef.current = presenceChannel;

        return () => {
            supabase.removeChannel(presenceChannel);
        };
    }, [currentUserId, currentUserName]);

    // ── Send a message ──────────────────────────────────────────────────────
    const sendMessage = useCallback(
        async (content: string, userAvatar?: string): Promise<boolean> => {
            if (!currentUserId || !content.trim()) return false;

            setSending(true);
            const { error } = await supabase.from('disciplinist_group_chat').insert({
                user_id: currentUserId,
                user_name: currentUserName,
                user_avatar: userAvatar || null,
                content: content.trim(),
            });
            setSending(false);

            if (error) {
                console.error('Group chat send error:', error);
                return false;
            }
            return true;
        },
        [currentUserId, currentUserName]
    );

    // ── Delete a message ────────────────────────────────────────────────────
    const deleteMessage = useCallback(
        async (messageId: string): Promise<boolean> => {
            const { error } = await supabase
                .from('disciplinist_group_chat')
                .delete()
                .eq('id', messageId);

            if (error) {
                console.error('Group chat delete error:', error);
                return false;
            }
            return true;
        },
        []
    );

    return {
        messages,
        loading,
        sending,
        onlineCount,
        sendMessage,
        deleteMessage,
        refetch: fetchMessages,
    };
}
