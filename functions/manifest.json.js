export async function onRequestGet(context) {
    const { env } = context;
    let isDiwali = false;
    let festivalName = 'Bus Yatra';
    let themeColor = '#dc2626';
    let icon192 = '/icons/icon-192.png';
    let icon512 = '/icons/icon-512.png';

    try {
        if (env.DB) {
            const row = await env.DB.prepare("SELECT enabled, config FROM platform_features WHERE feature_key = 'festivalTheme'").first();
            if (row && (row.enabled === 1 || row.enabled === true)) {
                const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
                if (cfg && cfg.enabled && cfg.festival === 'diwali') {
                    isDiwali = true;
                    festivalName = 'Bus Yatra 🪔';
                    themeColor = '#ea580c';
                    icon192 = '/icons/icon-diwali-192.png';
                    icon512 = '/icons/icon-diwali-512.png';
                } else if (cfg && cfg.enabled && cfg.festival && cfg.festival !== 'none') {
                    icon192 = `/icons/icon-${cfg.festival}-192.png`;
                    icon512 = `/icons/icon-${cfg.festival}-512.png`;
                }
            }
        }
    } catch (_) {}

    const manifest = {
        "id": "/",
        "name": isDiwali ? "Bus Yatra 🪔 - অনলাইন বাস টিকিট বুকিং" : "Bus Yatra - অনলাইন বাস টিকিট বুকিং",
        "short_name": festivalName,
        "description": isDiwali ? "Bus Yatra - শুভ দীপাবলি ও শ্যামাপূজা! আনন্দময় ও নিরাপদ যাত্রার শুভেচ্ছা।" : "Bus Yatra - পিংলা ও কলকাতার মধ্যে দ্রুত ও সুরক্ষিত দৈনিক বাস টিকিট বুকিং সেবা।",
        "start_url": "/?source=customer_pwa",
        "scope": "/",
        "display": "standalone",
        "orientation": "portrait-primary",
        "background_color": "#ffffff",
        "theme_color": themeColor,
        "related_applications": [
            {
                "platform": "webapp",
                "url": "https://busyatra.pages.dev/manifest.json"
            }
        ],
        "icons": [
            {
                "src": icon192,
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any"
            },
            {
                "src": icon192,
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "maskable"
            },
            {
                "src": icon512,
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any"
            },
            {
                "src": icon512,
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable"
            }
        ]
    };

    return new Response(JSON.stringify(manifest, null, 2), {
        headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=10, stale-while-revalidate=60',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
