export function getDeviceId(): string {
    const key = 'disciplinist_device_id';
    let id = localStorage.getItem(key);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(key, id);
    }
    return id;
}

export function getDeviceInfo() {
    const ua = navigator.userAgent;

    const platform = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
        : /Android/.test(ua) ? 'Android'
            : /Mac/.test(ua) ? 'macOS'
                : /Win/.test(ua) ? 'Windows'
                    : /Linux/.test(ua) ? 'Linux' : 'Unknown';

    const browser = /Chrome/.test(ua) && !/Edg/.test(ua) && !/Brave/.test(ua) ? 'Chrome'
        : /Firefox/.test(ua) ? 'Firefox'
            : /Safari/.test(ua) && !/Chrome/.test(ua) ? 'Safari'
                : /Edg/.test(ua) ? 'Edge'
                    : /Brave/.test(ua) ? 'Brave' : 'Browser';

    const isMobile = /Android|iPhone|iPad|iPod/.test(ua);
    const deviceName = `${isMobile ? '📱' : '💻'} ${platform} · ${browser}`;

    return { platform, browser, deviceName, isMobile };
}
