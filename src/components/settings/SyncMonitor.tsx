'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDeviceId } from '@/utils/deviceFingerprint';

interface Device {
    id: string;
    device_id: string;
    device_name: string;
    platform: string;
    browser: string;
    last_seen: string;
    is_online: boolean;
}

function timeAgo(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60_000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
}

function isDeviceOnline(device: Device): boolean {
    const seenRecently = Date.now() - new Date(device.last_seen).getTime() < 60_000;
    return seenRecently || device.is_online;
}

export default function SyncMonitor({ userId }: { userId: string }) {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const currentDeviceId = getDeviceId();

    useEffect(() => {
        if (!userId) return;

        const fetchDevices = async () => {
            const { data } = await supabase
                .from('device_sessions')
                .select('*')
                .eq('user_id', userId)
                .order('last_seen', { ascending: false });
            setDevices(data ?? []);
            setLoading(false);
        };

        fetchDevices();

        const channel = supabase
            .channel(`device-monitor-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'device_sessions',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        setDevices(prev =>
                            prev.map(d =>
                                d.device_id === (payload.new as Device).device_id
                                    ? { ...d, ...(payload.new as Device) }
                                    : d
                            )
                        );
                    }
                    if (payload.eventType === 'INSERT') {
                        setDevices(prev => {
                            const exists = prev.some(d => d.device_id === (payload.new as Device).device_id);
                            return exists ? prev : [payload.new as Device, ...prev];
                        });
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    const onlineCount = devices.filter(isDeviceOnline).length;

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', opacity: 0.4 }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d4a017', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: '0.75rem', color: 'white' }}>Scanning devices...</span>
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}>
                No devices registered yet. Reopen settings after a moment.
            </p>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Header row with online count */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.06em' }}>
                    {devices.length} device{devices.length !== 1 ? 's' : ''} registered
                </span>
                <span style={{
                    fontSize: '0.65rem', fontWeight: 800,
                    background: 'rgba(52,211,153,0.1)', color: '#34d399',
                    border: '1px solid rgba(52,211,153,0.2)',
                    padding: '2px 8px', borderRadius: '100px'
                }}>
                    {onlineCount} online
                </span>
            </div>

            {devices.map(device => {
                const online = isDeviceOnline(device);
                const isThis = device.device_id === currentDeviceId;

                return (
                    <div key={device.device_id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: '14px',
                        background: '#0a0a0a',
                        border: `1px solid ${isThis ? 'rgba(212,160,23,0.25)' : 'rgba(212,160,23,0.08)'}`,
                        transition: 'border-color 0.2s',
                    }}>
                        {/* Left: device info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
                                    {device.device_name || `${device.platform} · ${device.browser}`}
                                </span>
                                {isThis && (
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 900,
                                        background: 'rgba(212,160,23,0.15)', color: '#d4a017',
                                        border: '1px solid rgba(212,160,23,0.3)',
                                        padding: '1px 6px', borderRadius: '100px',
                                        letterSpacing: '0.06em', flexShrink: 0
                                    }}>
                                        THIS DEVICE
                                    </span>
                                )}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
                                {online ? 'Active now' : `Last seen ${timeAgo(device.last_seen)}`}
                            </span>
                        </div>

                        {/* Right: status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                            {online ? (
                                <>
                                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', animation: 'pulse 2s infinite' }} />
                                    <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 700 }}>Live</span>
                                </>
                            ) : (
                                <>
                                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>Offline</span>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
}
