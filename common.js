// Bus Yatra - Common Core Logic, Storage, Hashing, XSS & Global Feature Flags

const defaultCoupons = [
    { code: "BENGAL10", discount: 50, active: true },
    { code: "YATRA20", discount: 100, active: true },
    { code: "PUJA50", discount: 50, active: true }
];

const defaultFeatureFlags = {
    onlinePayment: true,
    cashPayment: true,
    captainPortal: true,
    windowSeatPricing: false,
    promoCodes: true,
    liveTracking: true,
    customerFeedback: true,
    // Next-Gen Advanced Features (Managed exclusively from Admin Panel - Disabled by default)
    bengali_stop_announcer: false,
    flash_sale_pricing: false,
    smart_boarding_countdown: false,
    dropoff_wakeup_alarm: false
};

function escapeHtml(str) {
    if (typeof str !== 'string') return (str === null || str === undefined) ? '' : String(str);
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

function localDateStr(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let appData = { buses: [], bookings: {}, reviews: [], coupons: defaultCoupons, featureFlags: defaultFeatureFlags, serviceDates: [] };

// --- Universal Language Manager (Bengali & English for Customer, Captain, Owner & Admin) ---
let currentPortalLang = 'bn';
if (typeof localStorage !== 'undefined') {
    currentPortalLang = localStorage.getItem('busyatra_lang') || localStorage.getItem('portal_language') || localStorage.getItem('busyatra_preferred_lang') || localStorage.getItem('preferred_language') || 'bn';
}

function getPortalLanguage() {
    return currentPortalLang;
}

function t(bn, en) {
    return currentPortalLang === 'en' ? en : bn;
}
window.t = t;
window.isBengali = () => currentPortalLang === 'bn';

function setPortalLanguage(lang) {
    currentPortalLang = lang === 'en' ? 'en' : 'bn';
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('busyatra_lang', currentPortalLang);
        localStorage.setItem('portal_language', currentPortalLang);
        localStorage.setItem('preferred_language', currentPortalLang);
        localStorage.setItem('busyatra_preferred_lang', currentPortalLang);
    }

    // Update active button state in owner, captain, and admin headers
    document.querySelectorAll('.lang-btn-bn').forEach(b => {
        if (currentPortalLang === 'bn') {
            b.className = 'lang-btn-bn px-2 py-1 rounded-lg text-[11px] font-black bg-yellow-400 text-gray-900 shadow-xs transition';
        } else {
            b.className = 'lang-btn-bn px-2 py-1 rounded-lg text-[11px] font-bold text-white/80 hover:text-white bg-transparent transition';
        }
    });
    document.querySelectorAll('.lang-btn-en').forEach(b => {
        if (currentPortalLang === 'en') {
            b.className = 'lang-btn-en px-2 py-1 rounded-lg text-[11px] font-black bg-yellow-400 text-gray-900 shadow-xs transition';
        } else {
            b.className = 'lang-btn-en px-2 py-1 rounded-lg text-[11px] font-bold text-white/80 hover:text-white bg-transparent transition';
        }
    });

    // Update customer portal header language buttons
    const bnBtn = document.getElementById('langBnBtn');
    const enBtn = document.getElementById('langEnBtn');
    if (bnBtn && enBtn) {
        if (currentPortalLang === 'bn') {
            bnBtn.className = "px-2 py-0.5 rounded text-xs font-bold bg-white text-red-600 shadow-sm transition";
            enBtn.className = "px-2 py-0.5 rounded text-xs font-bold text-white hover:bg-red-800 transition";
        } else {
            enBtn.className = "px-2 py-0.5 rounded text-xs font-bold bg-white text-red-600 shadow-sm transition";
            bnBtn.className = "px-2 py-0.5 rounded text-xs font-bold text-white hover:bg-red-800 transition";
        }
    }

    // Translate DOM elements with data-bn and data-en
    document.querySelectorAll('[data-bn]').forEach(el => {
        const text = currentPortalLang === 'bn' ? el.getAttribute('data-bn') : el.getAttribute('data-en');
        if (text === null) return;
        const badge = el.querySelector('[id^="badge"]');
        if (badge) {
            const firstSpan = el.querySelector('span:first-child');
            if (firstSpan) {
                firstSpan.innerHTML = text;
            } else if (el.childNodes && el.childNodes.length > 0 && el.childNodes[0].nodeType === 3) {
                el.childNodes[0].nodeValue = text + ' ';
            } else {
                el.innerHTML = text;
            }
        } else {
            el.innerHTML = text;
        }
    });

    // Translate placeholders
    document.querySelectorAll('[data-bn-placeholder]').forEach(el => {
        const ph = currentPortalLang === 'bn' ? el.getAttribute('data-bn-placeholder') : el.getAttribute('data-en-placeholder');
        if (ph !== null) el.placeholder = ph;
    });

    // Translate title tooltips
    document.querySelectorAll('[data-bn-title]').forEach(el => {
        const title = currentPortalLang === 'bn' ? el.getAttribute('data-bn-title') : el.getAttribute('data-en-title');
        if (title !== null) el.title = title;
    });

    // If on customer portal, sync customer dictionary
    if (typeof window !== 'undefined' && typeof window.changeLangInternal === 'function') {
        window.changeLangInternal(currentPortalLang);
    }

    // Notify portal scripts
    window.dispatchEvent(new CustomEvent('portal-language-change', { detail: { lang: currentPortalLang } }));
}
window.setPortalLanguage = setPortalLanguage;
window.getPortalLanguage = getPortalLanguage;

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        setPortalLanguage(currentPortalLang);
    });
}

// --- Firebase Configuration & Real-Time Sync (Ultra-Fast <100ms Live Tracking & Dual Cloud) ---
const BUS_YATRA_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAE2zRHs2X6WkyV0aPQR5eeF8XcqqpCOJI",
    authDomain: "bus-yatra-a8f8a.firebaseapp.com",
    projectId: "bus-yatra-a8f8a",
    storageBucket: "bus-yatra-a8f8a.firebasestorage.app",
    messagingSenderId: "1052080016661",
    appId: "1:1052080016661:web:ba1dedd1eefd7ff7526d1c",
    measurementId: "G-41YTSXTHNC"
};

let _busYatraFirestoreInstance = null;
function getBusYatraFirestore() {
    if (_busYatraFirestoreInstance) return _busYatraFirestoreInstance;
    if (typeof firebase !== 'undefined' && firebase && firebase.initializeApp) {
        try {
            if (!firebase.apps || firebase.apps.length === 0) {
                firebase.initializeApp(BUS_YATRA_FIREBASE_CONFIG);
            }
            _busYatraFirestoreInstance = firebase.firestore();
            return _busYatraFirestoreInstance;
        } catch (e) {
            console.warn("Firebase Firestore init notice:", e);
        }
    }
    return null;
}
window.getBusYatraFirestore = getBusYatraFirestore;
window.BUS_YATRA_FIREBASE_CONFIG = BUS_YATRA_FIREBASE_CONFIG;

// --- Real-World Device & Platform Telemetry (Android, Windows, iOS, Mobile Brands) ---
let _busYatraCachedTelemetry = null;

function getRealDeviceTelemetrySync() {
    if (_busYatraCachedTelemetry) return _busYatraCachedTelemetry;
    if (typeof window === 'undefined') return {};

    const ua = (navigator.userAgent || '');
    let deviceType = 'Desktop';
    let brand = 'Unknown';
    let model = '';
    let os = 'Unknown OS';

    if (/Mobi|Android|iPhone|iPod/i.test(ua)) deviceType = 'Mobile';
    else if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';
    else deviceType = 'Desktop';

    // OS
    if (/Android\s*([0-9\.]+)?/i.test(ua)) {
        const m = ua.match(/Android\s*([0-9\.]+)/i);
        os = 'Android' + (m ? ' ' + m[1] : '');
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
        const m = ua.match(/OS\s*([0-9_]+)/i);
        os = 'iOS' + (m ? ' ' + m[1].replace(/_/g, '.') : '');
        brand = 'Apple';
        model = /iPad/i.test(ua) ? 'iPad' : 'iPhone';
    } else if (/Windows NT\s*([0-9\.]+)?/i.test(ua)) {
        const m = ua.match(/Windows NT\s*([0-9\.]+)/i);
        const ver = m ? m[1] : '';
        os = ver === '10.0' ? 'Windows 10/11' : ('Windows ' + ver);
        brand = 'Microsoft Windows';
        model = 'PC / Laptop';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
        os = 'macOS';
        brand = 'Apple';
        model = 'MacBook / iMac';
    } else if (/CrOS/i.test(ua)) {
        os = 'ChromeOS';
        brand = 'Chromebook';
    } else if (/Linux/i.test(ua)) {
        os = 'Linux';
        brand = 'Linux PC';
    }

    // Android Mobile Brands & Specific Models
    if (deviceType === 'Mobile' || deviceType === 'Tablet') {
        if (/SM-[A-Z0-9]+/i.test(ua)) {
            brand = 'Samsung';
            model = 'Galaxy ' + (ua.match(/SM-[A-Z0-9]+/i)[0]);
        } else if (/SAMSUNG/i.test(ua)) {
            brand = 'Samsung';
            model = 'Galaxy';
        } else if (/Redmi/i.test(ua)) {
            brand = 'Xiaomi';
            const m = ua.match(/Redmi[^;)]+/i);
            model = m ? m[0] : 'Redmi';
        } else if (/POCO/i.test(ua)) {
            brand = 'POCO';
            const m = ua.match(/POCO[^;)]+/i);
            model = m ? m[0] : 'POCO';
        } else if (/Xiaomi/i.test(ua) || /Mi\s*[0-9A-Z]+/i.test(ua)) {
            brand = 'Xiaomi';
            const m = ua.match(/Mi\s*[0-9A-Z]+/i);
            model = m ? m[0] : 'Xiaomi';
        } else if (/vivo|V2[0-9]{3}[A-Z]?|I2[0-9]{3}[A-Z]?/i.test(ua)) {
            brand = 'Vivo';
            const m = ua.match(/V2[0-9]{3}[A-Z]?|I2[0-9]{3}[A-Z]?/i);
            model = m ? ('Vivo ' + m[0]) : 'Vivo';
        } else if (/realme|RMX[0-9]{4}/i.test(ua)) {
            brand = 'Realme';
            const m = ua.match(/RMX[0-9]{4}/i);
            model = m ? ('Realme ' + m[0]) : 'Realme';
        } else if (/OPPO|CPH[0-9]{4}/i.test(ua)) {
            brand = 'OPPO';
            const m = ua.match(/CPH[0-9]{4}/i);
            model = m ? ('OPPO ' + m[0]) : 'OPPO';
        } else if (/OnePlus|NE2[0-9]{3}|KB2[0-9]{3}/i.test(ua)) {
            brand = 'OnePlus';
            const m = ua.match(/NE2[0-9]{3}|KB2[0-9]{3}/i);
            model = m ? ('OnePlus ' + m[0]) : 'OnePlus';
        } else if (/Pixel/i.test(ua)) {
            brand = 'Google';
            const m = ua.match(/Pixel\s*[0-9a-zA-Z\s]+/i);
            model = m ? m[0].trim() : 'Google Pixel';
        } else if (/moto|motorola|XT[0-9]{4}/i.test(ua)) {
            brand = 'Motorola';
            const m = ua.match(/XT[0-9]{4}/i);
            model = m ? ('Moto ' + m[0]) : 'Motorola';
        } else if (/Infinix/i.test(ua)) {
            brand = 'Infinix';
            const m = ua.match(/Infinix[^;)]+/i);
            model = m ? m[0] : 'Infinix';
        } else if (/TECNO/i.test(ua)) {
            brand = 'Tecno';
            const m = ua.match(/TECNO[^;)]+/i);
            model = m ? m[0] : 'Tecno';
        }
    }

    let browser = 'Browser';
    if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
    else if (/Edg/i.test(ua)) browser = 'Microsoft Edge';
    else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
    else if (/Chrome/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';

    _busYatraCachedTelemetry = {
        deviceType,
        deviceBrand: brand,
        deviceModel: model,
        os,
        browser,
        screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`
    };

    if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
        navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion']).then(hints => {
            if (hints.model && hints.model !== '') {
                _busYatraCachedTelemetry.deviceModel = hints.model;
                if (!_busYatraCachedTelemetry.deviceBrand || _busYatraCachedTelemetry.deviceBrand === 'Unknown') {
                    if (/SM-/i.test(hints.model)) _busYatraCachedTelemetry.deviceBrand = 'Samsung';
                    else if (/RMX/i.test(hints.model)) _busYatraCachedTelemetry.deviceBrand = 'Realme';
                    else if (/CPH/i.test(hints.model)) _busYatraCachedTelemetry.deviceBrand = 'OPPO';
                    else if (/V2/i.test(hints.model)) _busYatraCachedTelemetry.deviceBrand = 'Vivo';
                    else if (/Redmi|POCO/i.test(hints.model)) _busYatraCachedTelemetry.deviceBrand = 'Xiaomi';
                    else if (/Pixel/i.test(hints.model)) _busYatraCachedTelemetry.deviceBrand = 'Google';
                }
            }
        }).catch(() => {});
    }

    return _busYatraCachedTelemetry;
}
window.getRealDeviceTelemetrySync = getRealDeviceTelemetrySync;

async function apiRequest(path, options = {}) {
    const method = options.method || (options.body ? 'POST' : 'GET');
    let portal = null;
    if (path.startsWith('/api/admin/')) {
        portal = 'admin';
    } else if (path.startsWith('/api/owner/') || path === '/api/auth/owner/setup') {
        portal = 'owner';
    } else if (path.startsWith('/api/captain/')) {
        portal = 'captain';
    } else if (
        path.startsWith('/api/customer/') ||
        path.startsWith('/api/bookings') ||
        path.startsWith('/api/seats') ||
        path.startsWith('/api/reviews') ||
        path.startsWith('/api/feedback')
    ) {
        if (!['/api/customer/login', '/api/customer/register', '/api/customer/forgot-pin', '/api/customer/send-reset-otp', '/api/customer/reset-by-otp'].includes(path)) {
            portal = 'customer';
        }
    }

    let portalToken = null;
    if (portal) {
        try {
            const rawSession = localStorage.getItem(`${portal}_session`) || 
                               sessionStorage.getItem(`${portal}_session`) ||
                               localStorage.getItem(`portal_session_${portal}`) ||
                               sessionStorage.getItem(`portal_session_${portal}`);
            portalToken = JSON.parse(rawSession || 'null')?.token || null;
        } catch {
            localStorage.removeItem(`${portal}_session`);
            sessionStorage.removeItem(`${portal}_session`);
        }
    }
    const deviceTelemetry = (typeof getRealDeviceTelemetrySync === 'function') ? getRealDeviceTelemetrySync() : null;
    const headers = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(portalToken ? { Authorization: `Bearer ${portalToken}` } : {}),
        ...(deviceTelemetry ? { 'x-device-telemetry': JSON.stringify(deviceTelemetry) } : {}),
        ...options.headers
    };

    // Dual-Cloud Redundancy: If served from Firebase Hosting (web.app), route /api/ to Cloudflare worker
    let fetchUrl = path;
    if (typeof window !== 'undefined' && path.startsWith('/api/')) {
        const host = window.location.hostname;
        if (host.includes('web.app') || host.includes('firebaseapp.com')) {
            fetchUrl = 'https://busyatra.pages.dev' + path;
        }
    }

    let response;
    try {
        response = await fetch(fetchUrl, {
            ...options,
            method,
            headers
        });
    } catch (networkErr) {
        console.error("Network error fetching " + fetchUrl, networkErr);
        throw new Error("Unable to connect to the server. Please check your internet connection.");
    }

    const contentType = response.headers.get("content-type") || "";
    let payload = null;

    if (contentType.includes("application/json")) {
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }
    } else {
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}. Please try again later.`);
        }
        payload = {};
    }

    if (!response.ok) {
        const errMsg = (payload && payload.error) ? payload.error : `Request failed with status ${response.status}`;
        const error = new Error(errMsg);
        error.status = response.status;
        if (payload && typeof payload === 'object') {
            Object.assign(error, payload);
        }
        throw error;
    }

    return payload || {};
}

function getAppData() {
    return appData;
}

function setAppData(data) {
    if (!data) return;
    appData = {
        buses: Array.isArray(data.buses) ? data.buses : (appData.buses || []),
        bookings: (data.bookings && typeof data.bookings === 'object') ? data.bookings : (appData.bookings || {}),
        reviews: Array.isArray(data.reviews) ? data.reviews : (appData.reviews || []),
        coupons: Array.isArray(data.coupons) ? data.coupons : (appData.coupons || defaultCoupons),
        featureFlags: (data.featureFlags && typeof data.featureFlags === 'object') ? data.featureFlags : (appData.featureFlags || defaultFeatureFlags),
        serviceDates: Array.isArray(data.serviceDates) ? data.serviceDates : (appData.serviceDates || [])
    };
}

// --- PWA Installation Support (Universal for Customer, Owner, Captain & Admin) ---
let pwaDeferredPrompt = null;

function hideAllInstallBanners() {
    if (typeof document === 'undefined') return;
    const bannerIds = [
        'mobileAppInstallBanner',
        'mobileOwnerAppInstallBanner',
        'mobileCaptainAppInstallBanner',
        'mobileAdminAppInstallBanner'
    ];
    bannerIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });
}
window.hideAllInstallBanners = hideAllInstallBanners;

function dismissInstallBanner(bannerId) {
    const el = document.getElementById(bannerId);
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
    try {
        localStorage.setItem('dismissed_' + bannerId, 'true');
    } catch (_) {}
}
window.dismissInstallBanner = dismissInstallBanner;

function isPwaStandalone() {
    if (typeof window === 'undefined') return false;
    const isStandaloneMQ = Boolean(
        window.matchMedia && (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: minimal-ui)').matches
        )
    );
    const isNavStandalone = window.navigator && window.navigator.standalone === true;
    const isAndroidAppReferrer = Boolean(typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://'));
    const isSourcePwa = Boolean(window.location.search && /source=[a-z_]*pwa/i.test(window.location.search));
    const isLocalMarked = Boolean(
        typeof localStorage !== 'undefined' && (
            localStorage.getItem('busyatra_pwa_installed') === 'true' ||
            localStorage.getItem('busyatra_app_installed') === 'true'
        )
    );
    return isStandaloneMQ || isNavStandalone || isAndroidAppReferrer || isSourcePwa || isLocalMarked;
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwaDeferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-install-ready'));
    console.log('Bus Yatra PWA install prompt is ready.');

    // Only un-hide the mobile banner if user is NOT in standalone/installed mode and hasn't dismissed it
    if (!isPwaStandalone()) {
        const path = (window.location.pathname || '').toLowerCase();
        let currentBannerId = 'mobileAppInstallBanner';
        if (path.includes('owner')) currentBannerId = 'mobileOwnerAppInstallBanner';
        else if (path.includes('captain')) currentBannerId = 'mobileCaptainAppInstallBanner';
        else if (path.includes('admin')) currentBannerId = 'mobileAdminAppInstallBanner';

        const isDismissed = localStorage.getItem('dismissed_' + currentBannerId) === 'true';
        if (!isDismissed) {
            const el = document.getElementById(currentBannerId);
            if (el) {
                el.classList.remove('hidden');
                el.style.display = '';
            }
        }
    } else {
        hideAllInstallBanners();
    }
});

window.addEventListener('appinstalled', () => {
    pwaDeferredPrompt = null;
    try {
        localStorage.setItem('busyatra_pwa_installed', 'true');
        localStorage.setItem('busyatra_app_installed', 'true');
    } catch (_) {}
    hideAllInstallBanners();
    console.log('Bus Yatra PWA successfully installed!');
});

function showPwaInstallModal(appName = 'Bus Yatra') {
    let modal = document.getElementById('universalPwaInstallModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'universalPwaInstallModal';
        modal.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm';
        document.body.appendChild(modal);
    }

    const ua = navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isInApp = /FBAN|FBAV|Instagram|WhatsApp|Line|Snapchat/i.test(ua);

    let guideHtml = '';
    if (isInApp) {
        guideHtml = `
            <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs space-y-1.5">
                <p class="font-bold text-amber-900">⚠️ আপনি বর্তমানে সোশ্যাল মিডিয়া / চ্যাট ব্রাউজারে আছেন:</p>
                <p class="text-amber-800">অ্যাপ সরাসরি মোবাইলে ইনস্টল করতে প্রথমে ব্রাউজার পরিবর্তন করুন:</p>
                <ol class="list-decimal pl-4 space-y-1 text-gray-700">
                    <li>উপরে বা নিচে থাকা <strong>তিনটি ডট (⋮)</strong> অথবা <strong>শেয়ার</strong> চাপুন।</li>
                    <li><strong>"Open in Chrome" (বা Open in Safari)</strong> সিলেক্ট করুন।</li>
                    <li>তারপর খুব সহজেই ১-ক্লিকে অ্যাপ ইনস্টল করুন।</li>
                </ol>
            </div>
        `;
    } else if (isIos) {
        guideHtml = `
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-left text-xs space-y-2">
                <p class="font-bold text-blue-900">🍎 iPhone / iPad (Safari) ইনস্টল নির্দেশিকা:</p>
                <ol class="list-decimal pl-4 space-y-1.5 text-gray-700">
                    <li>সাফারি ব্রাউজারের নিচে থাকা <strong>শেয়ার আইকন (Share 📤)</strong> ট্যাপ করুন।</li>
                    <li>মেনুটি স্ক্রল করে নিচে নামুন এবং <strong>"Add to Home Screen" (হোম স্ক্রিনে যোগ করুন ➕)</strong> চাপুন।</li>
                    <li>উপরে ডানদিকের <strong>"Add"</strong> বাটনে ট্যাপ করলেই আপনার হোম স্ক্রিনে অ্যাপ আইকন তৈরি হয়ে যাবে!</li>
                </ol>
            </div>
        `;
    } else {
        guideHtml = `
            <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs space-y-2">
                <p class="font-bold text-emerald-900">📱 Android / Chrome ইনস্টল নির্দেশিকা:</p>
                <ol class="list-decimal pl-4 space-y-1.5 text-gray-700">
                    <li>ক্রোম ব্রাউজারের উপরে ডানদিকের <strong>তিনটি ডট (⋮)</strong> মেনু চাপুন।</li>
                    <li>মেনু তালিকা থেকে <strong>"Install app" (অ্যাপ ইনস্টল করুন 📲)</strong> বা <strong>"Add to Home screen"</strong> সিলেক্ট করুন।</li>
                    <li>কনফার্মেশন পপ-আপে <strong>"Install"</strong> চাপলেই আপনার ফোনে ফুলস্ক্রিন অ্যাপ আকারে সেভ হয়ে যাবে!</li>
                </ol>
            </div>
        `;
    }

    let appRoleDesc = 'মোবাইলে কোনো প্লে-স্টোর ছাড়াই সরাসরি ইনস্টল করে অ্যাপের মতো ব্যবহার করুন।';
    if (appName.includes('Owner')) {
        appRoleDesc = 'বাস মালিকদের জন্য ডেডিকেটেড মোবাইল পোর্টাল। ১-ক্লিকে ফ্লিট পরিচালনা ও ট্রিপ খতিয়ান দেখুন।';
    } else if (appName.includes('Captain')) {
        appRoleDesc = 'বাস ক্যাপ্টেন ও কন্ডাক্টরের জন্য দ্রুত টিকিট কিউআর স্ক্যান ও লাইভ ট্র্যাকিং অ্যাপ।';
    } else if (appName.includes('Admin')) {
        appRoleDesc = 'সুপার অ্যাডমিনের জন্য অল-ইন-ওয়ান বিজনেস ম্যানেজমেন্ট ও মনিটরিং পোর্টাল।';
    }

    modal.innerHTML = `
        <div class="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border flex flex-col text-center animate-fade-in">
            <div class="bg-gradient-to-r from-red-600 to-amber-500 text-white p-4 flex justify-between items-center shadow-sm">
                <h3 class="font-black text-base flex items-center gap-2">📲 <span>অ্যাপ ইনস্টল নির্দেশিকা</span></h3>
                <button type="button" onclick="document.getElementById('universalPwaInstallModal').classList.add('hidden')" class="text-white hover:bg-black/20 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm">✕</button>
            </div>
            <div class="p-5 space-y-3.5">
                <div class="space-y-1">
                    <h4 class="font-black text-gray-900 text-base">${escapeHtml(appName)}</h4>
                    <p class="text-xs text-gray-500">${escapeHtml(appRoleDesc)}</p>
                </div>
                ${guideHtml}
                <a href="https://${window.location.host}${window.location.pathname}${window.location.search}" target="_blank" rel="noopener noreferrer" class="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition">
                    🌐 ক্রোম ব্রাউজারে খুলুন (Open in Chrome)
                </a>
                <button type="button" onclick="document.getElementById('universalPwaInstallModal').classList.add('hidden')" class="w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition">
                    ${t('ঠিক আছে, আমি বুঝেছি', 'Got it')}
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}
window.showPwaInstallModal = showPwaInstallModal;

async function triggerPwaInstall(appName = 'Bus Yatra') {
    if (pwaDeferredPrompt) {
        try {
            pwaDeferredPrompt.prompt();
            const { outcome } = await pwaDeferredPrompt.userChoice;
            console.log(`User response to PWA install: ${outcome}`);
            if (outcome === 'accepted') {
                pwaDeferredPrompt = null;
                ['mobileAppInstallBanner', 'mobileOwnerAppInstallBanner', 'mobileCaptainAppInstallBanner', 'mobileAdminAppInstallBanner'].forEach(id => {
                    const banner = document.getElementById(id);
                    if (banner) banner.classList.add('hidden');
                });
                return;
            }
        } catch (err) {
            console.warn('PWA prompt error:', err);
        }
    }

    if (isPwaStandalone()) {
        const path = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();
        const isCurrentPortalStandalone = 
            (path.includes('owner') && search.includes('owner_pwa')) ||
            (path.includes('captain') && search.includes('captain_pwa')) ||
            (path.includes('admin') && search.includes('admin_pwa')) ||
            (!path.includes('owner') && !path.includes('captain') && !path.includes('admin') && search.includes('customer_pwa'));

        if (isCurrentPortalStandalone) {
            alert(`🎉 ${appName} অ্যাপটি ইতিমধ্যে আপনার ডিভাইসে সফলভাবে ইনস্টল করা রয়েছে!\n\n(App is already installed on your device.)`);
            return;
        }
    }

    showPwaInstallModal(appName);
}
window.triggerPwaInstall = triggerPwaInstall;

function checkPwaBreakout() {
    // Disabled completely as per user request: No "ক্রোমে খুলুন" banner/popup
    const existing = document.getElementById('pwaTrappedNoticeBar');
    if (existing) existing.remove();
}
window.checkPwaBreakout = checkPwaBreakout;

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        // Ensure any stray trapped notice bar is removed immediately
        const stray = document.getElementById('pwaTrappedNoticeBar');
        if (stray) stray.remove();

        if (isPwaStandalone()) {
            hideAllInstallBanners();
        }
        // Auto-detect ?install=1 or ?install=true from QR Code Scan
        checkAutoQrInstallIntent();
    });
}

// --- Google Play Store-Style 1-Tap PWA Install Bottom Sheet (Auto-Triggered on QR Scan) ---
function showPlayStoreInstallBottomSheet() {
    let sheet = document.getElementById('playStoreInstallBottomSheet');
    if (!sheet) {
        sheet = document.createElement('div');
        sheet.id = 'playStoreInstallBottomSheet';
        sheet.className = 'fixed inset-0 z-[9999] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs animate-fade-in select-none';
        document.body.appendChild(sheet);
    }

    const path = (window.location.pathname || '').toLowerCase();
    let appConfig = {
        name: 'Bus Yatra - অনলাইন বাস টিকিট',
        subtitle: 'অফিশিয়াল অনলাইন বাস টিকিট বুকিং ও লাইভ ট্র্যাকিং অ্যাপ',
        category: 'Travel & Local • Official Cloud App',
        icon: 'icons/icon-192.png',
        badge: 'Verified by Google Play Protect',
        size: '২.৪ MB',
        downloads: '50K+',
        rating: '4.9',
        reviews: '12K+'
    };

    if (path.includes('owner.html')) {
        appConfig = {
            name: 'Bus Yatra - Bus Owner',
            subtitle: 'বাস মালিকদের জন্য ফ্লিট, লাভ-লোকসান ও বুকিং পোর্টাল',
            category: 'Business & Fleet Management',
            icon: 'icons/owner-192.png',
            badge: 'Verified Enterprise Portal',
            size: '২.৫ MB',
            downloads: '1K+',
            rating: '4.9',
            reviews: '850+'
        };
    } else if (path.includes('captain.html')) {
        appConfig = {
            name: 'Bus Yatra - Bus Captain',
            subtitle: 'বাস কন্ডাক্টর ও চালকদের টিকিট ভেরিফায়ার ও লাইভ জিপিএস অ্যাপ',
            category: 'Transport & GPS Tools',
            icon: 'icons/captain-192.png',
            badge: 'Verified Fleet Captain App',
            size: '২.৩ MB',
            downloads: '2K+',
            rating: '4.9',
            reviews: '1.2K+'
        };
    } else if (path.includes('admin.html')) {
        appConfig = {
            name: 'Bus Yatra - Super Admin',
            subtitle: 'সুপার অ্যাডমিন বিজনেস মনিটরিং ও কন্ট্রোল কনসোল',
            category: 'Enterprise Admin Console',
            icon: 'icons/admin-192.png',
            badge: 'Secured Admin Console',
            size: '২.৬ MB',
            downloads: 'Protected',
            rating: '5.0',
            reviews: 'Internal'
        };
    }

    sheet.innerHTML = `
        <div class="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 flex flex-col text-left animate-slide-up">
            <!-- Header with Google Play Protect / Security Badge -->
            <div class="px-5 pt-4 pb-2.5 flex items-center justify-between border-b border-gray-100 bg-gray-50/70">
                <div class="flex items-center gap-1.5 text-emerald-700">
                    <svg class="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3zm-2 16l-4-4 1.41-1.41L10 15.17l6.59-6.59L18 10l-8 8z"/>
                    </svg>
                    <span class="text-[11px] font-bold tracking-tight">${escapeHtml(appConfig.badge)}</span>
                </div>
                <button type="button" onclick="closePlayStoreBottomSheet()" class="w-7 h-7 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center font-bold text-sm">✕</button>
            </div>

            <!-- App Meta Section -->
            <div class="p-5 space-y-4">
                <div class="flex items-start gap-3.5">
                    <img src="${escapeHtml(appConfig.icon)}" class="w-16 h-16 rounded-2xl shadow-md border border-gray-100 object-cover shrink-0" alt="App Icon">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-lg font-black text-gray-900 leading-tight">${escapeHtml(appConfig.name)}</h3>
                        <p class="text-xs font-semibold text-emerald-700 mt-0.5 leading-snug">${escapeHtml(appConfig.subtitle)}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5 font-medium">${escapeHtml(appConfig.category)} • 0 Ads</p>
                    </div>
                </div>

                <!-- Play Store Stats Pill Row -->
                <div class="grid grid-cols-3 gap-2 py-2.5 px-3 bg-gray-50 rounded-2xl border border-gray-200/70 text-center">
                    <div class="border-r border-gray-200">
                        <div class="flex items-center justify-center gap-1 font-black text-gray-900 text-sm">
                            <span>${escapeHtml(appConfig.rating)}</span> <span class="text-amber-500 text-xs">★</span>
                        </div>
                        <span class="text-[10px] text-gray-500 font-medium">${escapeHtml(appConfig.reviews)} রিভিউ</span>
                    </div>
                    <div class="border-r border-gray-200">
                        <div class="font-black text-gray-900 text-sm">${escapeHtml(appConfig.size)}</div>
                        <span class="text-[10px] text-emerald-600 font-bold">⚡ ইনস্ট্যান্ট ক্লাউড</span>
                    </div>
                    <div>
                        <div class="font-black text-gray-900 text-sm">${escapeHtml(appConfig.downloads)}</div>
                        <span class="text-[10px] text-gray-500 font-medium">ইনস্টল</span>
                    </div>
                </div>

                <!-- Play Store Style Call To Action -->
                <div class="space-y-2 pt-1">
                    <button id="btnPlayStoreDirectInstall" type="button" onclick="executePlayStoreInstall('${escapeHtml(appConfig.name)}')" class="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white py-3.5 rounded-2xl font-black text-base shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2">
                        <span>📲</span> <span>${t('ইনস্টল করুন', 'Install App')}</span>
                    </button>
                    <button type="button" onclick="closePlayStoreBottomSheet()" class="w-full py-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition text-center block">
                        ${t('ওয়েবসাইটে চালিয়ে যান', 'Continue to Web')} ➔
                    </button>
                </div>
            </div>
        </div>
    `;
    sheet.classList.remove('hidden');
}
window.showPlayStoreInstallBottomSheet = showPlayStoreInstallBottomSheet;

function closePlayStoreBottomSheet() {
    const sheet = document.getElementById('playStoreInstallBottomSheet');
    if (sheet) sheet.classList.add('hidden');
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete('install');
        url.searchParams.delete('pwa');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (e) {}
}
window.closePlayStoreBottomSheet = closePlayStoreBottomSheet;

async function executePlayStoreInstall(appName = 'Bus Yatra') {
    closePlayStoreBottomSheet();
    await triggerPwaInstall(appName);
}
window.executePlayStoreInstall = executePlayStoreInstall;

function checkAutoQrInstallIntent() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('install') === '1' || urlParams.get('install') === 'true' || urlParams.get('pwa') === '1') {
            if (!isPwaStandalone()) {
                setTimeout(() => {
                    showPlayStoreInstallBottomSheet();
                }, 500);
            }
        }
    } catch (e) {}
}
window.checkAutoQrInstallIntent = checkAutoQrInstallIntent;

// Dynamic Enterprise Footer Year (Auto-updates e.g. 2026 -> 2027 seamlessly)
function updateDynamicFooterYear() {
    const currentYear = new Date().getFullYear();
    document.querySelectorAll('.footer-dynamic-year').forEach(el => {
        el.textContent = currentYear;
    });
}
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', updateDynamicFooterYear);
    window.updateDynamicFooterYear = updateDynamicFooterYear;
}

// Universal Feedback QR Code Image Download & Poster Print (For Owner, Captain & Admin)
async function downloadFeedbackQrImage(filename = 'Bus-Yatra-Feedback-QR.png') {
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=png&data=https%3A%2F%2Fbusyatra.pages.dev%2Ffeedback.html';
    try {
        const res = await fetch(qrUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch {
        window.open(qrUrl, '_blank');
    }
}
window.downloadFeedbackQrImage = downloadFeedbackQrImage;

function printFeedbackPoster() {
    window.print();
}
window.printFeedbackPoster = printFeedbackPoster;

// --- Stoppage-wise Timetable Utilities & Editor Helpers ---

function parseTimeToMinutes(tStr) {
    if (!tStr || typeof tStr !== 'string') return null;
    const clean = tStr.trim();
    const match = clean.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const meridiem = (match[3] || '').toUpperCase();
    if (meridiem === 'PM' && h < 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return h * 60 + m;
}
window.parseTimeToMinutes = parseTimeToMinutes;

function formatDurationBetween(startStr, endStr) {
    const m1 = parseTimeToMinutes(startStr);
    const m2 = parseTimeToMinutes(endStr);
    if (m1 === null || m2 === null) return '';
    let diff = m2 - m1;
    if (diff < 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}
window.formatDurationBetween = formatDurationBetween;

function isTripTimePassed(journeyDate, timeStr) {
    if (!journeyDate) return false;
    const todayStr = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0, 10);
    if (journeyDate < todayStr) return true;
    if (journeyDate > todayStr) return false;

    if (!timeStr) return false;
    const depMins = parseTimeToMinutes(timeStr);
    if (depMins === null) return false;

    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    return curMins >= depMins;
}
window.isTripTimePassed = isTripTimePassed;

function getStoppageRowHtml(containerId, seq, name = '', time = '') {
    return `
        <div class="stoppage-schedule-row flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
            <span class="stoppage-seq w-6 text-center text-xs font-extrabold text-gray-400">#${seq}</span>
            <input type="text" value="${escapeHtml(name)}" placeholder="Stoppage Name (e.g. Balaipanda)" class="stoppage-name-input flex-1 p-2 border rounded-lg text-xs bg-white font-medium focus:ring-1 focus:ring-red-500" required>
            <input type="text" value="${escapeHtml(time)}" placeholder="Time (e.g. 05:40 AM)" class="stoppage-time-input w-28 sm:w-36 p-2 border rounded-lg text-xs bg-white font-semibold text-gray-800 focus:ring-1 focus:ring-red-500">
            <button type="button" onclick="removeStoppageRow(this)" title="Remove this stop" class="text-gray-400 hover:text-red-600 font-bold px-2 py-1 text-sm rounded-lg hover:bg-red-50 transition">✕</button>
        </div>
    `;
}
window.getStoppageRowHtml = getStoppageRowHtml;

function renderStoppageScheduleEditor(containerId, stoppages = [], timings = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const stops = (Array.isArray(stoppages) && stoppages.length > 0)
        ? stoppages
        : ['Pingla', 'Balaipanda', 'Debra', 'Kharagpur', 'Kolaghat', 'Kolkata'];

    let html = `
        <div class="space-y-2" id="${containerId}-rows">
    `;
    stops.forEach((stop, idx) => {
        const timeVal = (timings && timings[stop]) || '';
        html += getStoppageRowHtml(containerId, idx + 1, stop, timeVal);
    });
    html += `
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
            <button type="button" onclick="addStoppageRowToEditor('${containerId}')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-red-200 self-start">
                ➕ Add Stoppage (স্টপেজ যোগ করুন)
            </button>
            <span class="text-[11px] text-gray-500">প্রতিটি স্টপেজের নাম ও ছাড়ার নির্দিষ্ট সময় লিখুন (e.g. 05:40 AM)</span>
        </div>
    `;
    container.innerHTML = html;
}
window.renderStoppageScheduleEditor = renderStoppageScheduleEditor;

function addStoppageRowToEditor(containerId, name = '', time = '') {
    const rowsContainer = document.getElementById(`${containerId}-rows`);
    if (!rowsContainer) return;
    const currentCount = rowsContainer.querySelectorAll('.stoppage-schedule-row').length;
    const div = document.createElement('div');
    div.innerHTML = getStoppageRowHtml(containerId, currentCount + 1, name, time);
    const rowEl = div.firstElementChild;
    rowsContainer.appendChild(rowEl);
    reindexStoppageRows(containerId);
}
window.addStoppageRowToEditor = addStoppageRowToEditor;

function removeStoppageRow(btn) {
    const row = btn.closest('.stoppage-schedule-row');
    if (!row) return;
    const container = row.closest('[id$="-rows"]');
    if (!container) { row.remove(); return; }
    const totalRows = container.querySelectorAll('.stoppage-schedule-row').length;
    if (totalRows <= 2) {
        alert('বাসের অন্তত ২টি স্টপেজ (শুরু ও শেষ গন্তব্য) থাকতে হবে (A bus must have at least 2 stoppages: origin and destination).');
        return;
    }
    row.remove();
    const parentContainerId = container.id.replace(/-rows$/, '');
    reindexStoppageRows(parentContainerId);
}
window.removeStoppageRow = removeStoppageRow;

function reindexStoppageRows(containerId) {
    const rowsContainer = document.getElementById(`${containerId}-rows`);
    if (!rowsContainer) return;
    rowsContainer.querySelectorAll('.stoppage-schedule-row').forEach((row, i) => {
        const seqEl = row.querySelector('.stoppage-seq');
        if (seqEl) seqEl.innerText = `#${i + 1}`;
    });
}
window.reindexStoppageRows = reindexStoppageRows;

function collectStoppageSchedule(containerId) {
    const rowsContainer = document.getElementById(`${containerId}-rows`);
    const stoppages = [];
    const stoppageTimings = {};
    if (!rowsContainer) return { stoppages, stoppageTimings };

    rowsContainer.querySelectorAll('.stoppage-schedule-row').forEach(row => {
        const nameInput = row.querySelector('.stoppage-name-input');
        const timeInput = row.querySelector('.stoppage-time-input');
        const name = (nameInput?.value || '').trim();
        const time = (timeInput?.value || '').trim();
        if (name) {
            stoppages.push(name);
            if (time) stoppageTimings[name] = time;
        }
    });

    return { stoppages, stoppageTimings };
}
window.collectStoppageSchedule = collectStoppageSchedule;

// ==========================================
// --- Dynamic Bus Seat Layout & Map Engine ---
// ==========================================

let activeSeatDesignerState = null;

function generateDefaultBusSeatLayout(config = {}) {
    const preset = config.preset || '2+3';
    let leftCols = config.leftCols !== undefined ? parseInt(config.leftCols, 10) : 2;
    let rightCols = config.rightCols !== undefined ? parseInt(config.rightCols, 10) : 3;
    let totalSeats = parseInt(config.totalSeats, 10) || 65;
    let hasBackRow = config.hasBackRow !== undefined ? Boolean(config.hasBackRow) : true;
    let backRowSeats = config.backRowSeats !== undefined ? parseInt(config.backRowSeats, 10) : (leftCols + rightCols);

    if (preset === '2+2') {
        leftCols = 2;
        rightCols = 2;
        backRowSeats = 4;
    } else if (preset === '2+3') {
        leftCols = 2;
        rightCols = 3;
        backRowSeats = 5;
    } else if (preset === '3+2') {
        leftCols = 3;
        rightCols = 2;
        backRowSeats = 5;
    } else if (preset === '1+2') {
        leftCols = 1;
        rightCols = 2;
        backRowSeats = 3;
    }

    const colsPerRow = Math.max(1, leftCols + rightCols);
    const standardSeatsNeeded = hasBackRow ? Math.max(0, totalSeats - backRowSeats) : totalSeats;
    const regularRows = Math.ceil(standardSeatsNeeded / colsPerRow);
    const totalRows = regularRows + (hasBackRow ? 1 : 0);

    const seats = [];
    let seatNum = 1;

    for (let r = 1; r <= regularRows; r++) {
        // Left side
        for (let c = 1; c <= leftCols; c++) {
            if (seatNum > totalSeats) break;
            const isWin = (c === 1);
            const isAisle = (c === leftCols);
            const type = isWin ? 'window' : (isAisle ? 'aisle' : 'middle');
            seats.push({
                id: `S${seatNum}`,
                number: String(seatNum),
                row: r,
                col: c,
                side: 'left',
                type: config.isSleeper ? 'sleeper' : type,
                isWindow: isWin,
                gender: 'all',
                active: true
            });
            seatNum++;
        }
        // Right side
        for (let c = 1; c <= rightCols; c++) {
            if (seatNum > totalSeats) break;
            const isWin = (c === rightCols);
            const isAisle = (c === 1);
            const type = isWin ? 'window' : (isAisle ? 'aisle' : 'middle');
            seats.push({
                id: `S${seatNum}`,
                number: String(seatNum),
                row: r,
                col: leftCols + c,
                side: 'right',
                type: config.isSleeper ? 'sleeper' : type,
                isWindow: isWin,
                gender: 'all',
                active: true
            });
            seatNum++;
        }
    }

    // Back Row (bench across back)
    if (hasBackRow && seatNum <= totalSeats) {
        const remaining = totalSeats - seatNum + 1;
        const count = Math.min(backRowSeats, remaining);
        for (let c = 1; c <= count; c++) {
            const isWin = (c === 1 || c === count);
            seats.push({
                id: `S${seatNum}`,
                number: String(seatNum),
                row: totalRows,
                col: c,
                side: 'back',
                type: config.isSleeper ? 'sleeper' : (isWin ? 'window' : 'middle'),
                isWindow: isWin,
                gender: 'all',
                active: true
            });
            seatNum++;
        }
    }

    return {
        version: 2,
        preset,
        category: config.isSleeper ? 'sleeper' : 'seater',
        totalSeats: seats.filter(s => s.active && s.type !== 'empty').length,
        leftCols,
        rightCols,
        totalRows,
        hasBackRow,
        backRowSeats,
        seats
    };
}
window.generateDefaultBusSeatLayout = generateDefaultBusSeatLayout;

function getBusEffectiveSeatLayout(bus) {
    if (!bus) return generateDefaultBusSeatLayout();
    let layout = bus.seatLayout || bus.seat_layout;
    if (typeof layout === 'string') {
        try { layout = JSON.parse(layout); } catch { layout = null; }
    }
    if (layout && Array.isArray(layout.seats) && layout.seats.length > 0) {
        return layout;
    }
    const t = bus.totalSeats || 65;
    return generateDefaultBusSeatLayout({
        totalSeats: t,
        preset: t <= 45 ? '2+2' : '2+3'
    });
}
window.getBusEffectiveSeatLayout = getBusEffectiveSeatLayout;

function ensureSeatDesignerModal() {
    let modal = document.getElementById('seatLayoutDesignerModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'seatLayoutDesignerModal';
    modal.className = 'fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 md:p-4 hidden';
    modal.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl max-w-5xl w-full border border-gray-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in duration-200">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 text-white px-5 py-4 flex justify-between items-center shrink-0">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">💺</span>
                    <div>
                        <h3 class="text-base md:text-lg font-black tracking-wide flex items-center gap-2">
                            <span>বাস সিট লেআউট ও নাম্বারিং বিল্ডার</span>
                            <span id="designerBusBadge" class="bg-amber-400 text-gray-950 font-black px-2.5 py-0.5 rounded-full text-xs">Bus</span>
                        </h3>
                        <p id="designerBusSubTitle" class="text-xs text-purple-200 font-medium">Configure real physical seat layout and numbering</p>
                    </div>
                </div>
                <button type="button" onclick="closeSeatLayoutDesigner()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg font-bold transition">✕</button>
            </div>

            <!-- Configuration & Presets Toolbar -->
            <div class="bg-gray-50 border-b border-gray-200 p-4 shrink-0 space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-black text-gray-700 uppercase tracking-wider">⚡ কুইক প্রিসেট:</span>
                    <button type="button" onclick="applySeatDesignerPreset('2+3', 65)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs transition">🚌 Express (2+3, 65 Seats)</button>
                    <button type="button" onclick="applySeatDesignerPreset('2+3', 55)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs transition">🚀 Superfast (2+3, 55 Seats)</button>
                    <button type="button" onclick="applySeatDesignerPreset('2+2', 45)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs transition">✨ Luxury / AC (2+2, 45 Seats)</button>
                    <button type="button" onclick="applySeatDesignerPreset('2+2', 52)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs transition">🌟 Deluxe (2+2, 52 Seats)</button>
                    <button type="button" onclick="applySeatDesignerPreset('2+2', 32)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs transition">🚐 Minibus (2+2, 32 Seats)</button>
                    <button type="button" onclick="applySeatDesignerPreset('1+2', 36, true)" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs transition">🛏️ Sleeper Berth (1+2, 36 Beds)</button>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-6 gap-3 items-end pt-1">
                    <div>
                        <label class="block text-[11px] font-bold text-gray-700 mb-1">${t('বাঁদিকের সিট', 'Left Column Seats')}:</label>
                        <select id="designerLeftCols" onchange="onSeatDesignerDimensionChange()" class="w-full text-xs font-bold border border-gray-300 rounded-lg p-2 bg-white">
                            <option value="1">১টি সিট (1 Column)</option>
                            <option value="2" selected>২টি সিট (2 Columns)</option>
                            <option value="3">৩টি সিট (3 Columns)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-gray-700 mb-1">${t('ডানদিকের সিট', 'Right Column Seats')}:</label>
                        <select id="designerRightCols" onchange="onSeatDesignerDimensionChange()" class="w-full text-xs font-bold border border-gray-300 rounded-lg p-2 bg-white">
                            <option value="1">১টি সিট (1 Column)</option>
                            <option value="2">২টি সিট (2 Columns)</option>
                            <option value="3" selected>৩টি সিট (3 Columns)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-gray-700 mb-1">${t('মোট সারি', 'Total Rows')}:</label>
                        <input type="number" id="designerTotalRows" min="3" max="25" value="13" onchange="onSeatDesignerDimensionChange()" class="w-full text-xs font-bold border border-gray-300 rounded-lg p-2 bg-white" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-gray-700 mb-1">পেছনের শেষ সারি:</label>
                        <label class="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-white cursor-pointer text-xs font-bold">
                            <input type="checkbox" id="designerHasBackRow" checked onchange="onSeatDesignerDimensionChange()" class="rounded text-purple-600 focus:ring-purple-500" />
                            <span>${t('টানা বেঞ্চ', 'Continuous Bench')}</span>
                        </label>
                    </div>
                    <div class="md:col-span-2 flex gap-2">
                        <button type="button" onclick="renumberSeatDesigner('1..N')" class="flex-1 bg-gray-900 hover:bg-black text-white text-xs font-bold py-2 rounded-lg shadow-sm transition">🔄 ১, ২, ৩... সাজান</button>
                        <button type="button" onclick="renumberSeatDesigner('S1..SN')" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold py-2 rounded-lg transition">S1, S2... সাজান</button>
                    </div>
                </div>
            </div>

            <!-- Body: Interactive Bus Floor + Seat Inspector -->
            <div class="flex-1 overflow-y-auto p-4 flex flex-col md:flex-row gap-4 bg-gray-100">
                <!-- Bus Floor Map -->
                <div class="flex-1 bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col items-center overflow-x-auto">
                    <!-- Front Cabin -->
                    <div class="w-full max-w-md bg-gray-800 text-white p-3 rounded-2xl mb-4 flex justify-between items-center shadow-inner text-xs font-bold">
                        <span class="flex items-center gap-1.5 text-amber-300">🛞 ${t('ড্রাইভার কেবিন', 'Driver Cabin')}</span>
                        <span class="text-gray-400">| করিডোর |</span>
                        <span class="flex items-center gap-1 text-emerald-400">🚪 ${t('প্রবেশদ্বার', 'Entry Gate')}</span>
                    </div>

                    <!-- Seats Grid -->
                    <div id="designerFloorGrid" class="w-full max-w-md space-y-2.5">
                        <!-- Dynamic rows injected here -->
                    </div>

                    <!-- Rear Indicator -->
                    <div class="w-full max-w-md mt-4 text-center text-xs font-bold text-gray-400 border-t border-dashed border-gray-300 pt-2">
                        ⬇️ ${t('বাসের পেছনের দিক', 'Rear of Bus')}
                    </div>
                </div>

                <!-- Seat Inspector Panel -->
                <div class="w-full md:w-80 bg-white rounded-2xl border border-gray-200 p-4 shadow-xs shrink-0 flex flex-col justify-between">
                    <div class="space-y-4">
                        <div class="border-b border-gray-100 pb-3 flex items-center justify-between">
                            <h4 class="text-xs font-black text-gray-900 uppercase tracking-wider">🎯 সিলেক্টেড সিট এডিটর</h4>
                            <span id="inspectorSeatBadge" class="bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded text-xs">কোনোটি নয়</span>
                        </div>

                        <div id="inspectorEmptyState" class="text-center py-8 text-gray-400 text-xs">
                            <span class="text-3xl block mb-2">👆</span>
                            ${t('বাসের যেকোনো সিটে ক্লিক করে নম্বর ও ধরন পরিবর্তন করুন।', 'Click any seat to customize its label and type (Window/Middle/Aisle).')}
                        </div>

                        <div id="inspectorForm" class="hidden space-y-3">
                            <div>
                                <label class="block text-xs font-bold text-gray-700 mb-1">${t('সিট নম্বর', 'Seat Number')}:</label>
                                <input type="text" id="inspectorSeatNumber" class="w-full text-sm font-black border border-purple-300 rounded-xl p-2.5 bg-purple-50/50 focus:bg-white text-gray-900" placeholder="e.g. 26 or A1" />
                                <span class="text-[10px] text-gray-500">বাসে যে নম্বরটি লেখা আছে ঠিক সেটি লিখুন।</span>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-gray-700 mb-1">${t('সিটের ধরন', 'Seat Type')}:</label>
                                <select id="inspectorSeatType" class="w-full text-xs font-bold border border-gray-300 rounded-xl p-2.5 bg-white">
                                    <option value="window">🪟 Window (জানালা পাশ)</option>
                                    <option value="middle">🪑 Middle (মাঝের সিট)</option>
                                    <option value="aisle">🚶 Aisle (করিডোর / হাটার পাশ)</option>
                                    <option value="sleeper">🛏️ Sleeper Berth (শোয়ার জায়গা)</option>
                                    <option value="empty">🚫 Empty Space (দরজা / গেট / ফাঁকা)</option>
                                </select>
                            </div>

                            <div class="pt-1 space-y-2">
                                <label class="flex items-center gap-2 p-2.5 border border-pink-200 rounded-xl bg-pink-50/50 cursor-pointer text-xs font-bold text-pink-900">
                                    <input type="checkbox" id="inspectorLadiesQuota" class="rounded text-pink-600 focus:ring-pink-500" />
                                    <span>👩 ${t('মহিলা সংরক্ষিত', 'Ladies Quota')}</span>
                                </label>
                                <label class="flex items-center gap-2 p-2.5 border border-gray-200 rounded-xl bg-gray-50 cursor-pointer text-xs font-bold text-gray-700">
                                    <input type="checkbox" id="inspectorSeatActive" checked class="rounded text-purple-600 focus:ring-purple-500" />
                                    <span>✅ ${t('সিট সক্রিয় রয়েছে', 'Seat is Active')}</span>
                                </label>
                            </div>

                            <button type="button" onclick="applyInspectorSeatChanges()" class="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-2.5 rounded-xl shadow-sm text-xs transition">
                                ${t('প্রয়োগ করুন', 'Apply to Seat')}
                            </button>
                        </div>
                    </div>

                    <!-- Live Summary Stats -->
                    <div class="border-t border-gray-200 pt-3 mt-4 text-xs space-y-1.5 text-gray-600">
                        <div class="flex justify-between font-bold text-gray-900">
                            <span>মোট কার্যকরী সিট:</span>
                            <span id="statActiveSeats" class="text-purple-700">65</span>
                        </div>
                        <div class="flex justify-between">
                            <span>🪟 ${t('জানালা', 'Window')}:</span>
                            <span id="statWindowSeats" class="font-bold">26</span>
                        </div>
                        <div class="flex justify-between">
                            <span>🚶 ${t('করিডোর', 'Aisle')}:</span>
                            <span id="statAisleSeats" class="font-bold">26</span>
                        </div>
                        <div class="flex justify-between">
                            <span>🪑 ${t('মাঝের সিট', 'Middle')}:</span>
                            <span id="statMiddleSeats" class="font-bold">13</span>
                        </div>
                        <div class="flex justify-between">
                            <span>👩 মহিলা সংরক্ষিত:</span>
                            <span id="statLadiesSeats" class="font-bold text-pink-600">0</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="bg-white border-t border-gray-200 px-5 py-3.5 flex justify-between items-center shrink-0">
                <span class="text-xs text-gray-500">পরিবর্তন করার পর অবশ্যই "লেআউট সেভ করুন" বাটনে ক্লিক করুন।</span>
                <div class="flex items-center gap-3">
                    <button type="button" onclick="closeSeatLayoutDesigner()" class="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition">${t('বাতিল', 'Cancel')}</button>
                    <button type="button" id="btnSaveSeatLayout" onclick="saveSeatLayoutFromDesigner()" class="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white shadow-md transition flex items-center gap-2">
                        <span>💾 ${t('লেআউট সংরক্ষণ করুন', 'Save Layout')}</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function openSeatLayoutDesigner(busId, portalRole = 'owner') {
    const db = (typeof getAppData === 'function') ? getAppData() : {};
    const bus = (db.buses || []).find(b => b.id === busId);
    if (!bus) {
        alert("Bus not found in system.");
        return;
    }

    const effectiveLayout = getBusEffectiveSeatLayout(bus);
    activeSeatDesignerState = {
        busId,
        bus,
        portalRole,
        layout: JSON.parse(JSON.stringify(effectiveLayout)),
        selectedSeatId: null
    };

    const modal = ensureSeatDesignerModal();
    modal.classList.remove('hidden');

    document.getElementById('designerBusBadge').innerText = `${bus.name} (${bus.busNumber || 'Express'})`;
    document.getElementById('designerBusSubTitle').innerText = `${bus.route || 'Pingla - Kolkata'} • Operator: ${bus.ownerName || 'Owner'}`;

    document.getElementById('designerLeftCols').value = activeSeatDesignerState.layout.leftCols || 2;
    document.getElementById('designerRightCols').value = activeSeatDesignerState.layout.rightCols || 3;
    document.getElementById('designerTotalRows').value = activeSeatDesignerState.layout.totalRows || 13;
    document.getElementById('designerHasBackRow').checked = Boolean(activeSeatDesignerState.layout.hasBackRow);

    renderSeatDesignerFloor();
}
window.openSeatLayoutDesigner = openSeatLayoutDesigner;

function closeSeatLayoutDesigner() {
    const modal = document.getElementById('seatLayoutDesignerModal');
    if (modal) modal.classList.add('hidden');
    activeSeatDesignerState = null;
}
window.closeSeatLayoutDesigner = closeSeatLayoutDesigner;

function renderSeatDesignerFloor() {
    if (!activeSeatDesignerState) return;
    const container = document.getElementById('designerFloorGrid');
    if (!container) return;
    container.innerHTML = "";

    const { layout, selectedSeatId } = activeSeatDesignerState;
    const leftCols = layout.leftCols || 2;
    const rightCols = layout.rightCols || 3;
    const totalRows = layout.totalRows || 13;
    const hasBackRow = layout.hasBackRow;

    // Group seats by row
    const rowMap = new Map();
    for (let r = 1; r <= totalRows; r++) rowMap.set(r, []);
    (layout.seats || []).forEach(seat => {
        if (!rowMap.has(seat.row)) rowMap.set(seat.row, []);
        rowMap.get(seat.row).push(seat);
    });

    for (let r = 1; r <= totalRows; r++) {
        const rowSeats = rowMap.get(r) || [];
        const isBack = (r === totalRows && hasBackRow);

        const rowDiv = document.createElement('div');
        rowDiv.className = "flex items-center justify-center gap-1.5 sm:gap-3 bg-gray-50/80 p-1.5 sm:p-2 rounded-xl border border-gray-200 mx-auto w-full max-w-[340px]";

        if (isBack) {
            // Continuous bench across back
            const benchGroup = document.createElement('div');
            benchGroup.className = "flex justify-center gap-1.5 w-full";
            rowSeats.sort((a, b) => a.col - b.col).forEach(seat => {
                benchGroup.appendChild(renderDesignerSeatButton(seat, selectedSeatId));
            });
            rowDiv.appendChild(benchGroup);
        } else {
            // Left Group
            const leftGroup = document.createElement('div');
            leftGroup.className = "flex gap-1.5";
            const leftSeats = rowSeats.filter(s => s.side === 'left').sort((a, b) => a.col - b.col);
            for (let c = 1; c <= leftCols; c++) {
                const seat = leftSeats.find(s => s.col === c);
                if (seat) {
                    leftGroup.appendChild(renderDesignerSeatButton(seat, selectedSeatId));
                } else {
                    const emptyBox = document.createElement('div');
                    emptyBox.className = "w-11 h-11 border border-dashed border-gray-300 rounded-lg";
                    leftGroup.appendChild(emptyBox);
                }
            }

            // Aisle
            const aisle = document.createElement('div');
            aisle.className = "w-4 text-center text-[10px] text-gray-300 font-bold select-none";
            aisle.innerText = "|";

            // Right Group
            const rightGroup = document.createElement('div');
            rightGroup.className = "flex gap-1.5";
            const rightSeats = rowSeats.filter(s => s.side === 'right').sort((a, b) => a.col - b.col);
            for (let c = 1; c <= rightCols; c++) {
                const targetCol = leftCols + c;
                const seat = rightSeats.find(s => s.col === targetCol);
                if (seat) {
                    rightGroup.appendChild(renderDesignerSeatButton(seat, selectedSeatId));
                } else {
                    const emptyBox = document.createElement('div');
                    emptyBox.className = "w-11 h-11 border border-dashed border-gray-300 rounded-lg";
                    rightGroup.appendChild(emptyBox);
                }
            }

            rowDiv.appendChild(leftGroup);
            rowDiv.appendChild(aisle);
            rowDiv.appendChild(rightGroup);
        }

        container.appendChild(rowDiv);
    }

    updateSeatDesignerStats();
}

function renderDesignerSeatButton(seat, selectedSeatId) {
    const isSelected = (seat.id === selectedSeatId);
    const btn = document.createElement('button');
    btn.type = "button";

    let borderClass = "border-gray-300 bg-white text-gray-800";
    let icon = "🪑";
    if (seat.type === 'window') {
        borderClass = "border-sky-400 bg-sky-50/70 text-sky-900";
        icon = "🪟";
    } else if (seat.type === 'aisle') {
        borderClass = "border-purple-300 bg-purple-50/70 text-purple-900";
        icon = "🚶";
    } else if (seat.type === 'sleeper') {
        borderClass = "border-amber-400 bg-amber-50/70 text-amber-900";
        icon = "🛏️";
    } else if (seat.type === 'empty') {
        borderClass = "border-dashed border-gray-300 bg-gray-100 text-gray-400 opacity-60";
        icon = "🚫";
    }

    if (seat.gender === 'female_only') {
        borderClass += " ring-2 ring-pink-400";
        icon = "👩";
    }

    if (!seat.active) {
        borderClass = "border-red-300 bg-red-50 text-red-500 opacity-50";
        icon = "❌";
    }

    if (isSelected) {
        borderClass += " ring-4 ring-purple-600 scale-105 z-10 shadow-md";
    }

    btn.className = `w-11 h-11 rounded-xl border-2 flex flex-col items-center justify-center text-[10px] font-bold transition ${borderClass}`;
    btn.title = `Seat ${seat.number} (${seat.type})`;
    btn.innerHTML = `<span class="truncate max-w-full px-0.5 leading-none">${seat.number}</span><span class="text-[8px] leading-none mt-0.5">${icon}</span>`;
    btn.onclick = () => selectSeatInDesigner(seat.id);
    return btn;
}

function selectSeatInDesigner(seatId) {
    if (!activeSeatDesignerState) return;
    activeSeatDesignerState.selectedSeatId = seatId;
    const seat = activeSeatDesignerState.layout.seats.find(s => s.id === seatId);

    const emptyState = document.getElementById('inspectorEmptyState');
    const form = document.getElementById('inspectorForm');
    const badge = document.getElementById('inspectorSeatBadge');

    if (!seat) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (form) form.classList.add('hidden');
        if (badge) badge.innerText = 'কোনোটি নয়';
        renderSeatDesignerFloor();
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (form) form.classList.remove('hidden');
    if (badge) badge.innerText = `Seat: ${seat.number}`;

    document.getElementById('inspectorSeatNumber').value = seat.number;
    document.getElementById('inspectorSeatType').value = seat.type || 'middle';
    document.getElementById('inspectorLadiesQuota').checked = (seat.gender === 'female_only');
    document.getElementById('inspectorSeatActive').checked = Boolean(seat.active !== false);

    renderSeatDesignerFloor();
}
window.selectSeatInDesigner = selectSeatInDesigner;

function applyInspectorSeatChanges() {
    if (!activeSeatDesignerState || !activeSeatDesignerState.selectedSeatId) return;
    const seat = activeSeatDesignerState.layout.seats.find(s => s.id === activeSeatDesignerState.selectedSeatId);
    if (!seat) return;

    const newNumber = document.getElementById('inspectorSeatNumber').value.trim();
    const newType = document.getElementById('inspectorSeatType').value;
    const isLadies = document.getElementById('inspectorLadiesQuota').checked;
    const isActive = document.getElementById('inspectorSeatActive').checked;

    if (newNumber) seat.number = newNumber;
    seat.type = newType;
    seat.isWindow = (newType === 'window');
    seat.gender = isLadies ? 'female_only' : 'all';
    seat.active = isActive;

    renderSeatDesignerFloor();
    updateSeatDesignerStats();
}
window.applyInspectorSeatChanges = applyInspectorSeatChanges;

function applySeatDesignerPreset(preset, totalSeats, isSleeper = false) {
    if (!activeSeatDesignerState) return;
    activeSeatDesignerState.layout = generateDefaultBusSeatLayout({
        preset,
        totalSeats,
        isSleeper
    });
    activeSeatDesignerState.selectedSeatId = null;

    document.getElementById('designerLeftCols').value = activeSeatDesignerState.layout.leftCols;
    document.getElementById('designerRightCols').value = activeSeatDesignerState.layout.rightCols;
    document.getElementById('designerTotalRows').value = activeSeatDesignerState.layout.totalRows;
    document.getElementById('designerHasBackRow').checked = Boolean(activeSeatDesignerState.layout.hasBackRow);

    const emptyState = document.getElementById('inspectorEmptyState');
    const form = document.getElementById('inspectorForm');
    if (emptyState) emptyState.classList.remove('hidden');
    if (form) form.classList.add('hidden');

    renderSeatDesignerFloor();
}
window.applySeatDesignerPreset = applySeatDesignerPreset;

function onSeatDesignerDimensionChange() {
    if (!activeSeatDesignerState) return;
    const leftCols = parseInt(document.getElementById('designerLeftCols').value, 10) || 2;
    const rightCols = parseInt(document.getElementById('designerRightCols').value, 10) || 3;
    const totalRows = parseInt(document.getElementById('designerTotalRows').value, 10) || 13;
    const hasBackRow = document.getElementById('designerHasBackRow').checked;

    const backSeats = hasBackRow ? (leftCols + rightCols) : 0;
    const regSeats = (totalRows - (hasBackRow ? 1 : 0)) * (leftCols + rightCols);
    const approxTotal = Math.max(10, regSeats + backSeats);

    activeSeatDesignerState.layout = generateDefaultBusSeatLayout({
        preset: `${leftCols}+${rightCols}`,
        leftCols,
        rightCols,
        totalSeats: approxTotal,
        hasBackRow,
        backRowSeats: (leftCols + rightCols)
    });
    activeSeatDesignerState.selectedSeatId = null;

    renderSeatDesignerFloor();
}
window.onSeatDesignerDimensionChange = onSeatDesignerDimensionChange;

function renumberSeatDesigner(format = '1..N') {
    if (!activeSeatDesignerState || !activeSeatDesignerState.layout) return;
    const seats = activeSeatDesignerState.layout.seats || [];
    let count = 1;
    seats.forEach(s => {
        if (s.active && s.type !== 'empty') {
            if (format === 'S1..SN') {
                s.number = `S${count}`;
            } else if (format === 'A1..') {
                const rowLetter = String.fromCharCode(65 + Math.min(25, (s.row || 1) - 1));
                s.number = `${rowLetter}${s.col || 1}`;
            } else {
                s.number = `${count}`;
            }
            count++;
        }
    });
    renderSeatDesignerFloor();
    updateSeatDesignerStats();
}
window.renumberSeatDesigner = renumberSeatDesigner;

function updateSeatDesignerStats() {
    if (!activeSeatDesignerState || !activeSeatDesignerState.layout) return;
    const seats = activeSeatDesignerState.layout.seats || [];
    const activeSeats = seats.filter(s => s.active && s.type !== 'empty');

    const totalEl = document.getElementById('statActiveSeats');
    const winEl = document.getElementById('statWindowSeats');
    const aisleEl = document.getElementById('statAisleSeats');
    const midEl = document.getElementById('statMiddleSeats');
    const ladiesEl = document.getElementById('statLadiesSeats');

    if (totalEl) totalEl.innerText = activeSeats.length;
    if (winEl) winEl.innerText = activeSeats.filter(s => s.type === 'window' || s.isWindow).length;
    if (aisleEl) aisleEl.innerText = activeSeats.filter(s => s.type === 'aisle').length;
    if (midEl) midEl.innerText = activeSeats.filter(s => s.type === 'middle').length;
    if (ladiesEl) ladiesEl.innerText = activeSeats.filter(s => s.gender === 'female_only').length;

    activeSeatDesignerState.layout.totalSeats = activeSeats.length;
}

async function saveSeatLayoutFromDesigner() {
    if (!activeSeatDesignerState) return;
    const { busId, bus, portalRole, layout } = activeSeatDesignerState;
    const btn = document.getElementById('btnSaveSeatLayout');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ সংরক্ষণ হচ্ছে...';
    }

    try {
        const endpoint = `/api/${portalRole}/buses/${encodeURIComponent(busId)}/seat-layout`;
        const res = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify({
                busId,
                totalSeats: layout.totalSeats,
                seatLayout: layout
            })
        });

        // Update local object
        bus.seatLayout = layout;
        bus.seat_layout = layout;
        bus.totalSeats = layout.totalSeats;
        bus.total_seats = layout.totalSeats;

        if (typeof showDropDownToast === 'function') {
            showDropDownToast('🎉 বাসের সিট লেআউট সফলভাবে সংরক্ষিত হয়েছে!', 'success');
        } else {
            alert('🎉 বাসের সিট লেআউট সফলভাবে সংরক্ষিত হয়েছে!');
        }

        closeSeatLayoutDesigner();

        if (portalRole === 'owner' && typeof loadOwnerBuses === 'function') {
            loadOwnerBuses();
        } else if (portalRole === 'admin' && typeof loadAdminBuses === 'function') {
            loadAdminBuses();
        }
    } catch (err) {
        console.error('Failed to save seat layout:', err);
        alert(`সিট লেআউট সেভ করতে সমস্যা হয়েছে: ${err.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}
window.saveSeatLayoutFromDesigner = saveSeatLayoutFromDesigner;

// =========================================================================
// Journey Status & Smart Dynamic GPS Tracking Window Engine
// =========================================================================
function getJourneyTrackingWindow(booking, bus = null) {
    if (!booking) {
        return { status: 'COMPLETED', labelBn: 'যাত্রা সম্পন্ন', labelEn: 'Completed', leadHours: 6 };
    }

    const appFlags = (typeof getAppData === 'function' && getAppData() && getAppData().featureFlags) || {};
    const expConfig = appFlags.expansionConfig || {};
    const liveTrackingCfg = expConfig.liveTracking || {};

    const isLeadWindowEnabled = (appFlags.trackingLeadWindowEnabled !== undefined)
        ? Boolean(appFlags.trackingLeadWindowEnabled)
        : (liveTrackingCfg.leadWindowEnabled !== false);

    const rawLeadHours = appFlags.trackingLeadHours !== undefined
        ? appFlags.trackingLeadHours
        : (liveTrackingCfg.leadHours !== undefined ? liveTrackingCfg.leadHours : 6);
    const leadHours = Math.max(0.1, parseFloat(rawLeadHours) || 6);

    const rawGraceMins = appFlags.trackingGraceMinutes !== undefined
        ? appFlags.trackingGraceMinutes
        : (liveTrackingCfg.graceMinutes !== undefined ? liveTrackingCfg.graceMinutes : 30);
    const graceMinutes = Math.max(0, parseInt(rawGraceMins, 10) || 30);

    const now = new Date();
    const dateStr = booking.date || booking.journey_date;
    if (!dateStr) {
        return { status: 'COMPLETED', labelBn: 'যাত্রা সম্পন্ন', labelEn: 'Completed', leadHours };
    }

    // 1. Parse Journey Date (supports YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY)
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    const isoMatch = String(dateStr).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const dmyMatch = String(dateStr).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

    if (isoMatch) {
        year = parseInt(isoMatch[1], 10);
        month = parseInt(isoMatch[2], 10) - 1;
        day = parseInt(isoMatch[3], 10);
    } else if (dmyMatch) {
        day = parseInt(dmyMatch[1], 10);
        month = parseInt(dmyMatch[2], 10) - 1;
        year = parseInt(dmyMatch[3], 10);
    } else {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            year = parsed.getFullYear();
            month = parsed.getMonth();
            day = parsed.getDate();
        }
    }

    // Time parser helper
    function parseTimeStr(tStr, defaultH = 7, defaultM = 0) {
        if (!tStr) return { hours: defaultH, minutes: defaultM };
        const s = String(tStr).trim();
        const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (ampmMatch) {
            let h = parseInt(ampmMatch[1], 10);
            const m = parseInt(ampmMatch[2], 10);
            const ampm = (ampmMatch[3] || '').toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            return { hours: h, minutes: m };
        }
        return { hours: defaultH, minutes: defaultM };
    }

    // 2. Determine Departure Time
    let timings = (bus && (bus.stoppageTimings || bus.stoppage_timings)) || {};
    if (typeof timings === 'string') {
        try { timings = JSON.parse(timings); } catch (_) { timings = {}; }
    }

    let departureTimeStr = booking.departureTime;
    if (!departureTimeStr && booking.boarding && timings && timings[booking.boarding]) {
        departureTimeStr = timings[booking.boarding];
    }
    if (!departureTimeStr && bus && bus.time) {
        departureTimeStr = bus.time;
    }
    if (!departureTimeStr) {
        departureTimeStr = '07:00 AM';
    }

    const depTime = parseTimeStr(departureTimeStr, 7, 0);
    const departureDate = new Date(year, month, day, depTime.hours, depTime.minutes, 0);

    // 3. Determine Arrival / Completion Time
    let droppingTimeStr = null;
    if (booking.dropping && timings && timings[booking.dropping]) {
        droppingTimeStr = timings[booking.dropping];
    }

    let arrivalDate = null;
    if (droppingTimeStr) {
        const arrTime = parseTimeStr(droppingTimeStr, depTime.hours + 3, depTime.minutes);
        let arrYear = year, arrMonth = month, arrDay = day;
        if (arrTime.hours < depTime.hours || (arrTime.hours === depTime.hours && arrTime.minutes < depTime.minutes)) {
            const nextDay = new Date(year, month, day + 1);
            arrYear = nextDay.getFullYear();
            arrMonth = nextDay.getMonth();
            arrDay = nextDay.getDate();
        }
        arrivalDate = new Date(arrYear, arrMonth, arrDay, arrTime.hours, arrTime.minutes, 0);
    } else {
        // Default travel duration: 4 hours
        arrivalDate = new Date(departureDate.getTime() + 4 * 60 * 60 * 1000);
    }

    // Add admin-configured grace period after arrival
    const completionDate = new Date(arrivalDate.getTime() + graceMinutes * 60 * 1000);

    // Tracking starts X hours before departure (or anytime if leadWindowEnabled is false)
    const trackStartDate = isLeadWindowEnabled 
        ? new Date(departureDate.getTime() - leadHours * 60 * 60 * 1000)
        : new Date(0); // If disabled, always allowed before completionDate

    // Check completed:
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const journeyMidnight = new Date(year, month, day).getTime();

    if (now.getTime() >= completionDate.getTime() || todayMidnight > journeyMidnight) {
        return {
            status: 'COMPLETED',
            departureDate,
            arrivalDate,
            trackStartDate,
            leadHours,
            labelBn: 'যাত্রা সম্পন্ন',
            labelEn: 'Journey Completed'
        };
    }

    // Check live active:
    if (now.getTime() >= trackStartDate.getTime() && now.getTime() < completionDate.getTime()) {
        return {
            status: 'LIVE_ACTIVE',
            departureDate,
            arrivalDate,
            trackStartDate,
            leadHours,
            labelBn: 'লাইভ ট্র্যাক',
            labelEn: 'Track Live'
        };
    }

    // Upcoming:
    const diffMs = trackStartDate.getTime() - now.getTime();
    const hoursLeft = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
    return {
        status: 'UPCOMING',
        departureDate,
        arrivalDate,
        trackStartDate,
        leadHours,
        hoursUntilTrack: hoursLeft,
        labelBn: `ট্র্যাকিং ${leadHours} ঘণ্টা আগে চালু হবে`,
        labelEn: `Tracking opens ${leadHours}h before`
    };
}
window.getJourneyTrackingWindow = getJourneyTrackingWindow;

// =========================================================================
// Festival & Seasonal Theme Engine (1-Click Admin Remote Control)
// Supports: Diwali, Durga Puja, Eid, New Year/Christmas, Holi, Independence Day
// =========================================================================

const BUS_YATRA_FESTIVALS = {
    diwali: {
        id: 'diwali',
        nameBn: 'শুভ দীপাবলি ও শ্যামাপূজা',
        nameEn: 'Diwali & Kali Puja',
        icon: '🪔',
        badgeClass: 'bg-amber-500 text-amber-950',
        ribbonGradient: 'from-amber-400 via-orange-500 to-yellow-400',
        bannerGradient: 'from-amber-500/15 via-orange-500/10 to-yellow-500/15 border-amber-300',
        tagBg: 'bg-amber-100 text-amber-900 border-amber-300',
        defaultGreetingBn: '✨ শুভ দীপাবলি ও শ্যামাপূজার আন্তরিক প্রীতি ও শুভেচ্ছা! উৎসবের দিনে নিরাপদে বাড়ি ফিরুন বাস যাত্রার সাথে।',
        defaultGreetingEn: '✨ Happy Diwali & Kali Puja! Celebrate with joy and travel safe with Bus Yatra.'
    },
    durga_puja: {
        id: 'durga_puja',
        nameBn: 'শুভ শারদীয়া দুর্গোৎসব',
        nameEn: 'Sharodiya Durga Puja',
        icon: '🥁',
        badgeClass: 'bg-rose-600 text-white',
        ribbonGradient: 'from-red-600 via-amber-400 to-rose-600',
        bannerGradient: 'from-red-500/15 via-amber-500/10 to-rose-500/15 border-red-300',
        tagBg: 'bg-red-100 text-red-900 border-red-300',
        defaultGreetingBn: '🌸 শুভ শারদীয়ার প্রীতি ও শুভেচ্ছা! ঢাকের তালে পুজোয় পরিবারের সাথে কাটান মধুর সময়—বাস যাত্রা সবসময় আপনার পাশে।',
        defaultGreetingEn: '🌸 Shubho Sharodiya! Travel to your loved ones this Durga Puja with Bus Yatra.'
    },
    eid: {
        id: 'eid',
        nameBn: 'পবিত্র ঈদ মোবারক',
        nameEn: 'Eid Mubarak',
        icon: '🌙',
        badgeClass: 'bg-emerald-600 text-white',
        ribbonGradient: 'from-emerald-500 via-teal-400 to-emerald-600',
        bannerGradient: 'from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-emerald-300',
        tagBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        defaultGreetingBn: '🌙 পবিত্র ঈদের আন্তরিক শুভেচ্ছা ও মোবারকবাদ! প্রিয়জনদের কাছে পৌঁছানোর সেরা ভরসা বাস যাত্রা।',
        defaultGreetingEn: '🌙 Eid Mubarak! Wishing you peace, joy and safe festive travels with Bus Yatra.'
    },
    new_year: {
        id: 'new_year',
        nameBn: 'শুভ নববর্ষ ও বড়দিন',
        nameEn: 'Happy New Year & Christmas',
        icon: '🎉',
        badgeClass: 'bg-indigo-600 text-white',
        ribbonGradient: 'from-blue-600 via-purple-500 to-indigo-600',
        bannerGradient: 'from-blue-500/15 via-purple-500/10 to-indigo-500/15 border-blue-300',
        tagBg: 'bg-blue-100 text-blue-900 border-blue-300',
        defaultGreetingBn: '🎉 আপনাকে ও আপনার পরিবারকে শুভ নববর্ষ ও বড়দিনের আন্তরিক অভিনন্দন! নতুন বছরের প্রতি সফরে বাস যাত্রা আপনার বিশ্বস্ত সঙ্গী।',
        defaultGreetingEn: '🎉 Happy New Year & Merry Christmas! Travel smoothly into the new year with Bus Yatra.'
    },
    holi: {
        id: 'holi',
        nameBn: 'শুভ দোলযাত্রা ও হোলি',
        nameEn: 'Happy Holi & Dol Jatra',
        icon: '🎨',
        badgeClass: 'bg-pink-600 text-white',
        ribbonGradient: 'from-pink-500 via-yellow-400 to-purple-500',
        bannerGradient: 'from-pink-500/15 via-yellow-500/10 to-purple-500/15 border-pink-300',
        tagBg: 'bg-pink-100 text-pink-900 border-pink-300',
        defaultGreetingBn: '🎨 রঙের উৎসবে ভরে উঠুক আপনার জীবন! রঙের দিনে আনন্দময় ও আরামদায়ক সফরের জন্য বাস বুক করুন সহজে।',
        defaultGreetingEn: '🎨 Wishing you a joyous and colorful Holi! Plan your festival trips with Bus Yatra.'
    },
    independence: {
        id: 'independence',
        nameBn: 'স্বাধীনতা ও প্রজাতন্ত্র দিবস',
        nameEn: 'Independence & Republic Day',
        icon: '🇮🇳',
        badgeClass: 'bg-orange-500 text-white',
        ribbonGradient: 'from-orange-500 via-white to-emerald-600',
        bannerGradient: 'from-orange-500/15 via-slate-100 to-emerald-500/15 border-orange-300',
        tagBg: 'bg-orange-100 text-orange-900 border-orange-300',
        defaultGreetingBn: '🇮🇳 দেশের প্রতিটি কোণে নিরাপদ, স্বচ্ছ ও সুলভ যাত্রী সেবা পৌঁছে দিতে আমরা দায়বদ্ধ। জয় হিন্দ!',
        defaultGreetingEn: '🇮🇳 Proudly connecting every corner of India with safe and comfortable bus travel. Jai Hind!'
    }
};
window.BUS_YATRA_FESTIVALS = BUS_YATRA_FESTIVALS;

let activeFestivalThemeState = null;

function applyFestivalTheme(theme, portalName) {
    activeFestivalThemeState = theme;
    const isBn = typeof isBengali === 'function' ? isBengali() : true;

    // Check if enabled for this portal
    const isTargeted = theme && theme.enabled === true && theme.targets && (theme.targets[portalName] === true || theme.targets.all === true);
    const festKey = theme ? theme.festival : 'none';
    const fest = BUS_YATRA_FESTIVALS[festKey];

    // Clean up existing decorative elements
    const oldRibbon = document.getElementById('festivalHeaderRibbon');
    if (oldRibbon) oldRibbon.remove();
    const oldLogoBadge = document.getElementById('festivalLogoBadge');
    if (oldLogoBadge) oldLogoBadge.remove();
    const bannerEl = document.getElementById('festivalGreetingBanner');
    if (bannerEl) bannerEl.classList.add('hidden');
    const portalPill = document.getElementById('festivalHeaderPill');
    if (portalPill) portalPill.classList.add('hidden');

    const faviconLink = document.querySelector('link[rel="icon"]');
    const appleIconLink = document.querySelector('link[rel="apple-touch-icon"]');
    const manifestLink = document.querySelector('link[rel="manifest"]');

    if (!isTargeted || !fest) {
        // Revert all logos, favicons, and manifest to clean default
        document.querySelectorAll('img[src*="logo-customer-"]').forEach(img => {
            img.src = 'icons/logo-customer.png';
        });
        if (faviconLink) faviconLink.href = 'icons/favicon.png';
        if (appleIconLink) appleIconLink.href = 'icons/icon-192.png';
        if (manifestLink) manifestLink.href = portalName === 'owner' ? 'manifest-owner.json' : (portalName === 'captain' ? 'manifest-captain.json' : (portalName === 'admin' ? 'manifest-admin.json' : 'manifest.json'));
        if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SET_FESTIVAL_THEME', festival: 'none' });
        }
        return; // Normal clean default
    }

    // 0. Update In-App Logos, Favicons & Manifest to Festival Edition
    const festLogoSrc = festKey === 'diwali' ? 'icons/logo-customer-diwali.png' : `icons/logo-customer-${festKey}.png`;
    const festFaviconSrc = festKey === 'diwali' ? 'icons/favicon-diwali.png' : `icons/icon-${festKey}-192.png`;
    const festAppleIconSrc = `icons/icon-${festKey}-192.png`;
    const festManifestSrc = festKey === 'diwali' ? 'manifest-diwali.json' : 'manifest.json';

    document.querySelectorAll('img[src*="logo-customer"]').forEach(img => {
        img.src = festLogoSrc;
    });
    if (faviconLink) faviconLink.href = festFaviconSrc;
    if (appleIconLink) appleIconLink.href = festAppleIconSrc;
    if (manifestLink && portalName === 'customer') manifestLink.href = festManifestSrc;

    if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SET_FESTIVAL_THEME', festival: festKey });
    }

    // 1. Add festive top ribbon above header
    const header = document.querySelector('header');
    if (header && !document.getElementById('festivalHeaderRibbon')) {
        const ribbon = document.createElement('div');
        ribbon.id = 'festivalHeaderRibbon';
        ribbon.className = `w-full h-1.5 bg-gradient-to-r ${fest.ribbonGradient} shadow-xs animate-pulse`;
        header.parentNode.insertBefore(ribbon, header);
    }

    // 2. Add decorative festival badge overlay on header logo
    const logoImg = document.querySelector('header img[src*="logo-"]');
    if (logoImg && logoImg.parentElement && !document.getElementById('festivalLogoBadge')) {
        logoImg.parentElement.classList.add('relative');
        const badge = document.createElement('span');
        badge.id = 'festivalLogoBadge';
        badge.className = 'absolute -bottom-1 -right-1 text-sm filter drop-shadow select-none pointer-events-none transform hover:scale-125 transition-transform duration-300';
        badge.innerHTML = fest.icon;
        badge.title = isBn ? fest.nameBn : fest.nameEn;
        logoImg.parentElement.appendChild(badge);
    }

    // 3. Render Greeting Banner (if Customer Portal)
    if (portalName === 'customer' && bannerEl) {
        const greetingText = theme.greeting && theme.greeting.trim()
            ? theme.greeting.trim()
            : (isBn ? fest.defaultGreetingBn : fest.defaultGreetingEn);
        const titleText = isBn ? fest.nameBn : fest.nameEn;

        bannerEl.className = `mt-3 p-3.5 rounded-2xl border ${fest.bannerGradient} shadow-xs flex items-center justify-between gap-3 transition-all`;
        bannerEl.innerHTML = `
            <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-2xl sm:text-3xl shrink-0 filter drop-shadow">${fest.icon}</span>
                <div class="min-w-0 text-left">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs sm:text-sm font-black text-gray-900 tracking-tight">${escapeHtml(titleText)}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${fest.tagBg}">উৎসব স্পেশাল</span>
                    </div>
                    <p class="text-[11px] sm:text-xs text-gray-700 mt-0.5 leading-snug line-clamp-2">${escapeHtml(greetingText)}</p>
                </div>
            </div>
            <button type="button" onclick="document.getElementById('festivalGreetingBanner').classList.add('hidden')" class="text-gray-400 hover:text-gray-700 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0" title="বন্ধ করুন">✕</button>
        `;
    }

    // 4. Render Portal Header Pill (for Owner / Captain / Admin)
    if ((portalName === 'owner' || portalName === 'captain' || portalName === 'admin') && portalPill) {
        portalPill.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${fest.tagBg} shadow-xs`;
        portalPill.innerHTML = `<span>${fest.icon}</span> <span class="hidden sm:inline">${escapeHtml(isBn ? fest.nameBn : fest.nameEn)}</span>`;
    }
}
window.applyFestivalTheme = applyFestivalTheme;

function initFestivalThemeSync(portalName) {
    if (typeof window === 'undefined') return;

    // 1. Initial fetch from API (with Firebase cross-domain fallback)
    let fetchUrl = '/api/festival-theme';
    if (typeof window !== 'undefined' && window.location) {
        const host = window.location.hostname;
        if (host.includes('web.app') || host.includes('firebaseapp.com')) {
            fetchUrl = 'https://busyatra.pages.dev/api/festival-theme';
        }
    }

    fetch(fetchUrl)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (data && data.festivalTheme) {
                applyFestivalTheme(data.festivalTheme, portalName);
            }
        })
        .catch(() => {});

    // 2. Real-time Firebase Firestore listener (<100ms instant sync across all users)
    try {
        const firestore = typeof getBusYatraFirestore === 'function' ? getBusYatraFirestore() : null;
        if (firestore) {
            firestore.collection('system_config').doc('festivalTheme')
                .onSnapshot(doc => {
                    if (doc.exists) {
                        applyFestivalTheme(doc.data(), portalName);
                    }
                }, () => {});
        }
    } catch (_) {}
}
window.initFestivalThemeSync = initFestivalThemeSync;

function showToast(message, duration = 3500) {
    if (typeof document === 'undefined' || !document.body) return;
    let toast = document.getElementById('busYatraGlobalToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'busYatraGlobalToast';
        toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-2xl bg-gray-900/95 text-white text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 border border-white/20 transition-all duration-300 opacity-0 pointer-events-none transform translate-y-2';
        document.body.appendChild(toast);
    }
    toast.innerHTML = message;
    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
    }, duration);
}
window.showToast = showToast;
function showDropDownToast(message, type = 'info', duration = 3500) {
    showToast(message, duration);
}
window.showDropDownToast = showDropDownToast;

// --- Universal Lightbox / Photo Viewer Modal ---
function openPhotoViewerModal(url) {
    if (!url) return;
    let modal = document.getElementById('globalPhotoViewerModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'globalPhotoViewerModal';
        modal.className = 'fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-3 backdrop-blur-md transition-opacity duration-300';
        modal.innerHTML = `
            <div class="w-full max-w-4xl flex justify-between items-center text-white mb-2 px-2">
                <span class="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                    <span>🖼️</span> <span>Image Preview / ছবির প্রিভিউ</span>
                </span>
                <button type="button" onclick="closePhotoViewerModal()" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-base transition cursor-pointer">✕</button>
            </div>
            <div class="relative max-w-full max-h-[85vh] flex items-center justify-center p-1">
                <img id="globalPhotoViewerImg" src="" class="max-h-[82vh] max-w-[95vw] rounded-2xl shadow-2xl object-contain border border-white/20">
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closePhotoViewerModal();
        });
    }
    const img = document.getElementById('globalPhotoViewerImg');
    if (img) img.src = url;
    modal.classList.remove('hidden');
}
function closePhotoViewerModal() {
    const modal = document.getElementById('globalPhotoViewerModal');
    if (modal) modal.classList.add('hidden');
}
window.openPhotoViewerModal = openPhotoViewerModal;
window.closePhotoViewerModal = closePhotoViewerModal;

// --- Universal Voice & Speech Audio Playback ---
function speakAiText(text) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const cleanText = String(text || '').replace(/[*#_•]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!cleanText) return;
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = (typeof currentPortalLang !== 'undefined' && currentPortalLang === 'bn') || /[\u0980-\u09FF]/.test(cleanText) ? 'bn-IN' : 'en-IN';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('Speech synthesis notice:', e);
    }
}
window.speakAiText = speakAiText;

// --- Universal Customer AI Support Modal Handler ---
function openCustomerAiSupportModal() {
    const modal = document.getElementById('customerAiSupportModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
    if (typeof window.initCustomerAiSupportTicket === 'function') {
        window.initCustomerAiSupportTicket();
    }
    if (typeof window.renderCustomerAiChatHistory === 'function') {
        const tkt = window.customerSupportActiveTicket;
        window.renderCustomerAiChatHistory(tkt ? (tkt.messages || []) : []);
    }
    if (typeof window.syncCustomerTicketFromServer === 'function') {
        window.syncCustomerTicketFromServer();
    }
    setTimeout(() => {
        if (typeof window.scrollAiChatToBottom === 'function') window.scrollAiChatToBottom();
    }, 100);
}
window.openCustomerAiSupportModal = openCustomerAiSupportModal;

function closeCustomerAiSupportModal() {
    const modal = document.getElementById('customerAiSupportModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    if (window.aiSupportPollTimer) clearInterval(window.aiSupportPollTimer);
    if (typeof window.stopAiVoiceRecognition === 'function') {
        window.stopAiVoiceRecognition();
    }
}
window.closeCustomerAiSupportModal = closeCustomerAiSupportModal;

// ==========================================
// BUS YATRA PREMIUM IN-APP CONFIRMATION BOTTOM SHEET & MODAL
// Replaces raw browser window.confirm() with RedBus / MakeMyTrip style bottom sheet
// ==========================================
function ensureBusYatraConfirmSheet() {
    let sheet = document.getElementById('busYatraConfirmSheet');
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.id = 'busYatraConfirmSheet';
    sheet.className = 'fixed inset-0 z-[99999] bg-black/75 backdrop-blur-sm hidden items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-300 select-none';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');

    sheet.innerHTML = `
        <div id="busYatraConfirmCard" class="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all duration-300 translate-y-full sm:translate-y-4 opacity-0 flex flex-col">
            <!-- Mobile Drag Handle Bar -->
            <div class="sm:hidden flex justify-center pt-3 pb-1">
                <div class="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>

            <!-- Content Body -->
            <div class="p-5 sm:p-6 text-center space-y-3">
                <!-- Hero Visual Icon Circle -->
                <div class="flex justify-center">
                    <div id="busYatraConfirmIconWrap" class="w-16 h-16 rounded-3xl bg-red-50 border-2 border-red-100 flex items-center justify-center shadow-inner transition-transform duration-300 transform scale-90">
                        <span id="busYatraConfirmIcon" class="text-3xl">🚪</span>
                    </div>
                </div>

                <!-- Title & Description -->
                <div>
                    <h3 id="busYatraConfirmTitle" class="text-base sm:text-lg font-black text-gray-900 leading-snug">
                        আপনি কি লগআউট করতে চান?
                    </h3>
                    <p id="busYatraConfirmSubtitle" class="text-xs sm:text-sm text-gray-500 font-medium mt-1.5 leading-relaxed max-w-sm mx-auto">
                        লগআউট করলে পরবর্তীতে আপনার টিকিট দেখতে আবার মোবাইল নম্বর দিয়ে লগইন করতে হবে।
                    </p>
                </div>

                <!-- Custom Highlight Badge (Optional) -->
                <div id="busYatraConfirmBadgeWrap" class="hidden">
                    <span id="busYatraConfirmBadge" class="inline-block text-[11px] font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200"></span>
                </div>

                <!-- Action Buttons (Bottom Sheet Dual Hierarchy) -->
                <div class="pt-3 space-y-2">
                    <button type="button" id="busYatraConfirmBtnOk" class="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 active:scale-[0.98] text-white py-3.5 px-4 rounded-2xl font-black text-sm shadow-md shadow-red-500/25 transition cursor-pointer flex items-center justify-center gap-2">
                        <span id="busYatraConfirmBtnOkText">হ্যাঁ, নিশ্চিত করুন</span>
                    </button>
                    <button type="button" id="busYatraConfirmBtnCancel" class="w-full bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-700 py-3 px-4 rounded-2xl font-bold text-xs transition cursor-pointer">
                        <span id="busYatraConfirmBtnCancelText">না, বাতিল</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(sheet);
    return sheet;
}

function showBusYatraConfirm(options = {}) {
    return new Promise((resolve) => {
        if (typeof options === 'string') {
            const rawMsg = options;
            const isDanger = rawMsg.includes('ডিলিট') || rawMsg.includes('মুছে') || rawMsg.includes('delete') || rawMsg.includes('ব্যান') || rawMsg.includes('ban') || rawMsg.includes('সতর্কতা') || rawMsg.includes('WARNING') || rawMsg.includes('CRITICAL') || rawMsg.includes('remove');
            options = {
                title: isDanger ? 'সতর্কতা ও নিশ্চিতকরণ' : 'নিশ্চিতকরণ',
                subtitle: rawMsg,
                icon: isDanger ? '🗑️' : '❓',
                confirmText: isDanger ? 'হ্যাঁ, নিশ্চিত অগ্রসর হন' : 'হ্যাঁ, নিশ্চিত করুন',
                cancelText: 'না, বাতিল',
                danger: isDanger
            };
        }

        const sheet = ensureBusYatraConfirmSheet();
        const card = document.getElementById('busYatraConfirmCard');
        const iconWrap = document.getElementById('busYatraConfirmIconWrap');
        const iconEl = document.getElementById('busYatraConfirmIcon');
        const titleEl = document.getElementById('busYatraConfirmTitle');
        const subtitleEl = document.getElementById('busYatraConfirmSubtitle');
        const badgeWrap = document.getElementById('busYatraConfirmBadgeWrap');
        const badgeEl = document.getElementById('busYatraConfirmBadge');
        const btnOk = document.getElementById('busYatraConfirmBtnOk');
        const btnOkText = document.getElementById('busYatraConfirmBtnOkText');
        const btnCancel = document.getElementById('busYatraConfirmBtnCancel');
        const btnCancelText = document.getElementById('busYatraConfirmBtnCancelText');

        const {
            title = 'আপনি কি নিশ্চিত?',
            subtitle = '',
            icon = '❓',
            confirmText = 'হ্যাঁ, নিশ্চিত করুন',
            cancelText = 'না, বাতিল',
            badge = '',
            danger = true
        } = options;

        if (titleEl) titleEl.innerText = title;
        if (subtitleEl) {
            subtitleEl.innerHTML = (subtitle || '').replace(/\n/g, '<br>');
            subtitleEl.classList.toggle('hidden', !subtitle);
        }
        if (iconEl) iconEl.innerText = icon;

        if (badgeEl && badgeWrap) {
            if (badge) {
                badgeEl.innerText = badge;
                badgeWrap.classList.remove('hidden');
            } else {
                badgeWrap.classList.add('hidden');
            }
        }

        if (btnOkText) btnOkText.innerText = confirmText;
        if (btnCancelText) btnCancelText.innerText = cancelText;

        if (danger) {
            if (iconWrap) iconWrap.className = 'w-16 h-16 rounded-3xl bg-red-50 border-2 border-red-200 flex items-center justify-center shadow-inner transition-transform duration-300';
            if (btnOk) btnOk.className = 'w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 active:scale-[0.98] text-white py-3.5 px-4 rounded-2xl font-black text-sm shadow-md shadow-red-500/25 transition cursor-pointer flex items-center justify-center gap-2';
        } else {
            if (iconWrap) iconWrap.className = 'w-16 h-16 rounded-3xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center shadow-inner transition-transform duration-300';
            if (btnOk) btnOk.className = 'w-full bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 hover:from-emerald-700 hover:to-green-800 active:scale-[0.98] text-white py-3.5 px-4 rounded-2xl font-black text-sm shadow-md shadow-emerald-500/25 transition cursor-pointer flex items-center justify-center gap-2';
        }

        // Display sheet with smooth animation
        sheet.classList.remove('hidden');
        sheet.classList.add('flex');
        
        requestAnimationFrame(() => {
            if (card) {
                card.classList.remove('translate-y-full', 'sm:translate-y-4', 'opacity-0');
                card.classList.add('translate-y-0', 'opacity-100');
            }
            if (iconWrap) {
                iconWrap.classList.remove('scale-90');
                iconWrap.classList.add('scale-100');
            }
        });

        function cleanup(result) {
            if (card) {
                card.classList.add('translate-y-full', 'opacity-0');
                card.classList.remove('translate-y-0', 'opacity-100');
            }
            setTimeout(() => {
                sheet.classList.add('hidden');
                sheet.classList.remove('flex');
                sheet.removeEventListener('click', onBackdropClick);
                document.removeEventListener('keydown', onKeyDown);
                resolve(result);
            }, 250);
        }

        btnOk.onclick = () => cleanup(true);
        btnCancel.onclick = () => cleanup(false);

        function onBackdropClick(e) {
            if (e.target === sheet) cleanup(false);
        }
        sheet.addEventListener('click', onBackdropClick);

        function onKeyDown(e) {
            if (e.key === 'Escape') cleanup(false);
        }
        document.addEventListener('keydown', onKeyDown);
    });
}
window.showBusYatraConfirm = showBusYatraConfirm;
window.showConfirmDialog = showBusYatraConfirm;
window.showConfirmModal = showBusYatraConfirm;
window.confirmAsync = showBusYatraConfirm;

// ==========================================
// BUS YATRA PREMIUM IN-APP ALERT MODAL & BOTTOM SHEET
// Replaces raw browser window.alert() with RedBus / MakeMyTrip style bottom sheet
// ==========================================
function ensureBusYatraAlertSheet() {
    let sheet = document.getElementById('busYatraAlertSheet');
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.id = 'busYatraAlertSheet';
    sheet.className = 'fixed inset-0 z-[100000] bg-black/75 backdrop-blur-sm hidden items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-300 select-none';
    sheet.setAttribute('role', 'alertdialog');
    sheet.setAttribute('aria-modal', 'true');

    sheet.innerHTML = `
        <div id="busYatraAlertCard" class="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all duration-300 translate-y-full sm:translate-y-4 opacity-0 flex flex-col">
            <!-- Mobile Drag Handle Bar -->
            <div class="sm:hidden flex justify-center pt-3 pb-1">
                <div class="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>

            <!-- Content Body -->
            <div class="p-5 sm:p-6 text-center space-y-3">
                <!-- Hero Visual Icon Circle -->
                <div class="flex justify-center">
                    <div id="busYatraAlertIconWrap" class="w-16 h-16 rounded-3xl bg-amber-50 border-2 border-amber-100 flex items-center justify-center shadow-inner transition-transform duration-300 transform scale-90">
                        <span id="busYatraAlertIcon" class="text-3xl">🔔</span>
                    </div>
                </div>

                <!-- Title & Description -->
                <div>
                    <h3 id="busYatraAlertTitle" class="text-base sm:text-lg font-black text-gray-900 leading-snug">
                        বিজ্ঞপ্তি
                    </h3>
                    <div id="busYatraAlertSubtitle" class="text-xs sm:text-sm text-gray-600 font-medium mt-1.5 leading-relaxed max-w-sm mx-auto whitespace-pre-line text-left sm:text-center">
                    </div>
                </div>

                <!-- Custom Highlight Badge (Optional) -->
                <div id="busYatraAlertBadgeWrap" class="hidden">
                    <span id="busYatraAlertBadge" class="inline-block text-[11px] font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200"></span>
                </div>

                <!-- Action Button -->
                <div class="pt-3">
                    <button type="button" id="busYatraAlertBtnOk" class="w-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-300 active:scale-[0.98] text-gray-950 py-3.5 px-4 rounded-2xl font-black text-sm shadow-md shadow-amber-500/25 transition cursor-pointer flex items-center justify-center gap-2">
                        <span id="busYatraAlertBtnOkText">ঠিক আছে (OK)</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(sheet);
    return sheet;
}

function showBusYatraAlert(options = {}) {
    return new Promise((resolve) => {
        if (typeof options === 'string' || typeof options === 'number') {
            const rawMsg = String(options || '');
            let detectedIcon = '🔔';
            let detectedTitle = 'বিজ্ঞপ্তি';
            let theme = 'info';

            if (rawMsg.includes('সফল') || rawMsg.includes('🎉') || rawMsg.includes('✅') || rawMsg.toLowerCase().includes('success')) {
                detectedIcon = '✅';
                detectedTitle = 'সফল হয়েছে!';
                theme = 'success';
            } else if (rawMsg.includes('⚠️') || rawMsg.includes('ভুল') || rawMsg.includes('সমস্যা') || rawMsg.toLowerCase().includes('error') || rawMsg.toLowerCase().includes('failed') || rawMsg.toLowerCase().includes('invalid')) {
                detectedIcon = '⚠️';
                detectedTitle = 'সতর্কতা';
                theme = 'warning';
            } else if (rawMsg.includes('🚨') || rawMsg.includes('জরুরি') || rawMsg.includes('SOS')) {
                detectedIcon = '🚨';
                detectedTitle = 'জরুরি বার্তা';
                theme = 'danger';
            }

            options = {
                title: detectedTitle,
                message: rawMsg,
                icon: detectedIcon,
                theme: theme
            };
        }

        const sheet = ensureBusYatraAlertSheet();
        const card = document.getElementById('busYatraAlertCard');
        const iconWrap = document.getElementById('busYatraAlertIconWrap');
        const iconEl = document.getElementById('busYatraAlertIcon');
        const titleEl = document.getElementById('busYatraAlertTitle');
        const subtitleEl = document.getElementById('busYatraAlertSubtitle');
        const badgeWrap = document.getElementById('busYatraAlertBadgeWrap');
        const badgeEl = document.getElementById('busYatraAlertBadge');
        const btnOk = document.getElementById('busYatraAlertBtnOk');
        const btnOkText = document.getElementById('busYatraAlertBtnOkText');

        const {
            title = 'বিজ্ঞপ্তি',
            message = '',
            subtitle = '',
            icon = '🔔',
            okText = 'ঠিক আছে (OK)',
            badge = '',
            theme = 'info'
        } = options;

        const content = message || subtitle || '';

        if (titleEl) titleEl.innerText = title;
        if (subtitleEl) {
            subtitleEl.innerHTML = content.replace(/\n/g, '<br>');
        }
        if (iconEl) iconEl.innerText = icon;

        if (badgeEl && badgeWrap) {
            if (badge) {
                badgeEl.innerText = badge;
                badgeWrap.classList.remove('hidden');
            } else {
                badgeWrap.classList.add('hidden');
            }
        }

        if (btnOkText) btnOkText.innerText = okText;

        if (theme === 'success') {
            if (iconWrap) iconWrap.className = 'w-16 h-16 rounded-3xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center shadow-inner transition-transform duration-300';
            if (btnOk) btnOk.className = 'w-full bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 hover:from-emerald-700 hover:to-green-800 active:scale-[0.98] text-white py-3.5 px-4 rounded-2xl font-black text-sm shadow-md shadow-emerald-500/25 transition cursor-pointer flex items-center justify-center gap-2';
        } else if (theme === 'warning' || theme === 'danger') {
            if (iconWrap) iconWrap.className = 'w-16 h-16 rounded-3xl bg-red-50 border-2 border-red-200 flex items-center justify-center shadow-inner transition-transform duration-300';
            if (btnOk) btnOk.className = 'w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 active:scale-[0.98] text-white py-3.5 px-4 rounded-2xl font-black text-sm shadow-md shadow-red-500/25 transition cursor-pointer flex items-center justify-center gap-2';
        } else {
            if (iconWrap) iconWrap.className = 'w-16 h-16 rounded-3xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center shadow-inner transition-transform duration-300';
            if (btnOk) btnOk.className = 'w-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-300 active:scale-[0.98] text-gray-950 py-3.5 px-4 rounded-2xl font-black text-sm shadow-md shadow-amber-500/25 transition cursor-pointer flex items-center justify-center gap-2';
        }

        sheet.classList.remove('hidden');
        sheet.classList.add('flex');

        requestAnimationFrame(() => {
            if (card) {
                card.classList.remove('translate-y-full', 'sm:translate-y-4', 'opacity-0');
                card.classList.add('translate-y-0', 'opacity-100');
            }
            if (iconWrap) {
                iconWrap.classList.remove('scale-90');
                iconWrap.classList.add('scale-100');
            }
        });

        function cleanup() {
            if (card) {
                card.classList.add('translate-y-full', 'opacity-0');
                card.classList.remove('translate-y-0', 'opacity-100');
            }
            setTimeout(() => {
                sheet.classList.add('hidden');
                sheet.classList.remove('flex');
                sheet.removeEventListener('click', onBackdropClick);
                document.removeEventListener('keydown', onKeyDown);
                resolve();
            }, 250);
        }

        btnOk.onclick = () => cleanup();

        function onBackdropClick(e) {
            if (e.target === sheet) cleanup();
        }
        sheet.addEventListener('click', onBackdropClick);

        function onKeyDown(e) {
            if (e.key === 'Escape' || e.key === 'Enter') cleanup();
        }
        document.addEventListener('keydown', onKeyDown);
    });
}
window.showBusYatraAlert = showBusYatraAlert;
window.showAlertModal = showBusYatraAlert;

// Global override for native window.alert to completely eliminate domain alert popups
window.alert = function(msg) {
    return showBusYatraAlert(msg);
};

// --- Universal App Sharing & 1-Click Viral Distribution System ---
function shareCustomerAppWhatsApp() {
    const text = encodeURIComponent('🚌 Bus Yatra মোবাইল অ্যাপ ইনস্টল করুন!\n\nপিংলা ও কলকাতার মধ্যে সহজেই বাসের সিট বুক করুন, লাইভ জিপিএস লোকেশন দেখুন এবং অনলাইন টিকিট কাটুন।\n👉 ইনস্টল ও বুকিং লিঙ্ক: https://busyatra.pages.dev/?install=1');
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}
window.shareCustomerAppWhatsApp = shareCustomerAppWhatsApp;

function copyCustomerAppLink() {
    const url = 'https://busyatra.pages.dev/?install=1';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            showBusYatraAlert('✅ Bus Yatra কাস্টমার অ্যাপের লিঙ্ক কপি করা হয়েছে:\n\n' + url, { title: 'লিংক কপি সম্পন্ন', theme: 'success' });
        }).catch(() => {
            prompt('Copy App Link:', url);
        });
    } else {
        prompt('Copy App Link:', url);
    }
}
window.copyCustomerAppLink = copyCustomerAppLink;

async function shareCustomerAppNative() {
    const shareData = {
        title: 'Bus Yatra - অনলাইন বাস টিকিট বুকিং অ্যাপ',
        text: '🚌 Bus Yatra মোবাইল অ্যাপ ইনস্টল করুন! পিংলা ও কলকাতার মধ্যে সহজে সিট বুক করুন এবং লাইভ জিপিএস লোকেশন দেখুন।',
        url: 'https://busyatra.pages.dev/?install=1'
    };
    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (_) {}
    } else {
        shareCustomerAppWhatsApp();
    }
}
window.shareCustomerAppNative = shareCustomerAppNative;

function shareOwnerAppWhatsApp() {
    const text = encodeURIComponent('👑 Bus Yatra - Bus Owner মোবাইল অ্যাপ!\n\nআপনার বাসের সমস্ত রুট, টিকিট অনুমোদন, লাভ-খরচের দৈনিক খতিয়ান ও ফ্লিট নিয়ন্ত্রণ করুন এক ক্লিকে।\n👉 ইনস্টল ও ওনার পোর্টাল লিঙ্ক: https://busyatra.pages.dev/owner?install=1');
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}
window.shareOwnerAppWhatsApp = shareOwnerAppWhatsApp;

function copyOwnerAppLink() {
    const url = 'https://busyatra.pages.dev/owner?install=1';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            showBusYatraAlert('✅ Bus Owner অ্যাপের লিঙ্ক কপি করা হয়েছে:\n\n' + url, { title: 'লিংক কপি সম্পন্ন', theme: 'success' });
        }).catch(() => {
            prompt('Copy App Link:', url);
        });
    } else {
        prompt('Copy App Link:', url);
    }
}
window.copyOwnerAppLink = copyOwnerAppLink;

function shareCaptainAppWhatsApp() {
    const text = encodeURIComponent('👨‍✈️ Bus Yatra - Bus Captain মোবাইল অ্যাপ!\n\nবাসের টিকিট কিউআর স্ক্যান, বোর্ডিং কনফার্মেশন ও লাইভ জিপিএস ব্রডকাস্ট করুন সরাসরি মোবাইল থেকে।\n👉 ইনস্টল ও ক্যাপ্টেন পোর্টাল লিঙ্ক: https://busyatra.pages.dev/captain?install=1');
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}
window.shareCaptainAppWhatsApp = shareCaptainAppWhatsApp;

function copyCaptainAppLink() {
    const url = 'https://busyatra.pages.dev/captain?install=1';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            showBusYatraAlert('✅ Bus Captain অ্যাপের লিঙ্ক কপি করা হয়েছে:\n\n' + url, { title: 'লিংক কপি সম্পন্ন', theme: 'success' });
        }).catch(() => {
            prompt('Copy App Link:', url);
        });
    } else {
        prompt('Copy App Link:', url);
    }
}
window.copyCaptainAppLink = copyCaptainAppLink;








