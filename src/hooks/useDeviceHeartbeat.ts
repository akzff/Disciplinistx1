'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
            // Use sendBeacon for reliability on page close
            const url = `https://txqcuqhauipyzckefkqp.supabase.co/rest/v1/device_sessions?user_id=eq.${userId}&device_id=eq.${deviceId}`;
            const payload = JSON.stringify({ is_online: false });
            if (navigator.sendBeacon) {
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon(url, blob);
            }
            // Also fire async update (may not complete on page close, but fine as fallback)
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
