'use client';

import { useEffect } from 'react';
import { supabase, supabaseUrl, supabaseKey } from '@/lib/supabase';
import { getDeviceId, getDeviceInfo } from '@/utils/deviceFingerprint';

export function useDeviceHeartbeat(userId: string | undefined) {
    useEffect(() => {
        if (!userId || typeof window === 'undefined') return;

        const deviceId = getDeviceId();
        const { deviceName, platform, browser } = getDeviceInfo();

        const register = async () => {
            await supabase.from('device_sessions').upsert({
                user_id: userId,
                device_id: deviceId,
                device_name: deviceName,
                platform,
                browser,
                last_seen: new Date().toISOString(),
                is_online: true,
            }, { onConflict: 'user_id,device_id' });
        };

        const heartbeat = async () => {
            await supabase
                .from('device_sessions')
                .update({ last_seen: new Date().toISOString(), is_online: true })
                .eq('user_id', userId)
                .eq('device_id', deviceId);
        };

        const markOffline = () => {
            const url = `${supabaseUrl}/rest/v1/device_sessions?user_id=eq.${userId}&device_id=eq.${deviceId}`;
            const payload = JSON.stringify({ is_online: false });

            if (typeof navigator !== 'undefined') {
                fetch(url, {
                    method: 'PATCH',
                    keepalive: true,
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: payload
                }).catch(err => console.error('Failed to mark offline on unload:', err));
            }

            // Also fire async update using supabase client as fallback
            supabase
                .from('device_sessions')
                .update({ is_online: false })
                .eq('user_id', userId)
                .eq('device_id', deviceId);
        };

        register();
        const interval = setInterval(heartbeat, 30_000);
        window.addEventListener('beforeunload', markOffline);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', markOffline);
            markOffline();
        };
    }, [userId]);
}
