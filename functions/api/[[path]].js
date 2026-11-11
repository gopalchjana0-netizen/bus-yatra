import { drainFirebaseReplica, enqueueFirebaseBackfillBatch, writeFirestoreDocument } from '../firebase-replica.js';

const ALLOWED_CORS_ORIGINS = new Set([
    'https://busyatra.pages.dev',
    'https://bus-yatra-a8f8a.web.app',
    'https://bus-yatra-a8f8a.firebaseapp.com'
]);

function resolveAllowedCorsOrigin(request) {
    const origin = request?.headers?.get('Origin') || '';
    if (!origin) return 'https://busyatra.pages.dev';
    if (ALLOWED_CORS_ORIGINS.has(origin)) return origin;
    if (/^https:\/\/[a-z0-9-]+\.busyatra\.pages\.dev$/i.test(origin)) return origin;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
    return 'https://busyatra.pages.dev';
}

function applyCorsHeaders(response, request) {
    if (!response) return response;
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', resolveAllowedCorsOrigin(request));
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-device-telemetry, x-customer-phone, x-ticket-token');
    headers.set('Vary', 'Origin');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

function jsonResponse(data, status = 200, customHeaders = {}) {
    return Response.json(data, {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Access-Control-Allow-Origin': 'https://busyatra.pages.dev',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-telemetry, x-customer-phone, x-ticket-token',
            ...customHeaders
        }
    });
}

function jsonError(status, message) {
    return jsonResponse({ error: message }, status);
}

async function readJson(request) {
    try {
        return await request.json();
    } catch {
        try {
            const text = await request.text();
            return text ? JSON.parse(text) : null;
        } catch {
            return null;
        }
    }
}

function parseJson(value, fallback) {
    try {
        return typeof value === 'string' ? JSON.parse(value) : (value || fallback);
    } catch {
        return fallback;
    }
}

let _sosColsEnsured = false;
async function ensureSosTable(db) {
    if (!db) return;
    try {
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS emergency_sos_alerts (
                id TEXT PRIMARY KEY,
                alert_number TEXT UNIQUE,
                customer_phone TEXT,
                customer_name TEXT,
                emergency_type TEXT,
                description TEXT,
                latitude REAL,
                longitude REAL,
                maps_url TEXT,
                current_location_text TEXT,
                bus_id TEXT,
                bus_name TEXT,
                status TEXT DEFAULT 'Active',
                resolved_at TEXT,
                resolved_by TEXT,
                resolution_notes TEXT,
                camera_consent INTEGER NOT NULL DEFAULT 0,
                camera_active INTEGER NOT NULL DEFAULT 0,
                camera_frame TEXT DEFAULT '',
                camera_updated_at TEXT,
                camera_expires_at TEXT,
                camera_session_token TEXT DEFAULT '',
                webrtc_offer TEXT DEFAULT '',
                webrtc_offer_ice TEXT DEFAULT '[]',
                webrtc_answer TEXT DEFAULT '',
                webrtc_answer_ice TEXT DEFAULT '[]',
                webrtc_session_nonce TEXT DEFAULT '',
                webrtc_renegotiate INTEGER NOT NULL DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )
        `).run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON emergency_sos_alerts(status)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_sos_alerts_created ON emergency_sos_alerts(created_at)').run();
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS sos_captured_photos (
                id TEXT PRIMARY KEY,
                sos_id TEXT NOT NULL,
                captured_by TEXT NOT NULL DEFAULT 'customer',
                photo_data TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        `).run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_sos_photos_sos ON sos_captured_photos(sos_id, created_at DESC)').run();
        if (!_sosColsEnsured) {
            const info = await db.prepare('PRAGMA table_info(emergency_sos_alerts)').all();
            const cols = new Set((info.results || []).map(c => String(c.name || '').toLowerCase()));
            const needed = [
                ['camera_consent', 'INTEGER NOT NULL DEFAULT 0'],
                ['camera_active', 'INTEGER NOT NULL DEFAULT 0'],
                ['camera_frame', "TEXT DEFAULT ''"],
                ['camera_updated_at', 'TEXT'],
                ['camera_expires_at', 'TEXT'],
                ['camera_session_token', "TEXT DEFAULT ''"],
                ['webrtc_offer', "TEXT DEFAULT ''"],
                ['webrtc_offer_ice', "TEXT DEFAULT '[]'"],
                ['webrtc_answer', "TEXT DEFAULT ''"],
                ['webrtc_answer_ice', "TEXT DEFAULT '[]'"],
                ['webrtc_session_nonce', "TEXT DEFAULT ''"],
                ['webrtc_renegotiate', 'INTEGER NOT NULL DEFAULT 0']
            ];
            for (const [colName, colDef] of needed) {
                if (!cols.has(colName)) {
                    try { await db.prepare(`ALTER TABLE emergency_sos_alerts ADD COLUMN ${colName} ${colDef}`).run(); } catch (_) {}
                }
            }
            _sosColsEnsured = true;
        }
    } catch (e) {
        console.warn('ensureSosTable notice:', e);
    }
}

function sanitizeSosCameraFrame(rawFrame, maxLen = 240000) {
    const clean = String(rawFrame || '').trim();
    if (!clean) return { ok: false, error: 'Camera frame missing.' };
    if (!/^data:image\/(jpeg|jpg|webp|png);base64,[A-Za-z0-9+/=]+$/i.test(clean)) {
        return { ok: false, error: 'Only safe JPEG/WebP/PNG camera frames are permitted.' };
    }
    if (clean.length > maxLen) {
        return { ok: false, error: 'Camera image payload too large.' };
    }
    return { ok: true, value: clean };
}

let _clientAnalyticsTableEnsured = false;
/** Lazily creates the client visitor & PWA install analytics table once per isolate. */
async function ensureClientAnalyticsTable(db) {
    if (!db || _clientAnalyticsTableEnsured) return;
    try {
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS client_device_analytics (
                client_id TEXT PRIMARY KEY,
                device_uid TEXT NOT NULL,
                portal TEXT NOT NULL DEFAULT 'customer',
                device_type TEXT DEFAULT 'Mobile',
                device_brand TEXT DEFAULT 'Unknown',
                device_model TEXT DEFAULT '',
                os TEXT DEFAULT 'Unknown OS',
                browser TEXT DEFAULT 'Browser',
                screen TEXT DEFAULT '',
                ip_address TEXT DEFAULT '',
                city TEXT DEFAULT '',
                region TEXT DEFAULT '',
                country TEXT DEFAULT 'IN',
                install_status TEXT DEFAULT 'web_only',
                visit_count INTEGER DEFAULT 1,
                standalone_open_count INTEGER DEFAULT 0,
                user_identifier TEXT DEFAULT '',
                user_role TEXT DEFAULT '',
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                installed_at TEXT,
                last_standalone_at TEXT,
                uninstalled_at TEXT,
                last_event TEXT DEFAULT 'visit',
                updated_at TEXT NOT NULL
            )
        `).run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cda_status ON client_device_analytics(install_status)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cda_last_seen ON client_device_analytics(last_seen_at)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cda_portal ON client_device_analytics(portal)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cda_device_uid ON client_device_analytics(device_uid)').run();
        _clientAnalyticsTableEnsured = true;
    } catch (e) {
        console.warn('ensureClientAnalyticsTable notice:', e);
    }
}

/** Shared delete helper for client traffic/install analytics (all, by status, or single record). */
async function deleteClientAnalyticsRecords(db, url) {
    await ensureClientAnalyticsTable(db);
    const recId = url.searchParams.get('id');
    const clearAll = url.searchParams.get('all') === 'true';
    const statusFilter = url.searchParams.get('status');

    if (clearAll) {
        await db.prepare('DELETE FROM client_device_analytics').run();
        return jsonResponse({ ok: true, message: 'সমস্ত ওয়েবসাইট ভিজিট ও অ্যাপ ইনস্টল ডেটা মুছে ফেলা হয়েছে (All traffic & install analytics cleared).' });
    }
    if (statusFilter && ['web_only', 'installed', 'uninstalled'].includes(statusFilter)) {
        await db.prepare('DELETE FROM client_device_analytics WHERE install_status = ?').bind(statusFilter).run();
        return jsonResponse({ ok: true, message: `নির্বাচিত (${statusFilter}) রেকর্ডগুলো মুছে ফেলা হয়েছে।` });
    }
    if (recId) {
        await db.prepare('DELETE FROM client_device_analytics WHERE client_id = ?').bind(recId).run();
        return jsonResponse({ ok: true, message: 'ভিজিট/ইনস্টল ডিভাইস রেকর্ড মুছে ফেলা হয়েছে (Record deleted).' });
    }
    return jsonError(400, 'Analytics record ID, status, or all=true is required.');
}

let _enterpriseSegmentTablesEnsured = false;
/** Lazily ensures additive columns & hop-level segment tables once per Worker isolate. */
async function ensureEnterpriseSegmentTables(db) {
    if (!db || _enterpriseSegmentTablesEnsured) return;
    try {
        const info = await db.prepare('PRAGMA table_info(buses)').all();
        const cols = new Set((info.results || []).map(c => String(c.name || '').toLowerCase()));
        const additions = [
            { name: 'stoppage_fares', sql: "ALTER TABLE buses ADD COLUMN stoppage_fares TEXT NOT NULL DEFAULT '{}'" },
            { name: 'return_stoppage_fares', sql: "ALTER TABLE buses ADD COLUMN return_stoppage_fares TEXT NOT NULL DEFAULT '{}'" },
            { name: 'current_stoppage', sql: "ALTER TABLE buses ADD COLUMN current_stoppage TEXT NOT NULL DEFAULT ''" },
            { name: 'current_stoppage_updated_at', sql: "ALTER TABLE buses ADD COLUMN current_stoppage_updated_at TEXT NOT NULL DEFAULT ''" }
        ];
        for (const col of additions) {
            if (!cols.has(col.name)) {
                try { await db.prepare(col.sql).run(); } catch (_) {}
            }
        }
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS booking_seat_legs (
                bus_id TEXT NOT NULL,
                journey_date TEXT NOT NULL,
                seat_number TEXT NOT NULL,
                hop_idx INTEGER NOT NULL,
                booking_id TEXT NOT NULL,
                boarding_idx INTEGER NOT NULL DEFAULT 0,
                dropping_idx INTEGER NOT NULL DEFAULT 999,
                boarding TEXT NOT NULL DEFAULT '',
                dropping TEXT NOT NULL DEFAULT '',
                PRIMARY KEY (bus_id, journey_date, seat_number, hop_idx)
            )
        `).run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_bsl_booking ON booking_seat_legs (booking_id)').run();
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS seat_hold_legs (
                bus_id TEXT NOT NULL,
                journey_date TEXT NOT NULL,
                seat_number TEXT NOT NULL,
                hop_idx INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                customer_phone TEXT,
                boarding_idx INTEGER NOT NULL DEFAULT 0,
                dropping_idx INTEGER NOT NULL DEFAULT 999,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                trip_direction TEXT DEFAULT 'UP',
                PRIMARY KEY (bus_id, journey_date, seat_number, hop_idx)
            )
        `).run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_shl_expiry ON seat_hold_legs (expires_at)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_shl_session ON seat_hold_legs (bus_id, journey_date, session_id)').run();
        await ensureCustomerPhotoColumns(db);
        _enterpriseSegmentTablesEnsured = true;
    } catch (e) {
        console.warn('ensureEnterpriseSegmentTables notice:', e);
    }
}

let _customerPhotoColsEnsured = false;
async function ensureCustomerPhotoColumns(db) {
    if (!db || _customerPhotoColsEnsured) return;
    try {
        const info = await db.prepare('PRAGMA table_info(customers)').all();
        const cols = new Set((info.results || []).map(c => String(c.name || '').toLowerCase()));
        if (!cols.has('profile_photo')) {
            try { await db.prepare("ALTER TABLE customers ADD COLUMN profile_photo TEXT NOT NULL DEFAULT ''").run(); } catch (_) {}
        }
        if (!cols.has('avatar_preference')) {
            try { await db.prepare("ALTER TABLE customers ADD COLUMN avatar_preference TEXT NOT NULL DEFAULT 'auto'").run(); } catch (_) {}
        }
        _customerPhotoColsEnsured = true;
    } catch (e) {
        console.warn('ensureCustomerPhotoColumns notice:', e);
    }
}

function sanitizeProfilePhotoInput(raw) {
    if (raw === undefined || raw === null) return { ok: true, value: '' };
    const clean = String(raw).trim();
    if (!clean) return { ok: true, value: '' };
    if (clean.length > 350000) {
        return { ok: false, error: 'ছবি অনেক বড়! অনুগ্রহ করে ছোট সাইজের ছবি (৩৫০ KB-র কম) আপলোড করুন।' };
    }
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(clean)) {
        return { ok: false, error: 'শুধুমাত্র বৈধ JPEG, PNG বা WebP ছবি অনুমোদিত।' };
    }
    return { ok: true, value: clean };
}

function sanitizeStoppageFaresInput(raw) {
    const parsed = typeof raw === 'string' ? parseJson(raw, {}) : (raw || {});
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '{}';
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
        const key = String(k || '').trim();
        const num = Number(v);
        if (key && key.includes('->') && Number.isFinite(num) && num > 0 && num <= 50000) {
            out[key] = Math.round(num);
        }
    }
    return JSON.stringify(out);
}

function getEffectiveStoppagesList(busRow, isReturnTrip = false) {
    if (!busRow) return ['Pingla', 'Kolkata'];
    const up = Array.isArray(busRow.stoppages) ? busRow.stoppages : parseJson(busRow.stoppages, ['Pingla', 'Kolkata']);
    if (!isReturnTrip) return up.length >= 2 ? up : ['Pingla', 'Kolkata'];
    const ret = Array.isArray(busRow.returnStoppages)
        ? busRow.returnStoppages
        : parseJson(busRow.return_stoppages, []);
    if (Array.isArray(ret) && ret.length >= 2) return ret;
    return up.length >= 2 ? [...up].reverse() : ['Kolkata', 'Pingla'];
}

function getEffectiveStoppageTimingsObj(busRow, isReturnTrip = false) {
    if (!busRow) return {};
    const up = (busRow.stoppageTimings && typeof busRow.stoppageTimings === 'object')
        ? busRow.stoppageTimings
        : parseJson(busRow.stoppage_timings, {});
    if (!isReturnTrip) return up || {};
    const ret = (busRow.returnStoppageTimings && typeof busRow.returnStoppageTimings === 'object')
        ? busRow.returnStoppageTimings
        : parseJson(busRow.return_stoppage_timings, {});
    return (ret && Object.keys(ret).length > 0) ? ret : (up || {});
}

function resolveStoppageIdx(stops, stopName) {
    if (!Array.isArray(stops) || !stopName) return -1;
    const target = String(stopName).trim().toLowerCase();
    return stops.findIndex(s => String(s || '').trim().toLowerCase() === target);
}

function resolveStoppageTimingValue(timings, stopName) {
    if (!timings || typeof timings !== 'object' || !stopName) return null;
    if (timings[stopName]) return timings[stopName];
    const target = String(stopName).trim().toLowerCase();
    for (const [k, v] of Object.entries(timings)) {
        if (String(k || '').trim().toLowerCase() === target && v) return v;
    }
    return null;
}

function resolveSegmentFare(busRow, boarding, dropping, isReturnTrip = false, flags = null) {
    const fullFare = Number(isReturnTrip ? (busRow?.return_fare || busRow?.returnFare || busRow?.fare) : busRow?.fare) || 150;
    if (flags && flags.stoppageWiseFares === false) return Math.round(fullFare);

    const stops = getEffectiveStoppagesList(busRow, isReturnTrip);
    const fromIdx = resolveStoppageIdx(stops, boarding);
    const toIdx = resolveStoppageIdx(stops, dropping);
    if (fromIdx < 0 || toIdx <= fromIdx) return Math.round(fullFare);

    const fromStop = stops[fromIdx];
    const toStop = stops[toIdx];
    const rawMap = isReturnTrip
        ? (busRow?.returnStoppageFares || parseJson(busRow?.return_stoppage_fares, {}))
        : (busRow?.stoppageFares || parseJson(busRow?.stoppage_fares, {}));

    if (rawMap && typeof rawMap === 'object') {
        const directKey = `${fromStop}->${toStop}`;
        if (Number(rawMap[directKey]) > 0) return Math.round(Number(rawMap[directKey]));
        const lcTarget = directKey.toLowerCase();
        for (const [k, v] of Object.entries(rawMap)) {
            if (String(k || '').trim().toLowerCase() === lcTarget && Number(v) > 0) {
                return Math.round(Number(v));
            }
        }
    }

    if (fromIdx === 0 && toIdx === stops.length - 1) return Math.round(fullFare);

    const totalHops = Math.max(1, stops.length - 1);
    const hops = toIdx - fromIdx;
    const propFare = Math.round((fullFare * (hops / totalHops)) / 5) * 5;
    return Math.max(20, Math.min(Math.round(fullFare), propFare));
}

function addMinutesToTimeStr(timeStr, addMins) {
    if (!timeStr) return null;
    const m = String(timeStr).trim().match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const mer = (m[3] || '').toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    const total = (h * 60 + min + addMins) % (24 * 60);
    const nh24 = Math.floor(total / 60);
    const nmin = total % 60;
    const nmer = nh24 >= 12 ? 'PM' : 'AM';
    const nh12 = (nh24 % 12) || 12;
    return `${String(nh12).padStart(2, '0')}:${String(nmin).padStart(2, '0')} ${nmer}`;
}

function parseTripDateTimeIST(journeyDate, timeStr) {
    if (!journeyDate || !/^\d{4}-\d{2}-\d{2}$/.test(journeyDate)) return null;
    const clean = String(timeStr || '07:00 AM').trim();
    const match = clean.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const meridiem = (match[3] || '').toUpperCase();
    if (meridiem === 'PM' && h < 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    const dt = new Date(`${journeyDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:30`);
    if (Number.isNaN(dt.getTime())) return null;
    const diffMs = dt.getTime() - Date.now();
    return {
        departureMs: dt.getTime(),
        hoursUntil: diffMs / 3600000,
        isPassed: diffMs <= 0
    };
}

function evaluateEnrouteStopState(busRow, journeyDate, boardingStop, isReturnTrip = false, flags = null) {
    if (!journeyDate) return { allowed: true, isRunningEnroute: false, status: 'UPCOMING', boardingTime: null };
    const istNow = new Date();
    const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(istNow);
    const stops = getEffectiveStoppagesList(busRow, isReturnTrip);
    const timings = getEffectiveStoppageTimingsObj(busRow, isReturnTrip);
    const baseTime = (isReturnTrip ? (busRow?.return_time || busRow?.returnTime || busRow?.time) : busRow?.time) || '07:00 AM';
    const boardingIdx = Math.max(0, resolveStoppageIdx(stops, boardingStop));

    let boardingTime = resolveStoppageTimingValue(timings, boardingStop);
    if (!boardingTime) {
        boardingTime = boardingIdx === 0 ? baseTime : (addMinutesToTimeStr(baseTime, boardingIdx * 30) || baseTime);
    }

    if (journeyDate > istDate) {
        return { allowed: true, isRunningEnroute: false, status: 'UPCOMING', boardingTime };
    }
    if (journeyDate < istDate) {
        return { allowed: false, isRunningEnroute: false, status: 'DEPARTED', boardingTime };
    }

    // Same IST calendar day: check live Captain checkpoint + GPS telemetry first if enabled
    const enrouteEnabled = !flags || flags.enrouteRunningBooking !== false;
    const locUpdatedAt = busRow?.location_updated_at || busRow?.locationUpdatedAt || '';
    const curStop = String(busRow?.current_stoppage || busRow?.currentStoppage || '').trim();
    const curStopAt = busRow?.current_stoppage_updated_at || busRow?.currentStoppageUpdatedAt || locUpdatedAt;
    const isFreshTodayLoc = Boolean(curStopAt) &&
        (new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(curStopAt)) === istDate) &&
        (Date.now() - new Date(curStopAt).getTime() <= 2 * 3600 * 1000);

    if (enrouteEnabled && curStop && isFreshTodayLoc) {
        const curStopIdx = resolveStoppageIdx(stops, curStop);
        if (curStopIdx > boardingIdx) {
            return { allowed: false, isRunningEnroute: false, status: 'PASSED_STOP', boardingTime, currentStoppage: curStop };
        }
        if (curStopIdx >= 0 && curStopIdx < boardingIdx) {
            const parsedStopTime = parseTripDateTimeIST(journeyDate, boardingTime);
            // Allow live running booking even if bus is up to 90 mins behind schedule
            if (!parsedStopTime || parsedStopTime.hoursUntil >= -1.5) {
                return { allowed: true, isRunningEnroute: true, isLiveGps: true, status: 'RUNNING_APPROACHING', boardingTime, currentStoppage: curStop };
            }
        }
    }

    const stopPassed = isTripTimePassedIST(journeyDate, boardingTime);
    if (stopPassed) {
        return { allowed: false, isRunningEnroute: false, status: 'DEPARTED', boardingTime };
    }

    const originPassed = boardingIdx > 0 && isTripTimePassedIST(journeyDate, baseTime);
    if (originPassed && !enrouteEnabled) {
        return { allowed: false, isRunningEnroute: false, status: 'ORIGIN_DEPARTED', boardingTime };
    }

    return {
        allowed: true,
        isRunningEnroute: Boolean(originPassed),
        status: originPassed ? 'RUNNING_APPROACHING' : 'UPCOMING',
        boardingTime
    };
}

async function getSegmentOccupiedSeats(db, busId, journeyDate, fromIdx, toIdx, flags = null) {
    const reuseEnabled = !flags || flags.segmentSeatReuse !== false;
    const effectiveFrom = (reuseEnabled && fromIdx >= 0 && toIdx > fromIdx) ? fromIdx : 0;
    const effectiveTo = (reuseEnabled && fromIdx >= 0 && toIdx > fromIdx) ? toIdx : 999;

    const [{ results: legRows }, { results: legacyRows }] = await Promise.all([
        db.prepare(
            `SELECT DISTINCT seat_number FROM booking_seat_legs
             WHERE bus_id = ? AND journey_date = ? AND hop_idx >= ? AND hop_idx < ?`
        ).bind(busId, journeyDate, effectiveFrom, effectiveTo).all(),
        db.prepare(
            `SELECT DISTINCT seat_number FROM booking_seats
             WHERE bus_id = ? AND journey_date = ?
               AND booking_id NOT IN (SELECT DISTINCT booking_id FROM booking_seat_legs WHERE bus_id = ? AND journey_date = ?)`
        ).bind(busId, journeyDate, busId, journeyDate).all()
    ]);

    const seatSet = new Set();
    (legRows || []).forEach(r => seatSet.add(r.seat_number));
    (legacyRows || []).forEach(r => seatSet.add(r.seat_number));
    return Array.from(seatSet);
}

async function getSegmentHeldSeats(db, busId, journeyDate, fromIdx, toIdx, sessionId, nowIso, flags = null) {
    const reuseEnabled = !flags || flags.segmentSeatReuse !== false;
    const effectiveFrom = (reuseEnabled && fromIdx >= 0 && toIdx > fromIdx) ? fromIdx : 0;
    const effectiveTo = (reuseEnabled && fromIdx >= 0 && toIdx > fromIdx) ? toIdx : 999;

    const [{ results: legHolds }, { results: legacyHolds }] = await Promise.all([
        db.prepare(
            `SELECT DISTINCT seat_number, session_id FROM seat_hold_legs
             WHERE bus_id = ? AND journey_date = ? AND expires_at > ? AND hop_idx >= ? AND hop_idx < ?`
        ).bind(busId, journeyDate, nowIso, effectiveFrom, effectiveTo).all(),
        db.prepare(
            `SELECT DISTINCT seat_number, session_id FROM seat_holds
             WHERE bus_id = ? AND journey_date = ? AND expires_at > ?
               AND session_id NOT IN (SELECT DISTINCT session_id FROM seat_hold_legs WHERE bus_id = ? AND journey_date = ?)`
        ).bind(busId, journeyDate, nowIso, busId, journeyDate).all()
    ]);

    const heldSeats = new Set();
    const myHeldSeats = new Set();
    const applyRow = (h) => {
        if (sessionId && h.session_id === sessionId) myHeldSeats.add(h.seat_number);
        else heldSeats.add(h.seat_number);
    };
    (legHolds || []).forEach(applyRow);
    (legacyHolds || []).forEach(applyRow);
    return { heldSeats: Array.from(heldSeats), myHeldSeats: Array.from(myHeldSeats) };
}

function escapeHtml(str) {
    if (typeof str !== 'string') return (str === null || str === undefined) ? '' : String(str);
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

let _promoExtColsEnsured = false;
async function ensurePromotionExtensionColumns(db) {
    if (!db || _promoExtColsEnsured) return;
    try {
        const info = await db.prepare('PRAGMA table_info(promotions)').all();
        const cols = new Set((info.results || []).map(c => String(c.name || '').toLowerCase()));
        if (!cols.has('media_type')) {
            try { await db.prepare("ALTER TABLE promotions ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image'").run(); } catch (_) {}
        }
        if (!cols.has('placement')) {
            try { await db.prepare("ALTER TABLE promotions ADD COLUMN placement TEXT NOT NULL DEFAULT 'popup'").run(); } catch (_) {}
        }
        _promoExtColsEnsured = true;
    } catch (e) {
        console.warn('ensurePromotionExtensionColumns notice:', e);
    }
}

function detectPromoMediaType(mediaUrl, declaredType) {
    const decl = String(declaredType || '').trim().toLowerCase();
    const u = String(mediaUrl || '').trim();
    if (/^data:video\//i.test(u) || /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(u) || /(?:youtube\.com\/|youtu\.be\/)/i.test(u)) {
        return 'video';
    }
    if (decl === 'video' || decl === 'image') return decl;
    return 'image';
}

function sanitizePromoMediaInput(rawUrl, declaredType) {
    const clean = String(rawUrl || '').trim();
    if (!clean) return { ok: false, error: 'বিজ্ঞাপনের ছবি বা ভিডিও আবশ্যক (Media required).' };
    if (/^(javascript|vbscript|data:text\/html|data:image\/svg)/i.test(clean)) {
        return { ok: false, error: 'অনুমোদিত ছবি বা ভিডিও ফরম্যাট দিন।' };
    }
    const mediaType = detectPromoMediaType(clean, declaredType);
    if (/^data:video\//i.test(clean)) {
        if (!/^data:video\/(mp4|webm|ogg|quicktime);base64,[A-Za-z0-9+/=]+$/i.test(clean)) {
            return { ok: false, error: 'শুধুমাত্র বৈধ MP4, WebM বা OGG ভিডিও অনুমোদিত।' };
        }
        if (clean.length > 960000) {
            return { ok: false, error: 'ভিডিও ফাইল অনেক বড়! অনুগ্রহ করে ৭০০ KB-র কম ভিডিও আপলোড করুন অথবা সরাসরি MP4/YouTube লিঙ্ক ব্যবহার করুন।' };
        }
        return { ok: true, value: clean, mediaType: 'video' };
    }
    if (/^data:image\//i.test(clean)) {
        if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(clean)) {
            return { ok: false, error: 'শুধুমাত্র বৈধ JPEG, PNG, WebP বা GIF ছবি অনুমোদিত।' };
        }
        if (clean.length > 550000) {
            return { ok: false, error: 'ছবির ফাইল অনেক বড়! অনুগ্রহ করে ৫০০ KB-র কম ছবি আপলোড করুন।' };
        }
        return { ok: true, value: clean, mediaType: 'image' };
    }
    if (!/^https?:\/\//i.test(clean)) {
        return { ok: false, error: 'সঠিক http/https লিঙ্ক বা ছবি/ভিডিও ফাইল দিন।' };
    }
    return { ok: true, value: clean, mediaType };
}

function sanitizePromoLinkInput(rawLink) {
    const clean = String(rawLink || '').trim();
    if (!clean) return { ok: true, value: '' };
    if (/^(javascript|vbscript|data):/i.test(clean)) {
        return { ok: false, error: 'নিরাপদ ওয়েবসাইট লিঙ্ক দিন (http/https)।' };
    }
    return { ok: true, value: /^https?:\/\//i.test(clean) ? clean : `https://${clean}` };
}

const defaultFeatureFlags = {
    onlinePayment: true,
    cashPayment: true,
    captainPortal: true,
    windowSeatPricing: false,
    promoCodes: true,
    liveTracking: true,
    customerFeedback: true,
    tripReminders: true,
    // Live GPS tracking window controls
    trackingLeadHours: 5,
    trackingLeadWindowEnabled: true,
    // Temporary Seat Hold Timer controls
    seatHoldTimer: true,
    seatHoldMinutes: 15,
    // Enterprise Ticket Cancellation & Cutoff Controls
    ticketCancellation: true,
    cancellationCutoffEnabled: true,
    cancellationCutoffHours: 8,
    // Enterprise En-route & Segment Controls
    enrouteRunningBooking: true,
    stoppageWiseFares: true,
    segmentSeatReuse: true,
    searchBannerAds: true,
    // Strategic Growth & Business Expansion Flags
    whatsappBooking: false,
    agentBookingPortal: false,
    monthlyPass: false,
    arrivalAlerts: false,
    parcelCourier: false,
    fuelTyrePartnership: false,
    surgePricing: false,
    festivalTheme: false
};

const defaultExpansionConfig = {
    liveTracking: {
        leadWindowEnabled: true,
        leadHours: 5,
        graceMinutes: 30
    },
    seatHold: {
        enabled: true,
        holdMinutes: 15
    },
    ticketCancellation: {
        enabled: true,
        cutoffEnabled: true,
        cutoffHours: 8
    },
    whatsappBooking: {
        botNumber: "8768447312",
        welcomeMsg: "Hello Bus Yatra! I want to book a bus ticket."
    },
    agentBookingPortal: {
        commissionPerTicket: 15,
        counterStand: "Pingla Bus Stand",
        allowInstantCashBook: true
    },
    monthlyPass: {
        discountPercent: 15,
        ridesCount: 20,
        validityDays: 30
    },
    arrivalAlerts: {
        leadMinutes: 15,
        channel: "WhatsApp & SMS"
    },
    parcelCourier: {
        minFare: 50,
        ratePerKg: 10,
        requireOtp: true
    },
    fuelTyrePartnership: {
        partnerBrand: "Indian Oil / HPCL & MRF",
        discountSummary: "Up to ₹2.5/L diesel cashback & 10% off on bus tyres for registered owners."
    },
    surgePricing: {
        surgePercent: 15,
        activeOccasion: "Durga Puja & Festive Rush"
    },
    festivalTheme: {
        enabled: false,
        festival: 'diwali',
        targets: { customer: true, owner: true, captain: true },
        greeting: 'শুভ দীপাবলি ও শ্যামাপূজা! আনন্দময় ও নিরাপদ যাত্রার শুভেচ্ছা।'
    }
};

function isValidJourneyDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function getFeatureFlags(db) {
    const { results } = await db.prepare('SELECT feature_key, enabled, config FROM platform_features').all();
    const flags = { ...defaultFeatureFlags };
    const expansionConfig = { ...defaultExpansionConfig };

    (results || []).forEach(row => {
        flags[row.feature_key] = Boolean(row.enabled);
        if (row.config) {
            expansionConfig[row.feature_key] = parseJson(row.config, expansionConfig[row.feature_key] || {});
        }
    });

    flags.expansionConfig = expansionConfig;
    if (expansionConfig.liveTracking) {
        flags.trackingLeadHours = typeof expansionConfig.liveTracking.leadHours === 'number' ? expansionConfig.liveTracking.leadHours : 5;
        flags.trackingLeadWindowEnabled = expansionConfig.liveTracking.leadWindowEnabled !== false;
        flags.trackingGraceMinutes = typeof expansionConfig.liveTracking.graceMinutes === 'number' ? expansionConfig.liveTracking.graceMinutes : 30;
    }
    if (expansionConfig.seatHold) {
        flags.seatHoldMinutes = typeof expansionConfig.seatHold.holdMinutes === 'number' ? expansionConfig.seatHold.holdMinutes : 15;
        flags.seatHoldTimer = expansionConfig.seatHold.enabled !== false;
    }
    if (expansionConfig.ticketCancellation) {
        flags.ticketCancellation = expansionConfig.ticketCancellation.enabled !== false;
        flags.cancellationCutoffEnabled = expansionConfig.ticketCancellation.cutoffEnabled !== false;
        flags.cancellationCutoffHours = typeof expansionConfig.ticketCancellation.cutoffHours === 'number'
            ? expansionConfig.ticketCancellation.cutoffHours
            : 8;
    }
    return flags;
}

function mapBus(row) {
    if (!row) return null;
    let imagesList = [];
    if (row.image && typeof row.image === 'string') {
        const trimmed = row.image.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    imagesList = parsed.filter(Boolean);
                }
            } catch {
                imagesList = [trimmed];
            }
        } else if (trimmed.includes(',')) {
            imagesList = trimmed.split(',').map(s => s.trim()).filter(Boolean);
        } else if (trimmed.length > 0) {
            imagesList = [trimmed];
        }
    }
    if (!imagesList || imagesList.length === 0) {
        imagesList = ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60'];
    }
    return {
        id: row.id,
        name: row.name,
        busNumber: row.bus_number,
        ownerName: row.owner_name,
        ownerPhone: row.owner_phone,
        ownerEmail: row.owner_email || '',
        route: row.route,
        activeRoutes: parseJson(row.active_routes, [row.route]),
        stoppages: parseJson(row.stoppages, ['Pingla', 'Kolkata']),
        farePerStop: row.fare_per_stop || 45,
        farePerKm: row.fare_per_km || 3.5,
        windowSeatExtra: (row.window_seat_extra !== null && row.window_seat_extra !== undefined) ? row.window_seat_extra : 0,
        time: row.time,
        fare: row.fare,
        totalSeats: row.total_seats || 65,
        image: imagesList[0],
        images: imagesList,
        upiId: row.upi_id || 'busyatra@oksbi',
        qrImage: row.qr_image || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${encodeURIComponent(row.upi_id || 'busyatra@oksbi')}&pn=BusYatra`,
        allowOnlinePayment: row.allow_online_payment !== 0,
        allowCashPayment: row.allow_cash_payment !== 0,
        requirePaymentScreenshot: row.require_payment_screenshot !== 0,
        enableUtr: Boolean(row.enable_utr),
        driverPhone: row.driver_phone || row.owner_phone,
        companyName: row.company_name || (row.owner_name ? `${row.owner_name} Travels` : 'Bus Yatra Express'),
        gstNumber: row.gst_number || '',
        ticketTerms: row.ticket_terms || 'Please arrive at the boarding stoppage 15 minutes before scheduled departure. Valid ID proof mandatory. Ticket is non-transferable.',
        emergencyPhone: row.emergency_phone || row.driver_phone || row.owner_phone,
        lat: row.lat,
        lng: row.lng,
        locationUpdatedAt: row.location_updated_at || null,
        rating: Number(row.rating !== undefined && row.rating !== null ? row.rating : 4.8),
        bookingMode: row.booking_mode || 'active',
        stoppageTimings: parseJson(row.stoppage_timings, {}),
        stoppage_timings: parseJson(row.stoppage_timings, {}),
        stoppageFares: parseJson(row.stoppage_fares, {}),
        stoppage_fares: parseJson(row.stoppage_fares, {}),
        returnStoppageFares: parseJson(row.return_stoppage_fares, {}),
        return_stoppage_fares: parseJson(row.return_stoppage_fares, {}),
        currentStoppage: row.current_stoppage || '',
        currentStoppageUpdatedAt: row.current_stoppage_updated_at || '',
        seatLayout: parseJson(row.seat_layout, null),
        seat_layout: parseJson(row.seat_layout, null),
        approvalStatus: row.approval_status || 'approved',
        approval_status: row.approval_status || 'approved',
        rejectionReason: row.rejection_reason || '',
        rejection_reason: row.rejection_reason || '',
        returnRouteEnabled: Boolean(row.return_route_enabled),
        return_route_enabled: Boolean(row.return_route_enabled),
        returnTime: row.return_time || '',
        return_time: row.return_time || '',
        returnRoute: row.return_route || '',
        return_route: row.return_route || '',
        returnStoppages: parseJson(row.return_stoppages, []),
        return_stoppages: parseJson(row.return_stoppages, []),
        returnStoppageTimings: parseJson(row.return_stoppage_timings, {}),
        return_stoppage_timings: parseJson(row.return_stoppage_timings, {}),
        returnFare: Number(row.return_fare || row.fare || 0),
        return_fare: Number(row.return_fare || row.fare || 0),
        pendingImages: parseJson(row.pending_images, []),
        pending_images: parseJson(row.pending_images, []),
        photoApprovalStatus: row.photo_approval_status || 'approved',
        photo_approval_status: row.photo_approval_status || 'approved',
        photoRejectionReason: row.photo_rejection_reason || '',
        photo_rejection_reason: row.photo_rejection_reason || ''
    };
}

function mapBooking(row, busRow = null) {
    if (!row) return null;
    return {
        id: row.id,
        busId: row.bus_id,
        busName: row.bus_name,
        busNumber: row.bus_number,
        ownerName: row.owner_name,
        companyName: (busRow && busRow.company_name) || row.company_name || (row.owner_name ? `${row.owner_name} Travels` : 'Bus Yatra Express'),
        gstNumber: (busRow && busRow.gst_number) || row.gst_number || '',
        ticketTerms: (busRow && busRow.ticket_terms) || row.ticket_terms || 'Please arrive 15 minutes before scheduled departure. Ticket is non-transferable.',
        emergencyPhone: (busRow && busRow.emergency_phone) || row.emergency_phone || row.owner_phone || '',
        departureTime: (() => {
            if (busRow && busRow.stoppage_timings) {
                const timings = typeof busRow.stoppage_timings === 'string' ? parseJson(busRow.stoppage_timings, {}) : busRow.stoppage_timings;
                if (timings && row.boarding && timings[row.boarding]) {
                    return timings[row.boarding];
                }
            }
            return (busRow && busRow.time) || '';
        })(),
        passengerName: row.passenger_name,
        passengerPhone: row.passenger_phone,
        seats: parseJson(row.seats, []),
        boarding: row.boarding,
        dropping: row.dropping,
        date: row.journey_date,
        fare: row.fare,
        paymentMode: row.payment_mode,
        utrNumber: row.utr_number || 'N/A',
        upiTransactionId: row.utr_number || 'N/A',
        status: row.status,
        createdAt: row.created_at,
        boarded: Boolean(row.boarded),
        rejectionRemarks: row.rejection_remarks || '',
        tripDirection: row.trip_direction || 'UP',
        trip_direction: row.trip_direction || 'UP',
        cancelReason: row.cancel_reason || '',
        refundStatus: row.refund_status || 'none',
        refundAmount: Number(row.refund_amount) || 0,
        cancelledAt: row.cancelled_at || '',
        refundedAt: row.refunded_at || '',
        paymentScreenshot: row.payment_screenshot || ''
    };
}

function isTripTimePassedIST(journeyDate, timeStr) {
    if (!journeyDate) return false;
    const now = new Date();
    const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    if (journeyDate < istDate) return true;
    if (journeyDate > istDate) return false;

    if (!timeStr) return false;
    const clean = String(timeStr).trim();
    const match = clean.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i);
    if (!match) return false;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const meridiem = (match[3] || '').toUpperCase();
    if (meridiem === 'PM' && h < 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    const departureMins = h * 60 + m;

    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
    const curHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10) % 24;
    const curMin = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentMins = curHour * 60 + curMin;

    return currentMins >= departureMins;
}

function bytesToHex(bytes) {
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value) {
    const bytes = new Uint8Array(value.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
}

function secureRandomHex(size = 32) {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    return bytesToHex(bytes);
}

async function deriveSecretHash(secret, salt) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const digest = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt: hexToBytes(salt),
        iterations: 100000,
        hash: 'SHA-256'
    }, key, 256);
    return bytesToHex(new Uint8Array(digest));
}

function constantTimeEqual(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
}

function requiredRole(path, method = 'GET') {
    if (path === '/api/owner/register' || path === '/api/owner/login' || path === '/api/owner/forgot-pin' || path === '/api/owner/security-question' || path === '/api/owner/send-reset-otp' || path === '/api/owner/reset-by-otp') return null;
    if (path === '/api/captain/login') return null;
    if (method !== 'GET' && (path === '/api/coupons' || path.startsWith('/api/coupons/'))) return 'admin';
    if (/^\/api\/admin(?:\/|$)/.test(path)) return 'admin';
    if (/^\/api\/owner(?:\/|$)/.test(path)) return 'owner';
    if (/^\/api\/captain(?:\/|$)/.test(path)) return 'captain';
    if (path === '/api/auth/owner/setup') return 'owner';
    if (path === '/api/auth/owner/reset') return 'owner-recovery';
    return null;
}

const adminPermissionKeys = ['fleet', 'bookings', 'operators', 'customers', 'finance', 'reports', 'settings', 'team'];

function adminPermissionFor(path) {
    if (path === '/api/admin/state') return null;
    if (/^\/api\/admin\/buses(?:\/|$)/.test(path)) return 'fleet';
    if (/^\/api\/admin\/bookings(?:\/|$)/.test(path)) return 'bookings';
    if (/^\/api\/admin\/(?:owners|owner-requests|captains|reset-pin|impersonate-captain|impersonate-owner)(?:\/|$)/.test(path)) return 'operators';
    if (/^\/api\/admin\/(?:customers|support|impersonate-customer)(?:\/|$)/.test(path)) return 'customers';
    if (/^\/api\/admin\/(?:finance|operator-finance)(?:\/|$)/.test(path)) return 'finance';
    if (/^\/api\/admin\/replica-(?:status|backfill)$/.test(path)) return 'finance';
    if (/^\/api\/admin\/reports(?:\/|$)/.test(path)) return 'reports';
    if (/^\/api\/(?:admin\/)?(?:coupons|feature-flags|festival-theme|promotions|broadcast-email|email-recipients)(?:\/|$)/.test(path)) return 'settings';
    if (/^\/api\/admin\/(?:users|audit)(?:\/|$)/.test(path)) return 'team';
    return null;
}

async function getAdminPermissions(db, identifier) {
    if (identifier === 'admin' || identifier === 'support.busyatra@gmail.com') return ['all', ...adminPermissionKeys];
    const user = await db.prepare(
        'SELECT permissions, active FROM admin_users WHERE phone = ?'
    ).bind(identifier).first();
    if (!user || !user.active) return null;
    const permissions = parseJson(user.permissions, []);
    return Array.isArray(permissions)
        ? permissions.filter(permission => permission === 'all' || adminPermissionKeys.includes(permission))
        : [];
}

function hasAdminPermission(path, permissions, body = null) {
    if (permissions.includes('all')) return true;
    if (path.startsWith('/api/admin/notifications')) return true;
    if (path === '/api/admin/state' || path === '/api/admin/change-password') return permissions.length > 0;
    if (path === '/api/admin/reset-pin') {
        return body && body.role === 'customer'
            ? permissions.includes('customers')
            : body && ['owner', 'captain'].includes(body.role) && permissions.includes('operators');
    }
    const permission = adminPermissionFor(path);
    return Boolean(permission && permissions.includes(permission));
}

async function getRequestIdentity(request, db) {
    const match = (request.headers.get('Authorization') || '').match(/^Bearer ([a-f0-9]{64})$/i);
    if (!match) return null;
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
    const row = await db.prepare(
        'SELECT role, identifier, bus_id, expires_at FROM portal_sessions WHERE token_hash = ?'
    ).bind(bytesToHex(new Uint8Array(tokenHash))).first();
    if (!row || row.expires_at <= new Date().toISOString()) return null;
    return { 
        role: row.role, 
        identifier: row.identifier, 
        busId: row.bus_id,
        impersonatedByAdmin: row.bus_id === 'ADMIN_IMPERSONATION' || Boolean(row.bus_id && row.bus_id.startsWith('ADMIN_'))
    };
}

async function getCustomerIdentity(request, db) {
    const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+([a-f0-9]{64})$/i);
    if (!match) return null;
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
    const row = await db.prepare(
        "SELECT identifier as phone, expires_at FROM portal_sessions WHERE role = 'customer' AND token_hash = ?"
    ).bind(bytesToHex(new Uint8Array(tokenHash))).first();
    if (!row || row.expires_at <= new Date().toISOString()) return null;
    return { role: 'customer', identifier: row.phone };
}

// --- Enterprise Real Device, OS & Platform Telemetry Parser ---
function extractDeviceInfo(request, body = {}) {
    const headerTelemetry = parseJson(request.headers.get('x-device-telemetry'), null);
    const bodyTelemetry = body?.deviceInfo || body?.device_info || null;
    const client = bodyTelemetry || headerTelemetry || {};

    const ua = request.headers.get('user-agent') || '';
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
    const city = request.headers.get('cf-ipcity') || client.city || '';
    const region = request.headers.get('cf-region') || client.region || '';
    const country = request.headers.get('cf-ipcountry') || 'IN';

    let deviceType = client.deviceType || (/(Mobi|Android|iPhone)/i.test(ua) ? 'Mobile' : (/iPad|Tablet/i.test(ua) ? 'Tablet' : 'Desktop'));
    let brand = client.deviceBrand || 'Unknown';
    let model = client.deviceModel || '';
    let os = client.os || 'Unknown OS';
    let browser = client.browser || 'Browser';

    // Server-side Brand & Model fallback parsing
    if (!brand || brand === 'Unknown') {
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
        } else if (/Xiaomi|Mi\s*[0-9A-Z]+/i.test(ua)) {
            brand = 'Xiaomi';
        } else if (/iPhone/i.test(ua)) {
            brand = 'Apple';
            model = 'iPhone';
            os = 'iOS';
        } else if (/iPad/i.test(ua)) {
            brand = 'Apple';
            model = 'iPad';
            os = 'iOS';
        } else if (/Windows NT 10.0/i.test(ua)) {
            brand = 'Windows PC';
            model = 'Desktop/Laptop';
            os = 'Windows 11/10';
        } else if (/Macintosh|Mac OS X/i.test(ua)) {
            brand = 'Apple';
            model = 'Mac';
            os = 'macOS';
        } else if (/vivo|V2[0-9]{3}/i.test(ua)) {
            brand = 'Vivo';
        } else if (/realme|RMX[0-9]{4}/i.test(ua)) {
            brand = 'Realme';
        } else if (/OPPO|CPH[0-9]{4}/i.test(ua)) {
            brand = 'OPPO';
        } else if (/OnePlus/i.test(ua)) {
            brand = 'OnePlus';
        } else if (/moto|motorola/i.test(ua)) {
            brand = 'Motorola';
        }
    }

    if (!os || os === 'Unknown OS') {
        if (/Android\s*([0-9\.]+)?/i.test(ua)) {
            const m = ua.match(/Android\s*([0-9\.]+)/i);
            os = 'Android' + (m ? ' ' + m[1] : '');
        } else if (/Windows/i.test(ua)) {
            os = 'Windows 11/10';
        } else if (/iPhone|iPad/i.test(ua)) {
            os = 'iOS';
        }
    }

    if (!browser || browser === 'Browser') {
        if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
        else if (/Edg/i.test(ua)) browser = 'Edge';
        else if (/Chrome/i.test(ua)) browser = 'Chrome';
        else if (/Safari/i.test(ua)) browser = 'Safari';
        else if (/Firefox/i.test(ua)) browser = 'Firefox';
    }

    return {
        deviceType,
        deviceBrand: brand,
        deviceModel: model,
        os,
        browser,
        ipAddress: ip,
        city,
        region,
        country,
        rawUserAgent: ua.slice(0, 500)
    };
}

async function recordUserLoginDevice(db, role, identifier, userName, deviceInfo) {
    if (!identifier) return;
    const nowIso = new Date().toISOString();
    const id = `dev_${role}_${identifier}`;
    const logId = `dlog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
        await db.prepare(`
            INSERT INTO user_login_devices (
                id, role, identifier, user_name, device_type, device_brand, device_model, os, browser,
                ip_address, city, region, country, raw_user_agent, last_login_at, login_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(role, identifier) DO UPDATE SET
                user_name = COALESCE(excluded.user_name, user_login_devices.user_name),
                device_type = excluded.device_type,
                device_brand = excluded.device_brand,
                device_model = excluded.device_model,
                os = excluded.os,
                browser = excluded.browser,
                ip_address = excluded.ip_address,
                city = excluded.city,
                region = excluded.region,
                country = excluded.country,
                raw_user_agent = excluded.raw_user_agent,
                last_login_at = excluded.last_login_at,
                login_count = user_login_devices.login_count + 1
        `).bind(
            id, role, identifier, userName || null, deviceInfo.deviceType, deviceInfo.deviceBrand,
            deviceInfo.deviceModel || null, deviceInfo.os, deviceInfo.browser, deviceInfo.ipAddress,
            deviceInfo.city || null, deviceInfo.region || null, deviceInfo.country || 'IN',
            deviceInfo.rawUserAgent || '', nowIso
        ).run();

        // Also record in audit login history logs
        await db.prepare(`
            INSERT INTO user_login_logs (
                id, role, identifier, user_name, device_type, device_brand, device_model,
                os, browser, ip_address, city, region, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            logId, role, identifier, userName || null, deviceInfo.deviceType, deviceInfo.deviceBrand,
            deviceInfo.deviceModel || null, deviceInfo.os, deviceInfo.browser, deviceInfo.ipAddress,
            deviceInfo.city || null, deviceInfo.region || null, nowIso
        ).run();
    } catch (err) {
        console.warn('Failed to record user login device:', err);
    }
}

async function createCustomerSession(db, phone) {
    const token = secureRandomHex(32);
    const tokenDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare(
        "INSERT INTO portal_sessions (token_hash, role, identifier, bus_id, created_at, expires_at) VALUES (?, 'customer', ?, NULL, ?, ?)"
    ).bind(
        bytesToHex(new Uint8Array(tokenDigest)), phone, new Date().toISOString(), expiresAt
    ).run();
    return { token, expiresAt };
}

async function recordCustomerFailedLogin(db, phone) {
    const now = new Date();
    const previous = await db.prepare(
        "SELECT failed_attempts, first_failed_at FROM portal_login_attempts WHERE role = 'customer' AND identifier = ?"
    ).bind(phone).first();
    const inWindow = previous && now.getTime() - Date.parse(previous.first_failed_at) < 15 * 60 * 1000;
    const failedAttempts = inWindow ? (previous.failed_attempts || 0) + 1 : 1;
    const firstFailedAt = inWindow ? previous.first_failed_at : now.toISOString();
    const lockedUntil = failedAttempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
    if (previous) {
        await db.prepare(
            "UPDATE portal_login_attempts SET failed_attempts = ?, first_failed_at = ?, locked_until = ?, last_attempt = ? WHERE role = 'customer' AND identifier = ?"
        ).bind(failedAttempts, firstFailedAt, lockedUntil, now.toISOString(), phone).run();
    } else {
        await db.prepare(
            "INSERT INTO portal_login_attempts (role, identifier, attempts, failed_attempts, first_failed_at, last_attempt, locked_until) VALUES ('customer', ?, 1, ?, ?, ?, ?)"
        ).bind(phone, failedAttempts, firstFailedAt, now.toISOString(), lockedUntil).run();
    }
    return Boolean(lockedUntil);
}

async function recordAdminAudit(db, auth, action, target, details = {}) {
    await db.prepare(
        'INSERT INTO admin_audit_log (actor_identifier, action, target, details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
        auth.identifier, action, target, JSON.stringify(details), new Date().toISOString()
    ).run();
}

async function saveCredential(db, { role, identifier, busId = null, pin, securityQuestion = null, securityAnswer = null }) {
    const pinSalt = secureRandomHex(16);
    const pinHash = await deriveSecretHash(pin, pinSalt);
    let securityAnswerSalt = null;
    let securityAnswerHash = null;
    if (securityAnswer) {
        securityAnswerSalt = secureRandomHex(16);
        securityAnswerHash = await deriveSecretHash(securityAnswer.trim().toLowerCase(), securityAnswerSalt);
    }
    await db.prepare(
        `INSERT INTO portal_credentials (
            role, identifier, bus_id, pin_salt, pin_hash, security_question,
            security_answer_salt, security_answer_hash, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (role, identifier) DO UPDATE SET
            bus_id = excluded.bus_id, pin_salt = excluded.pin_salt, pin_hash = excluded.pin_hash,
            active = 1,
            security_question = COALESCE(excluded.security_question, portal_credentials.security_question),
            security_answer_salt = COALESCE(excluded.security_answer_salt, portal_credentials.security_answer_salt),
            security_answer_hash = COALESCE(excluded.security_answer_hash, portal_credentials.security_answer_hash),
            updated_at = excluded.updated_at`
    ).bind(
        role, identifier, busId, pinSalt, pinHash, securityQuestion,
        securityAnswerSalt, securityAnswerHash, new Date().toISOString()
    ).run();
}

async function setCredentialPin(db, { role, identifier, busId = null, pin }) {
    const pinSalt = secureRandomHex(16);
    const pinHash = await deriveSecretHash(pin, pinSalt);
    const result = await db.prepare(
        'UPDATE portal_credentials SET pin_salt = ?, pin_hash = ?, updated_at = ? WHERE role = ? AND identifier = ?'
    ).bind(pinSalt, pinHash, new Date().toISOString(), role, identifier).run();
    if (!result.meta?.changes) {
        await saveCredential(db, { role, identifier, busId, pin });
    }
}

async function createPortalSession(db, identity) {
    const token = secureRandomHex(32);
    const tokenDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare(
        'INSERT INTO portal_sessions (token_hash, role, identifier, bus_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
        bytesToHex(new Uint8Array(tokenDigest)), identity.role, identity.identifier,
        identity.busId || null, expiresAt, new Date().toISOString()
    ).run();
    return { token, expiresAt };
}

async function recordFailedLogin(db, role, identifier) {
    const now = new Date();
    const previous = await db.prepare(
        'SELECT failed_attempts, first_failed_at FROM portal_login_attempts WHERE role = ? AND identifier = ?'
    ).bind(role, identifier).first();
    const inWindow = previous && now.getTime() - Date.parse(previous.first_failed_at) < 15 * 60 * 1000;
    const failedAttempts = inWindow ? previous.failed_attempts + 1 : 1;
    const firstFailedAt = inWindow ? previous.first_failed_at : now.toISOString();
    const lockedUntil = failedAttempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
    await db.prepare(
        `INSERT INTO portal_login_attempts (role, identifier, failed_attempts, first_failed_at, locked_until)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (role, identifier) DO UPDATE SET
            failed_attempts = excluded.failed_attempts,
            first_failed_at = excluded.first_failed_at,
            locked_until = excluded.locked_until`
    ).bind(role, identifier, failedAttempts, firstFailedAt, lockedUntil).run();
    return Boolean(lockedUntil);
}

async function authenticateWithPin(db, role, identifier, pin) {
    const lock = await db.prepare(
        'SELECT locked_until FROM portal_login_attempts WHERE role = ? AND identifier = ?'
    ).bind(role, identifier).first();
    if (lock && lock.locked_until && lock.locked_until > new Date().toISOString()) {
        return { error: jsonError(429, 'Too many failed attempts. Try again in 15 minutes.') };
    }
    const credential = await db.prepare(
        'SELECT * FROM portal_credentials WHERE role = ? AND identifier = ?'
    ).bind(role, identifier).first();
    if (credential && credential.active === 0) {
        return { error: jsonError(403, 'This portal account is disabled. Contact the administrator.') };
    }
    const pinHash = credential ? await deriveSecretHash(pin, credential.pin_salt) : '';
    if (!credential || !constantTimeEqual(pinHash, credential.pin_hash)) {
        if (await recordFailedLogin(db, role, identifier)) {
            return { error: jsonError(429, 'Too many failed attempts. Try again in 15 minutes.') };
        }
        return { error: jsonError(401, role === 'admin' ? 'ভুল ইউজারনেম বা পাসওয়ার্ড (Invalid admin username or password).' : 'ভুল মোবাইল নম্বর বা পিন (Invalid mobile number or PIN).') };
    }
    await db.prepare('DELETE FROM portal_login_attempts WHERE role = ? AND identifier = ?').bind(role, identifier).run();
    const identity = { role, identifier, busId: credential.bus_id };
    return { identity, session: await createPortalSession(db, identity) };
}

async function sendBrevoEmail(env, { toEmail, toName, subject, htmlContent }) {
    if (!env.BREVO_API_KEY) {
        throw new Error('BREVO_API_KEY is not configured in Cloudflare environment.');
    }
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': env.BREVO_API_KEY,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: {
                name: 'Bus Yatra Support',
                email: 'support.busyatra@gmail.com'
            },
            to: [{
                email: toEmail,
                name: toName || toEmail
            }],
            subject,
            htmlContent
        })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
        const errorMsg = (result && (result.message || result.error)) || `Email service error (${response.status})`;
        throw new Error(errorMsg);
    }
    return result;
}

async function sendEmailOtp(env, { email, role, purpose }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('বৈধ ইমেইল ঠিকানা প্রদান করুন (Enter a valid email address).');
    }

    const existing = await env.DB.prepare(
        'SELECT * FROM email_otps WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1'
    ).bind(cleanEmail, purpose).first();

    const now = Date.now();
    if (existing && existing.created_at) {
        const lastSent = Date.parse(existing.created_at);
        if (now - lastSent < 60 * 1000) {
            const waitSec = Math.ceil((60 * 1000 - (now - lastSent)) / 1000);
            throw new Error(`দয়া করে ${waitSec} সেকেন্ড পর পুনরায় চেষ্টা করুন (Please wait ${waitSec}s before requesting a new OTP).`);
        }
    }

    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const otp = (100000 + (randomArray[0] % 900000)).toString();
    const otpHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(otp + '_bus_yatra_salt'));
    const otpHashHex = bytesToHex(new Uint8Array(otpHash));
    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();

    await env.DB.prepare(
        'DELETE FROM email_otps WHERE email = ? AND purpose = ?'
    ).bind(cleanEmail, purpose).run();

    await env.DB.prepare(
        'INSERT INTO email_otps (email, otp_hash, purpose, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)'
    ).bind(cleanEmail, otpHashHex, purpose, expiresAt, new Date().toISOString()).run();

    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 28px 24px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px;">🚌 Bus Yatra</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.95; font-weight: 500;">Secure Portal Verification</p>
            </div>
            <div style="padding: 32px 24px; text-align: center; color: #111827;">
                <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">আপনার ভেরিফিকেশন ওটিপি (Verification OTP)</h2>
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
                    Bus Yatra পোর্টালে লগইন / ভেরিফিকেশন সম্পন্ন করার জন্য নিচের ৬-সংখ্যার ওটিপি ব্যবহার করুন। এই কোডটি আগামী <strong>১০ মিনিট</strong> বৈধ থাকবে।
                </p>
                <div style="background: #fef2f2; border: 2px dashed #dc2626; border-radius: 14px; padding: 18px 28px; display: inline-block; margin-bottom: 24px;">
                    <span style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #dc2626; font-family: monospace;">${otp}</span>
                </div>
                <p style="font-size: 12px; color: #6b7280; margin: 0; line-height: 1.5;">
                    ⚠️ সতর্কতা: এই ওটিপি কোডটি গোপনীয়। এটি কারো সাথে শেয়ার করবেন না। আপনি যদি এই অনুরোধ না করে থাকেন, তবে অবিলম্বে পাসওয়ার্ড পরিবর্তন করুন।
                </p>
            </div>
            <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px; text-align: center; font-size: 12px; color: #6b7280;">
                © ${new Date().getFullYear()} Bus Yatra. All rights reserved. • support.busyatra@gmail.com
            </div>
        </div>
    `;

    await sendBrevoEmail(env, {
        toEmail: cleanEmail,
        toName: role === 'admin' ? 'Bus Yatra Super Admin' : 'Bus Yatra User',
        subject: `[Bus Yatra] আপনার ভেরিফিকেশন ওটিপি: ${otp}`,
        htmlContent
    });

    return { ok: true, message: 'আপনার ইমেইলে ৬-সংখ্যার ওটিপি পাঠানো হয়েছে!' };
}

async function verifyEmailOtp(env, { email, otp, purpose }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanOtp = String(otp || '').trim();
    if (!cleanEmail || !cleanOtp) {
        throw new Error('ইমেইল ও ওটিপি আবশ্যক (Email and OTP are required).');
    }

    const record = await env.DB.prepare(
        'SELECT * FROM email_otps WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1'
    ).bind(cleanEmail, purpose).first();

    if (!record) {
        throw new Error('কোনো সক্রিয় ওটিপি পাওয়া যায়নি। অনুগ্রহ করে নতুন ওটিপি পাঠান (No active OTP found. Please request again).');
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
        throw new Error('ওটিপির মেয়াদ শেষ হয়ে গেছে। পুনরায় নতুন ওটিপি পাঠান (OTP has expired).');
    }

    if (record.attempts >= 5) {
        throw new Error('অতিরিক্ত ভুল চেষ্টা করা হয়েছে। নতুন ওটিপি অনুরোধ করুন (Too many incorrect attempts).');
    }

    const otpHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cleanOtp + '_bus_yatra_salt'));
    const otpHashHex = bytesToHex(new Uint8Array(otpHash));

    if (!constantTimeEqual(otpHashHex, record.otp_hash)) {
        await env.DB.prepare('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?').bind(record.id).run();
        throw new Error('ভুল ওটিপি কোড (Invalid OTP code).');
    }

    await env.DB.prepare('DELETE FROM email_otps WHERE id = ?').bind(record.id).run();
    return true;
}

export async function onRequest(context) {
    const response = await handleRequest(context);
    const { request, env } = context;
    if (response.ok && request.method !== 'GET' && request.method !== 'OPTIONS' &&
        env.FIREBASE_PROJECT_ID && env.FIREBASE_SERVICE_ACCOUNT_EMAIL &&
        env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        const replication = drainFirebaseReplica(env.DB, env).catch(error => {
            console.error('Firebase replica drain failed; queued records remain in D1.', error);
        });
        if (typeof context.waitUntil === 'function') {
            context.waitUntil(replication);
        } else {
            await replication;
        }
    }
    return applyCorsHeaders(response, request);
}

async function handleRequest(context) {
    const { request } = context;
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': resolveAllowedCorsOrigin(request),
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-telemetry, x-customer-phone, x-ticket-token',
                'Vary': 'Origin'
            }
        });
    }

    try {
        const path = new URL(request.url).pathname;
        const role = requiredRole(path, request.method);
        if (role && role !== 'owner-recovery') {
            let identity = await getRequestIdentity(request, context.env.DB);
            if (!identity) return jsonError(401, 'Please sign in to access this portal.');
            if (identity.role !== role) return jsonError(403, 'This account cannot access this portal.');
            if (role === 'admin') {
                const permissions = await getAdminPermissions(context.env.DB, identity.identifier);
                if (!permissions) return jsonError(403, 'This administrator account is disabled or not configured.');
                const requestBody = path === '/api/admin/reset-pin' && request.method !== 'GET'
                    ? await readJson(request.clone())
                    : null;
                if (!hasAdminPermission(path, permissions, requestBody)) {
                    return jsonError(403, 'Your administrator account does not have permission for this action.');
                }
                identity = { ...identity, permissions };
            }
            if (role === 'owner' && path !== '/api/auth/owner/setup' && !identity.impersonatedByAdmin) {
                const credential = await context.env.DB.prepare(
                    'SELECT security_question, security_answer_salt, security_answer_hash FROM portal_credentials WHERE role = ? AND identifier = ?'
                ).bind('owner', identity.identifier).first();
                const hasSecurityQuestion = Boolean(credential && credential.security_question &&
                    credential.security_answer_salt && credential.security_answer_hash);
                if (!hasSecurityQuestion) {
                    const ownerEmail = await context.env.DB.prepare(
                        'SELECT email FROM owners WHERE phone = ?'
                    ).bind(identity.identifier).first();
                    const busEmail = !ownerEmail?.email ? await context.env.DB.prepare(
                        'SELECT owner_email FROM buses WHERE owner_phone = ?'
                    ).bind(identity.identifier).first() : null;
                    const hasEmail = Boolean((ownerEmail && ownerEmail.email && ownerEmail.email.includes('@')) ||
                                            (busEmail && busEmail.owner_email && busEmail.owner_email.includes('@')));
                    if (!hasEmail) {
                        return jsonError(403, 'Complete owner PIN and recovery setup before using the portal.');
                    }
                }
            }
            return request.method === 'GET'
                ? await handleGet({ ...context, auth: identity })
                : request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH'
                    ? await handlePost({ ...context, auth: identity })
                    : request.method === 'DELETE'
                        ? await handleDelete({ ...context, auth: identity })
                        : jsonError(405, 'Method not allowed.');
        }
        if (role === 'owner-recovery' && request.method !== 'POST') {
            return jsonError(405, 'Method not allowed.');
        }
        if (path === '/api/customer/me' || path === '/api/customer/logout' || path === '/api/customer/profile-photo') {
            const identity = await getCustomerIdentity(request, context.env.DB);
            if (!identity) return jsonError(401, 'Please sign in to access your customer account.');
            return request.method === 'GET'
                ? await handleGet({ ...context, auth: identity })
                : request.method === 'POST'
                    ? await handlePost({ ...context, auth: identity })
                    : jsonError(405, 'Method not allowed.');
        }
        if (path === '/api/bookings/cancellation') {
            const identity = await getCustomerIdentity(request, context.env.DB);
            if (!identity) return jsonError(401, 'Please sign in to cancel a booking.');
            return request.method === 'POST'
                ? await handlePost({ ...context, auth: identity })
                : jsonError(405, 'Method not allowed.');
        }
        if (path.startsWith('/api/customer/bookings')) {
            const identity = await getCustomerIdentity(request, context.env.DB);
            if (!identity) return jsonError(401, 'Please sign in to manage your customer bookings.');
            return request.method === 'DELETE'
                ? await handleDelete({ ...context, auth: identity })
                : request.method === 'POST'
                    ? await handlePost({ ...context, auth: identity })
                    : jsonError(405, 'Method not allowed.');
        }
        let identity = await getRequestIdentity(request, context.env.DB);
        if (!identity) {
            identity = await getCustomerIdentity(request, context.env.DB);
        }
        const ctxWithAuth = { ...context, auth: identity || context.auth || { role: 'guest', identifier: '' } };

        if (request.method === 'GET') {
            return await handleGet(ctxWithAuth);
        } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
            return await handlePost(ctxWithAuth);
        } else if (request.method === 'DELETE') {
            return await handleDelete(ctxWithAuth);
        }
        return jsonError(405, 'Method not allowed.');
    } catch (err) {
        console.error('API Error:', err);
        return jsonError(500, err.message || 'Internal Server Error');
    }
}

async function handleGet(context) {
    const { request, env, auth } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/auth/admin/status') {
        const cred = await env.DB.prepare(
            "SELECT security_question, security_answer_salt, security_answer_hash FROM portal_credentials WHERE role = 'admin' AND (identifier = 'support.busyatra@gmail.com' OR identifier = 'admin')"
        ).first();
        const isSetup = Boolean(cred && cred.security_question && cred.security_answer_hash);
        return jsonResponse({
            ok: true,
            configured: Boolean(cred),
            isSetup,
            email: 'support.busyatra@gmail.com',
            securityQuestion: (cred && cred.security_question) || 'Primary route?'
        });
    }

    if (path === '/api/auth/admin/security-question') {
        const admin = await env.DB.prepare(
            "SELECT security_question FROM portal_credentials WHERE role = 'admin' AND (identifier = 'support.busyatra@gmail.com' OR identifier = 'admin')"
        ).first();
        if (!admin || !admin.security_question) return jsonError(404, 'Admin recovery is not configured.');
        return jsonResponse({ question: admin.security_question });
    }

    if (path === '/api/auth/owner/security-question' || path === '/api/owner/security-question') {
        const phone = String(url.searchParams.get('phone') || '').trim();
        if (!/^[6-9]\d{9}$/.test(phone)) return jsonError(400, 'Enter a valid 10-digit owner mobile number.');
        let question = null;
        const credential = await env.DB.prepare(
            'SELECT security_question FROM portal_credentials WHERE role = ? AND identifier = ?'
        ).bind('owner', phone).first();
        if (credential && credential.security_question) {
            question = credential.security_question;
        }
        if (!question) {
            const owner = await env.DB.prepare('SELECT security_question FROM owners WHERE phone = ?').bind(phone).first();
            if (owner && owner.security_question) question = owner.security_question;
        }
        if (!question) {
            const req = await env.DB.prepare('SELECT security_question FROM owner_requests WHERE owner_phone = ?').bind(phone).first();
            if (req && req.security_question) question = req.security_question;
        }
        if (!question) {
            return jsonError(404, 'এই নম্বরের জন্য কোনো সিকিউরিটি প্রশ্ন সেট করা নেই।');
        }
        return jsonResponse({ question, security_question: question });
    }

    if (path === '/api/customer/security-question') {
        const phone = String(url.searchParams.get('phone') || '').trim();
        if (!/^[6-9]\d{9}$/.test(phone)) return jsonError(400, 'Enter a valid 10-digit mobile number.');
        const customer = await env.DB.prepare(
            "SELECT security_question FROM customers WHERE phone = ? AND status = 'active'"
        ).bind(phone).first();
        if (!customer) return jsonError(404, 'No active customer account was found for this number.');
        return jsonResponse({ question: customer.security_question });
    }

    // GET /api/buses
    if (path === '/api/buses') {
        await ensureEnterpriseSegmentTables(env.DB);
        const date = url.searchParams.get('date');
        const reqFrom = (url.searchParams.get('from') || '').trim();
        const reqTo = (url.searchParams.get('to') || '').trim();
        if (date && !isValidJourneyDate(date)) return jsonError(400, 'A valid journey date is required.');
        const flags = await getFeatureFlags(env.DB);

        const query = date
            ? `SELECT b.*, COALESCE(sd.enabled, 1) AS service_enabled
               FROM buses b
               LEFT JOIN bus_service_dates sd ON sd.bus_id = b.id AND sd.journey_date = ?
               WHERE COALESCE(b.approval_status, 'approved') = 'approved'
               ORDER BY b.name`
            : `SELECT * FROM buses WHERE COALESCE(approval_status, 'approved') = 'approved' ORDER BY name`;
        const result = date
            ? await env.DB.prepare(query).bind(date).all()
            : await env.DB.prepare(query).all();

        const buses = [];
        for (const row of (result.results || [])) {
            // If inactive or not approved, completely hidden from customer search
            if (row.booking_mode === 'inactive') continue;
            if (row.approval_status && row.approval_status !== 'approved') continue;
            if (date && !row.service_enabled) continue;

            const totalSeats = row.total_seats || 65;

            // 1. Up-Trip (Standard Route)
            let upPush = true;
            let upRemaining = undefined;
            let upSegmentFare = undefined;
            let upEnrouteState = undefined;
            if (date) {
                const upStops = getEffectiveStoppagesList(row, false);
                const fIdx = reqFrom ? resolveStoppageIdx(upStops, reqFrom) : -1;
                const tIdx = reqTo ? resolveStoppageIdx(upStops, reqTo) : -1;
                const segMatch = fIdx >= 0 && tIdx > fIdx;
                const occupied = await getSegmentOccupiedSeats(env.DB, row.id, date, segMatch ? fIdx : 0, segMatch ? tIdx : 999, flags);
                upRemaining = Math.max(0, totalSeats - occupied.length);
                if (upRemaining <= 0) upPush = false;
                if (segMatch) {
                    upSegmentFare = resolveSegmentFare(row, upStops[fIdx], upStops[tIdx], false, flags);
                    upEnrouteState = evaluateEnrouteStopState(row, date, upStops[fIdx], false, flags);
                }
            }
            if (upPush) {
                buses.push({
                    ...mapBus(row),
                    tripDirection: 'UP',
                    remainingSeats: upRemaining,
                    ...(upSegmentFare !== undefined ? { segmentFare: upSegmentFare } : {}),
                    ...(upEnrouteState ? { enrouteState: upEnrouteState } : {})
                });
            }

            // 2. Return-Trip (If Return Route is Enabled)
            if (row.return_route_enabled) {
                const returnStops = getEffectiveStoppagesList(row, true);
                const returnRoute = row.return_route || (returnStops[0] + ' - ' + returnStops[returnStops.length - 1]);
                const returnTime = row.return_time || '03:30 PM';
                const returnTimings = parseJson(row.return_stoppage_timings, {});
                const returnFares = parseJson(row.return_stoppage_fares, {});
                const returnFare = Number(row.return_fare || row.fare || 0);

                let retPush = true;
                let retRemaining = undefined;
                let retSegmentFare = undefined;
                let retEnrouteState = undefined;
                if (date) {
                    const rfIdx = reqFrom ? resolveStoppageIdx(returnStops, reqFrom) : -1;
                    const rtIdx = reqTo ? resolveStoppageIdx(returnStops, reqTo) : -1;
                    const retSegMatch = rfIdx >= 0 && rtIdx > rfIdx;
                    const retOccupied = await getSegmentOccupiedSeats(env.DB, row.id + '_RETURN', date, retSegMatch ? rfIdx : 0, retSegMatch ? rtIdx : 999, flags);
                    retRemaining = Math.max(0, totalSeats - retOccupied.length);
                    if (retRemaining <= 0) retPush = false;
                    if (retSegMatch) {
                        retSegmentFare = resolveSegmentFare(row, returnStops[rfIdx], returnStops[rtIdx], true, flags);
                        retEnrouteState = evaluateEnrouteStopState(row, date, returnStops[rfIdx], true, flags);
                    }
                }

                if (retPush) {
                    buses.push({
                        ...mapBus(row),
                        id: row.id + '_RETURN',
                        parentBusId: row.id,
                        name: `${row.name} (Return / ডাউন ট্রিপ)`,
                        route: returnRoute,
                        time: returnTime,
                        stoppages: returnStops,
                        stoppageTimings: returnTimings,
                        stoppage_timings: returnTimings,
                        stoppageFares: returnFares,
                        stoppage_fares: returnFares,
                        fare: returnFare,
                        tripDirection: 'DOWN',
                        remainingSeats: retRemaining,
                        ...(retSegmentFare !== undefined ? { segmentFare: retSegmentFare } : {}),
                        ...(retEnrouteState ? { enrouteState: retEnrouteState } : {})
                    });
                }
            }
        }
        return jsonResponse({ buses }, 200, { 'Cache-Control': reqFrom ? 'no-cache, max-age=0' : 'public, max-age=5, stale-while-revalidate=30' });
    }

    if (path === '/api/config') {
        return jsonResponse({ featureFlags: await getFeatureFlags(env.DB) }, 200, { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' });
    }

    if (path === '/api/festival-theme') {
        const flags = await getFeatureFlags(env.DB);
        const rawTheme = flags.expansionConfig?.festivalTheme || defaultExpansionConfig.festivalTheme;
        const isThemeEnabled = flags.festivalTheme === true && Boolean(rawTheme.enabled);
        const resolvedTheme = {
            ...rawTheme,
            enabled: isThemeEnabled,
            festival: isThemeEnabled ? (rawTheme.festival || 'none') : 'none'
        };
        return jsonResponse({ festivalTheme: resolvedTheme }, 200, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    }

    // GET /api/seats?busId=...&date=...&from=...&to=...
    if (path === '/api/seats') {
        await ensureEnterpriseSegmentTables(env.DB);
        const busId = url.searchParams.get('busId');
        const date = url.searchParams.get('date');
        const reqFrom = (url.searchParams.get('from') || '').trim();
        const reqTo = (url.searchParams.get('to') || '').trim();
        if (!busId || !date) return jsonError(400, 'busId and date are required.');
        if (!isValidJourneyDate(date)) return jsonError(400, 'A valid journey date is required.');
        const sessionId = url.searchParams.get('sessionId') || '';
        const isReturnTrip = String(busId).endsWith('_RETURN');
        const physicalBusId = busId.replace('_RETURN', '');

        const bus = await env.DB.prepare(
            `SELECT b.*, COALESCE(sd.enabled, 1) AS service_enabled
             FROM buses b
             LEFT JOIN bus_service_dates sd ON sd.bus_id = b.id AND sd.journey_date = ?
             WHERE b.id = ?`
        ).bind(date, physicalBusId).first();
        if (!bus) return jsonError(404, 'Bus not found.');
        if (bus.approval_status && bus.approval_status !== 'approved') return jsonError(403, 'এই বাসটি এখনো অ্যাডমিন কর্তৃক অনুমোদিত হয়নি (This bus is awaiting admin approval).');
        if (bus.booking_mode === 'inactive') return jsonError(409, 'এই বাসের বুকিং সাময়িকভাবে বন্ধ আছে (Booking for this bus is currently disabled).');
        if (!bus.service_enabled) return jsonError(409, 'This bus is not operating on the selected date.');

        const nowIso = new Date().toISOString();
        await Promise.all([
            env.DB.prepare('DELETE FROM seat_holds WHERE expires_at <= ?').bind(nowIso).run(),
            env.DB.prepare('DELETE FROM seat_hold_legs WHERE expires_at <= ?').bind(nowIso).run()
        ]);

        const flags = await getFeatureFlags(env.DB);
        const stops = getEffectiveStoppagesList(bus, isReturnTrip);
        const fromIdx = reqFrom ? resolveStoppageIdx(stops, reqFrom) : 0;
        const toIdx = reqTo ? resolveStoppageIdx(stops, reqTo) : Math.max(1, stops.length - 1);
        const validSeg = fromIdx >= 0 && toIdx > fromIdx;
        const effFrom = validSeg ? fromIdx : 0;
        const effTo = validSeg ? toIdx : Math.max(1, stops.length - 1);

        const bookedSeats = await getSegmentOccupiedSeats(env.DB, busId, date, effFrom, effTo, flags);
        const { heldSeats, myHeldSeats } = await getSegmentHeldSeats(env.DB, busId, date, effFrom, effTo, sessionId, nowIso, flags);

        const isHoldEnabled = flags.seatHoldTimer !== false;
        const holdMins = Number(flags.seatHoldMinutes) || 15;
        const segmentFare = (reqFrom && reqTo && validSeg)
            ? resolveSegmentFare(bus, stops[effFrom], stops[effTo], isReturnTrip, flags)
            : undefined;

        return jsonResponse({
            seats: bookedSeats,
            heldSeats: isHoldEnabled ? heldSeats : [],
            myHeldSeats: isHoldEnabled ? myHeldSeats : [],
            holdMinutes: isHoldEnabled ? holdMins : 0,
            seatHoldEnabled: isHoldEnabled,
            ...(segmentFare !== undefined ? { segmentFare } : {})
        });
    }

    // GET /api/bookings/lookup?phone=... OR ?bookingId=...
    if (path === '/api/bookings/lookup') {
        const rawPhone = url.searchParams.get('phone');
        const phone = rawPhone ? rawPhone.trim() : '';
        const bookingId = (url.searchParams.get('bookingId') || '').trim();
        if (bookingId && !phone) return jsonError(400, 'Phone number is required to verify a booking.');
        if (!phone && !bookingId) return jsonError(400, 'Phone or Booking ID required.');

        // Privacy & Protection: Check if target phone is an active registered customer
        if (phone) {
            const registeredCustomer = await env.DB.prepare(
                "SELECT phone, name, status FROM customers WHERE phone = ?"
            ).bind(phone).first();

            if (registeredCustomer && (registeredCustomer.status === 'active' || !registeredCustomer.status)) {
                const authCustomer = await getCustomerIdentity(request, env.DB);
                if (!authCustomer || authCustomer.identifier !== phone) {
                    return jsonResponse({
                        error: 'এই মোবাইল নম্বরটি নিবন্ধিত রয়েছে। বুকিং হিস্ট্রি দেখতে অনুগ্রহ করে প্রথমে আপনার ৪-ডিজিট পিন দিয়ে লগইন করুন (This mobile number is already registered. Please login to your account with PIN to view booking history).',
                        requireLogin: true,
                        registered: true,
                        phone
                    }, 403);
                }
            }
        }
        if (phone && !bookingId) {
            const { results } = await env.DB.prepare(
                `SELECT b.*, bs.company_name, bs.gst_number, bs.ticket_terms, bs.emergency_phone, bs.time, bs.stoppage_timings
                 FROM bookings b
                 LEFT JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
                 WHERE b.passenger_phone = ? AND COALESCE(b.hidden_for_customer, 0) = 0
                 ORDER BY b.created_at DESC`
            ).bind(phone.trim()).all();
            return jsonResponse({ bookings: results.map(r => mapBooking(r, r)) });
        }
        if (bookingId) {
            let row;
            if (phone) {
                row = await env.DB.prepare(
                    `SELECT b.*, bs.company_name, bs.gst_number, bs.ticket_terms, bs.emergency_phone, bs.time, bs.stoppage_timings
                     FROM bookings b
                     LEFT JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
                     WHERE b.id = ? AND b.passenger_phone = ?`
                ).bind(bookingId.trim(), phone.trim()).first();
            } else {
                row = await env.DB.prepare(
                    `SELECT b.*, bs.company_name, bs.gst_number, bs.ticket_terms, bs.emergency_phone, bs.time, bs.stoppage_timings
                     FROM bookings b
                     LEFT JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
                     WHERE b.id = ?`
                ).bind(bookingId.trim()).first();
            }
            if (!row) return jsonError(404, 'Booking not found. Please verify the Booking ID and Phone number.');
            return jsonResponse({ booking: mapBooking(row, row) });
        }
        return jsonError(400, 'Phone or Booking ID required.');
    }

    // GET /api/coupons
    if (path === '/api/coupons') {
        const nowIso = new Date().toISOString();
        const { results } = await env.DB.prepare(
            `SELECT code, discount, active, min_fare, max_uses, used_count, expires_at
             FROM coupons
             WHERE active = 1
               AND (expires_at IS NULL OR expires_at = '' OR expires_at > ?)
               AND (max_uses IS NULL OR used_count < max_uses)`
        ).bind(nowIso).all();
        return jsonResponse({
            coupons: (results || []).map(r => ({
                code: r.code,
                discount: r.discount,
                active: Boolean(r.active),
                minFare: Number(r.min_fare || 0),
                maxUses: r.max_uses !== null && r.max_uses !== undefined ? Number(r.max_uses) : null,
                usedCount: Number(r.used_count || 0),
                expiresAt: r.expires_at || null
            }))
        });
    }

    // GET /api/promotions/active?target=customer|owner
    if (path === '/api/promotions/active') {
        await ensurePromotionExtensionColumns(env.DB);
        const target = (url.searchParams.get('target') || 'customer').toLowerCase();
        const flags = await getFeatureFlags(env.DB);
        const searchBannerAdsEnabled = flags.searchBannerAds !== false;
        let popupPromo = null;
        let searchBanners = [];
        try {
            const { results } = await env.DB.prepare(
                `SELECT id, title, image_url, link_url, target, media_type, placement, created_at, updated_at
                 FROM promotions
                 WHERE active = 1 AND (target = ? OR target = 'all')
                 ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC LIMIT 20`
            ).bind(target).all();

            const rows = (results || []).map(r => ({
                ...r,
                media_type: r.media_type || detectPromoMediaType(r.image_url, ''),
                placement: r.placement || 'popup'
            }));

            popupPromo = rows.find(r => r.placement === 'popup' || r.placement === 'both') || null;
            if (searchBannerAdsEnabled) {
                searchBanners = rows.filter(r => r.placement === 'search_banner' || r.placement === 'both').slice(0, 8);
            }

            const seenIds = new Set();
            if (popupPromo?.id) seenIds.add(popupPromo.id);
            searchBanners.forEach(b => { if (b?.id) seenIds.add(b.id); });
            if (seenIds.size > 0) {
                const placeholders = Array.from(seenIds).map(() => '?').join(',');
                env.DB.prepare(`UPDATE promotions SET views_count = views_count + 1 WHERE id IN (${placeholders})`)
                    .bind(...Array.from(seenIds)).run().catch(() => {});
            }
        } catch (promoErr) {
            console.warn('Active promotion query notice:', promoErr);
        }
        return jsonResponse({
            ok: true,
            promotion: popupPromo,
            searchBanners,
            searchBannerAdsEnabled
        });
    }

    // GET /api/tracking
    if (path === '/api/tracking' || path === '/api/owner/tracking' || path === '/api/admin/tracking') {
        const flags = await getFeatureFlags(env.DB);
        if (!flags.liveTracking) return jsonError(403, 'Live tracking is currently disabled.');
        const rawBusId = url.searchParams.get('busId');
        if (!rawBusId) return jsonError(400, 'busId required.');
        const busId = rawBusId.replace(/_RETURN$/, '');
        if (path === '/api/owner/tracking') {
            const ownedBus = await env.DB.prepare('SELECT id FROM buses WHERE id = ? AND owner_phone = ?')
                .bind(busId, auth.identifier).first();
            if (!ownedBus) return jsonError(404, 'Bus not found.');
        }
        const bus = await env.DB.prepare('SELECT lat, lng, location_updated_at, name, bus_number FROM buses WHERE id = ?').bind(busId).first();
        if (!bus) return jsonError(404, 'Bus not found.');
        const hasLocation = typeof bus.lat === 'number' && typeof bus.lng === 'number' && Boolean(bus.location_updated_at);
        return jsonResponse({
            location: {
                lat: hasLocation ? bus.lat : null,
                lng: hasLocation ? bus.lng : null,
                location_updated_at: hasLocation ? bus.location_updated_at : null,
                name: bus.name,
                bus_number: bus.bus_number
            }
        });
    }

    // GET /api/owner/expenses
    if (path === '/api/owner/expenses') {
        if (auth?.role !== 'owner') return jsonError(403, 'Unauthorized.');
        const ownerPhone = auth.identifier;
        const busId = url.searchParams.get('busId');
        const journeyDate = url.searchParams.get('date');

        let query = 'SELECT * FROM trip_expenses WHERE owner_phone = ?';
        const params = [ownerPhone];
        if (busId) {
            query += ' AND bus_id = ?';
            params.push(busId);
        }
        if (journeyDate) {
            query += ' AND journey_date = ?';
            params.push(journeyDate);
        }
        query += ' ORDER BY created_at DESC LIMIT 500';

        const stmt = env.DB.prepare(query);
        const rows = (await stmt.bind(...params).all()).results || [];
        return jsonResponse({ expenses: rows });
    }

    // GET /api/owner/state
    if (path === '/api/owner/state') {
        await ensureEnterpriseSegmentTables(env.DB);
        const ownerPhone = auth?.identifier || url.searchParams.get('phone') || '';
        let busesRows = [];
        let bookingRows = [];
        let reviewRows = [];
        let ownerFeatures = {
            auto_pilot: true,
            notifications: true,
            captains: true,
            finance: true,
            live_tracking: true,
            edit_bus: true
        };

        if (ownerPhone) {
            const ownerRecord = await env.DB.prepare('SELECT features FROM owners WHERE phone = ?').bind(ownerPhone).first();
            if (ownerRecord && ownerRecord.features) {
                ownerFeatures = { ...ownerFeatures, ...parseJson(ownerRecord.features, {}) };
            }
            const bRes = await env.DB.prepare('SELECT * FROM buses WHERE owner_phone = ? ORDER BY name').bind(ownerPhone).all();
            busesRows = bRes.results || [];
            const bkRes = await env.DB.prepare(
                `SELECT b.*, bs.company_name, bs.gst_number, bs.ticket_terms, bs.emergency_phone, bs.time, bs.stoppage_timings
                 FROM bookings b
                 LEFT JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
                 WHERE bs.owner_phone = ? AND COALESCE(b.hidden_for_owner, 0) = 0
                 ORDER BY b.created_at DESC LIMIT 300`
            ).bind(ownerPhone).all();
            bookingRows = bkRes.results || [];
            const rRes = await env.DB.prepare(
                `SELECT r.* FROM reviews r
                 JOIN bookings b ON r.booking_id = b.id
                 JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
                 WHERE bs.owner_phone = ?
                 ORDER BY r.created_at DESC LIMIT 50`
            ).bind(ownerPhone).all();
            reviewRows = rRes.results || [];
        } else {
            const bRes = await env.DB.prepare('SELECT * FROM buses ORDER BY name').all();
            busesRows = bRes.results || [];
            const bkRes = await env.DB.prepare(
                `SELECT b.*, bs.company_name, bs.gst_number, bs.ticket_terms, bs.emergency_phone, bs.time, bs.stoppage_timings
                 FROM bookings b
                 LEFT JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
                 ORDER BY b.created_at DESC LIMIT 300`
            ).all();
            bookingRows = bkRes.results || [];
            const rRes = await env.DB.prepare('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 50').all();
            reviewRows = rRes.results || [];
        }

        // Active Subscription & Access Control Status for Owner
        let activeSubscription = null;
        let accessControl = { status: 'active' };
        if (ownerPhone) {
            try {
                activeSubscription = await env.DB.prepare(
                    "SELECT * FROM owner_subscriptions WHERE owner_phone = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
                ).bind(ownerPhone).first();
                const acl = await env.DB.prepare(
                    "SELECT status, reason FROM access_control_list WHERE phone = ?"
                ).bind(ownerPhone).first();
                if (acl) accessControl = acl;
            } catch (se) {
                console.warn('Subscription fetch notice:', se);
            }
        }

        return jsonResponse({
            buses: busesRows.map(mapBus),
            features: ownerFeatures,
            featureFlags: await getFeatureFlags(env.DB),
            subscription: activeSubscription || null,
            accessControl: accessControl,
            isSuspended: Boolean(accessControl && (accessControl.status === 'suspended' || accessControl.status === 'blocked' || accessControl.status === 'permanently_banned')),
            bookings: Object.fromEntries(bookingRows.map(r => [r.id, mapBooking(r, r)])),
            reviews: reviewRows.map(r => ({
                id: r.id,
                bookingId: r.booking_id,
                rating: r.rating,
                comment: r.comment,
                createdAt: r.created_at
            }))
        });
    }

    const serviceDateMatch = path.match(/^\/api\/owner\/buses\/([^/]+)\/service-date$/);
    if (serviceDateMatch) {
        const busId = decodeURIComponent(serviceDateMatch[1]);
        const date = url.searchParams.get('date');
        if (!date || !isValidJourneyDate(date)) return jsonError(400, 'A valid journey date is required.');
        const bus = await env.DB.prepare('SELECT id FROM buses WHERE id = ? AND owner_phone = ?').bind(busId, auth.identifier).first();
        if (!bus) return jsonError(404, 'Bus not found.');
        const service = await env.DB.prepare(
            'SELECT enabled FROM bus_service_dates WHERE bus_id = ? AND journey_date = ?'
        ).bind(busId, date).first();
        return jsonResponse({ enabled: service ? Boolean(service.enabled) : true });
    }

    // GET /api/admin/state
    if (path === '/api/admin/state') {
        await ensureEnterpriseSegmentTables(env.DB);
        const { results: busesRows } = await env.DB.prepare('SELECT * FROM buses ORDER BY name').all();
        const { results: bookingRows } = await env.DB.prepare(
            `SELECT b.*, bs.company_name, bs.gst_number, bs.ticket_terms, bs.emergency_phone, bs.time, bs.stoppage_timings
             FROM bookings b
             LEFT JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
             ORDER BY b.created_at DESC LIMIT 500`
        ).all();
        const { results: reviewRows } = await env.DB.prepare('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 100').all();
        const { results: couponRows } = await env.DB.prepare('SELECT * FROM coupons').all();
        const { results: serviceRows } = await env.DB.prepare(
            `SELECT bus_id AS busId, journey_date AS date, enabled
             FROM bus_service_dates ORDER BY journey_date DESC LIMIT 500`
        ).all();
        let subscriptionRows = [];
        let aclRows = [];
        let promotionRows = [];
        try {
            await ensurePromotionExtensionColumns(env.DB);
            const subRes = await env.DB.prepare('SELECT * FROM owner_subscriptions ORDER BY created_at DESC LIMIT 200').all();
            subscriptionRows = subRes.results || [];
            const aclRes = await env.DB.prepare('SELECT * FROM access_control_list ORDER BY updated_at DESC LIMIT 200').all();
            aclRows = aclRes.results || [];
            const promoRes = await env.DB.prepare('SELECT * FROM promotions ORDER BY created_at DESC LIMIT 50').all();
            promotionRows = (promoRes.results || []).map(r => ({
                ...r,
                media_type: r.media_type || detectPromoMediaType(r.image_url, ''),
                placement: r.placement || 'popup'
            }));
        } catch (subErr) {
            console.warn('Admin state auxiliary fetch notice:', subErr);
        }
        return jsonResponse({
            buses: auth.permissions.includes('fleet') || auth.permissions.includes('operators') || auth.permissions.includes('all')
                ? busesRows.map(mapBus) : [],
            subscriptions: subscriptionRows,
            accessControlList: aclRows,
            promotions: (auth.permissions.includes('settings') || auth.permissions.includes('all'))
                ? promotionRows : [],
            bookings: auth.permissions.includes('bookings') || auth.permissions.includes('all')
                ? Object.fromEntries(bookingRows.map(r => [r.id, mapBooking(r, r)])) : {},
            reviews: (auth.permissions.includes('bookings') || auth.permissions.includes('all')) ? reviewRows.map(r => ({
                id: r.id,
                bookingId: r.booking_id,
                passengerName: r.passenger_name || '',
                passengerPhone: r.passenger_phone || '',
                busId: r.bus_id || '',
                busName: r.bus_name || '',
                rating: r.rating,
                comment: r.comment,
                createdAt: r.created_at
            })) : [],
            coupons: auth.permissions.includes('settings') || auth.permissions.includes('all')
                ? couponRows.map(r => ({ code: r.code, discount: r.discount, active: Boolean(r.active) })) : [],
            serviceDates: auth.permissions.includes('fleet') || auth.permissions.includes('all')
                ? serviceRows.map(r => ({ ...r, enabled: Boolean(r.enabled) })) : [],
            featureFlags: auth.permissions.includes('settings') || auth.permissions.includes('all')
                ? await getFeatureFlags(env.DB) : {}
        });
    }

    if (path === '/api/customer/me') {
        await ensureCustomerPhotoColumns(env.DB);
        const customer = await env.DB.prepare(
            "SELECT phone, name, email, features, status, created_at, profile_photo, avatar_preference FROM customers WHERE phone = ?"
        ).bind(auth.identifier).first();
        if (!customer) return jsonError(404, 'Customer account not found.');
        if (customer.status !== 'active') {
            return jsonError(403, '⚠️ আপনার কাস্টমার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে। যোগাযোগ করুন: support.busyatra@gmail.com');
        }
        try {
            const custAcl = await env.DB.prepare('SELECT status, reason FROM access_control_list WHERE phone = ?').bind(auth.identifier).first();
            if (custAcl && (custAcl.status === 'suspended' || custAcl.status === 'blocked' || custAcl.status === 'permanently_banned')) {
                return jsonError(403, `⚠️ আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে। ${custAcl.reason ? 'কারণ: ' + custAcl.reason : 'যোগাযোগ করুন: support.busyatra@gmail.com'}`);
            }
        } catch (ce) {}

        const defaultCustomerFeatures = {
            offline_tickets: false,
            referral_rewards: false,
            voice_search: false,
            parcel_booking: false,
            meal_preorder: false,
            women_safety: false,
            whatsapp_booking: false,
            bluetooth_offline: false,
            ncmc_smart_card: false,
            agent_portal: false
        };
        const customerFeatures = { ...defaultCustomerFeatures, ...parseJson(customer.features, {}) };

        return jsonResponse({
            customer: {
                phone: customer.phone,
                name: customer.name,
                email: customer.email || '',
                profilePhoto: customer.profile_photo || '',
                avatarPreference: customer.avatar_preference || 'auto',
                created_at: customer.created_at,
                features: customerFeatures
            }
        });
    }

    // GET /api/captain/me (Verify active captain session)
    if (path === '/api/captain/me') {
        if (!auth || auth.role !== 'captain' || !auth.busId) {
            return jsonError(401, 'Valid captain session required.');
        }
        const bus = await env.DB.prepare('SELECT id, name, bus_number, company_name, driver_name, driver_phone FROM buses WHERE id = ?').bind(auth.busId).first();
        if (!bus) return jsonError(404, 'Assigned bus not found.');

        return jsonResponse({
            ok: true,
            captain: {
                id: bus.id,
                name: bus.driver_name || `${bus.name} Captain`,
                phone: auth.identifier,
                busId: bus.id,
                busName: bus.name,
                busNumber: bus.bus_number,
                companyName: bus.company_name || `${bus.name} Travels`
            }
        });
    }

    // GET /api/owner/me (Verify active owner session)
    if (path === '/api/owner/me') {
        if (!auth || auth.role !== 'owner') {
            return jsonError(401, 'Valid owner session required.');
        }
        let owner = await env.DB.prepare('SELECT phone, name, email, company_name, bus_number FROM owners WHERE phone = ?').bind(auth.identifier).first();
        if (!owner) {
            const bus = await env.DB.prepare('SELECT owner_phone, owner_name, company_name, bus_number, name FROM buses WHERE owner_phone = ?').bind(auth.identifier).first();
            if (bus) {
                owner = {
                    phone: bus.owner_phone,
                    name: bus.owner_name || bus.name,
                    email: '',
                    company_name: bus.company_name || bus.name,
                    bus_number: bus.bus_number
                };
            }
        }
        if (!owner) return jsonError(404, 'Owner not found.');

        return jsonResponse({
            ok: true,
            owner: {
                phone: owner.phone,
                name: owner.name,
                email: owner.email || '',
                companyName: owner.company_name || `${owner.name} Travels`,
                busNumber: owner.bus_number || ''
            }
        });
    }

    // GET /api/captain/state
    if (path === '/api/captain/state') {
        await ensureEnterpriseSegmentTables(env.DB);
        const busId = auth.busId;
        if (!busId) return jsonError(403, 'No bus is assigned to this captain account.');
        const bus = await env.DB.prepare('SELECT * FROM buses WHERE id = ?').bind(busId).first();
        if (!bus) return jsonError(404, 'Assigned bus not found.');

        // Enforce owner suspension on captain
        if (bus.owner_phone) {
            try {
                const ownerAcl = await env.DB.prepare('SELECT status, reason FROM access_control_list WHERE phone = ?').bind(bus.owner_phone).first();
                if (ownerAcl && (ownerAcl.status === 'suspended' || ownerAcl.status === 'blocked' || ownerAcl.status === 'permanently_banned')) {
                    return jsonError(403, '⚠️ আপনার বাস মালিকের অ্যাকাউন্টটি সাময়িকভাবে স্থগিত থাকায় সার্ভিস বন্ধ রয়েছে।');
                }
            } catch (ce) {}
        }
        if (auth.identifier) {
            try {
                const captAcl = await env.DB.prepare('SELECT status, reason FROM access_control_list WHERE phone = ?').bind(auth.identifier).first();
                if (captAcl && (captAcl.status === 'suspended' || captAcl.status === 'blocked' || captAcl.status === 'permanently_banned')) {
                    return jsonError(403, '⚠️ আপনার ক্যাপ্টেন অ্যাকাউন্টটি সাময়িকভাবে স্থগিত রয়েছে।');
                }
            } catch (ce) {}
        }
        const busesRows = [bus];
        const { results: bookingRows } = await env.DB.prepare(
            `SELECT b.*, bs.company_name, bs.gst_number, bs.ticket_terms, bs.emergency_phone, bs.time
             FROM bookings b
             LEFT JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
             WHERE (b.bus_id = ? OR b.bus_id = ?) AND COALESCE(b.hidden_for_captain, 0) = 0
             ORDER BY b.created_at DESC LIMIT 300`
        ).bind(bus.id, bus.id + '_RETURN').all();
        const defaultCaptainFeatures = {
            qr_scanner: true,
            offline_validation: true,
            cash_collection: true,
            gps_broadcast: true,
            passenger_manifest: true,
            driver_safety_alerts: true
        };
        let captainFeatures = { ...defaultCaptainFeatures };
        try {
            const pc = await env.DB.prepare("SELECT features FROM portal_credentials WHERE role = 'captain' AND identifier = ?").bind(auth.identifier).first();
            if (pc && pc.features) {
                captainFeatures = { ...defaultCaptainFeatures, ...parseJson(pc.features, {}) };
            }
        } catch (_) {}

        return jsonResponse({
            buses: busesRows.map(mapBus),
            featureFlags: await getFeatureFlags(env.DB),
            features: captainFeatures,
            bookings: Object.fromEntries(bookingRows.map(r => [r.id, mapBooking(r, r)]))
        });
    }

    // GET /api/owner/captains
    if (path === '/api/owner/captains') {
        const { results } = await env.DB.prepare(
            `SELECT b.id, b.id AS bus_id, b.driver_name AS name, b.driver_phone AS phone,
                    COALESCE(pc.active, 1) AS active, b.name AS bus_name, b.bus_number, b.owner_phone, b.owner_name
             FROM buses b
             JOIN portal_credentials pc
               ON pc.role = 'captain' AND pc.identifier = b.driver_phone AND pc.bus_id = b.id
             WHERE b.owner_phone = ? AND b.driver_phone != ''
             ORDER BY b.name`
        ).bind(auth.identifier).all();
        return jsonResponse({ captains: results });
    }

    // GET /api/admin/customers
    if (path === '/api/admin/customers') {
        await ensureCustomerPhotoColumns(env.DB);
        const q = (url.searchParams.get('query') || '').trim().toLowerCase();
        let sql = `SELECT c.phone, c.name, c.email, c.pin, c.security_question, c.security_answer,
                          c.profile_photo, c.avatar_preference,
                          COALESCE(acl.status, c.status, 'active') AS status,
                          acl.reason AS acl_reason,
                          c.features, c.pin_requested_at, c.created_at, c.updated_at,
                          uld.device_type, uld.device_brand, uld.device_model, uld.os AS device_os,
                          uld.browser AS device_browser, uld.city AS device_city, uld.ip_address AS device_ip,
                          uld.last_login_at AS device_last_login
                   FROM customers c
                   LEFT JOIN access_control_list acl ON acl.phone = c.phone
                   LEFT JOIN user_login_devices uld ON uld.role = 'customer' AND uld.identifier = c.phone`;
        let params = [];
        if (q) {
            sql += ' WHERE (c.phone LIKE ? OR LOWER(c.name) LIKE ? OR c.email LIKE ?)';
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        sql += ' ORDER BY (CASE WHEN c.pin_requested_at IS NOT NULL THEN 0 ELSE 1 END), c.created_at DESC LIMIT 250';
        const { results } = await env.DB.prepare(sql).bind(...params).all();
        const defaultCustomerFeatures = {
            offline_tickets: false,
            referral_rewards: false,
            voice_search: false,
            parcel_booking: false,
            meal_preorder: false,
            women_safety: false,
            whatsapp_booking: false,
            bluetooth_offline: false,
            ncmc_smart_card: false,
            agent_portal: false
        };
        const customers = (results || []).map(c => ({
            ...c,
            profilePhoto: c.profile_photo || '',
            avatarPreference: c.avatar_preference || 'auto',
            last_device: c.device_brand ? {
                deviceType: c.device_type,
                deviceBrand: c.device_brand,
                deviceModel: c.device_model,
                os: c.device_os,
                browser: c.device_browser,
                city: c.device_city,
                ipAddress: c.device_ip,
                lastLoginAt: c.device_last_login
            } : null,
            features: { ...defaultCustomerFeatures, ...parseJson(c.features, {}) }
        }));
        return jsonResponse({ customers });
    }

    // GET /api/admin/captains
    if (path === '/api/admin/captains') {
        const { results } = await env.DB.prepare(
            `SELECT COALESCE(cpt.id, b.id) AS id,
                    b.id AS bus_id,
                    COALESCE(cpt.name, NULLIF(b.driver_name, ''), 'Captain') AS name,
                    COALESCE(cpt.phone, b.driver_phone) AS phone,
                    COALESCE(cpt.pin, '') AS pin,
                    COALESCE(acl.status, CASE WHEN pc.active = 0 OR cpt.active = 0 THEN 'suspended' ELSE 'active' END) AS status,
                    acl.reason AS acl_reason,
                    COALESCE(cpt.active, pc.active, 1) AS active, pc.features,
                    COALESCE(b.name, 'Bus Yatra') AS bus_name,
                    COALESCE(b.bus_number, '') AS bus_number,
                    b.owner_phone, b.owner_name,
                    uld.device_type, uld.device_brand, uld.device_model, uld.os AS device_os,
                    uld.browser AS device_browser, uld.city AS device_city, uld.ip_address AS device_ip,
                    uld.last_login_at AS device_last_login
             FROM buses b
             LEFT JOIN captains cpt ON (cpt.phone = b.driver_phone OR cpt.bus_id = b.id)
             LEFT JOIN portal_credentials pc
               ON pc.role = 'captain' AND pc.identifier = COALESCE(cpt.phone, b.driver_phone)
             LEFT JOIN access_control_list acl ON acl.phone = COALESCE(cpt.phone, b.driver_phone)
             LEFT JOIN user_login_devices uld ON uld.role = 'captain' AND uld.identifier = COALESCE(cpt.phone, b.driver_phone)
             WHERE (b.driver_phone != '' OR cpt.phone IS NOT NULL)
             ORDER BY b.name`
        ).all();
        const defaultCaptainFeatures = {
            qr_scanner: true,
            offline_validation: true,
            cash_collection: true,
            gps_broadcast: true,
            passenger_manifest: true,
            driver_safety_alerts: true
        };
        const captains = (results || []).map(c => ({
            ...c,
            last_device: c.device_brand ? {
                deviceType: c.device_type,
                deviceBrand: c.device_brand,
                deviceModel: c.device_model,
                os: c.device_os,
                browser: c.device_browser,
                city: c.device_city,
                ipAddress: c.device_ip,
                lastLoginAt: c.device_last_login
            } : null,
            features: { ...defaultCaptainFeatures, ...parseJson(c.features, {}) }
        }));
        return jsonResponse({ captains });
    }

    // GET /api/admin/owners
    if (path === '/api/admin/owners') {
        const { results } = await env.DB.prepare(
            `SELECT o.phone, o.name, o.email, o.pin, o.company_name, o.bus_number, o.license_doc,
                    o.security_question, COALESCE(acl.status, o.status, 'active') AS status,
                    acl.reason AS acl_reason,
                    o.created_at, o.features,
                    COUNT(b.id) AS bus_count,
                    uld.device_type, uld.device_brand, uld.device_model, uld.os AS device_os,
                    uld.browser AS device_browser, uld.city AS device_city, uld.ip_address AS device_ip,
                    uld.last_login_at AS device_last_login
             FROM owners o
             LEFT JOIN access_control_list acl ON acl.phone = o.phone
             LEFT JOIN buses b ON b.owner_phone = o.phone
             LEFT JOIN user_login_devices uld ON uld.role = 'owner' AND uld.identifier = o.phone
             GROUP BY o.phone
             ORDER BY o.name`
        ).all();
        const defaultOwnerFeatures = {
            auto_pilot: true,
            notifications: true,
            captains: true,
            finance: true,
            live_tracking: true,
            edit_bus: true,
            parcel_booking: true,
            monthly_pass: true,
            dynamic_ai_pricing: true,
            instant_payout: true,
            cargo_tracking: true,
            driver_safety_score: true
        };
        const owners = (results || []).map(o => ({
            ...o,
            last_device: o.device_brand ? {
                deviceType: o.device_type,
                deviceBrand: o.device_brand,
                deviceModel: o.device_model,
                os: o.device_os,
                browser: o.device_browser,
                city: o.device_city,
                ipAddress: o.device_ip,
                lastLoginAt: o.device_last_login
            } : null,
            features: { ...defaultOwnerFeatures, ...parseJson(o.features, {}) }
        }));
        return jsonResponse({ owners });
    }

    // GET /api/admin/email-recipients
    if (path === '/api/admin/email-recipients') {
        const { results: custs } = await env.DB.prepare(`
            SELECT DISTINCT email, name, phone FROM customers WHERE email IS NOT NULL AND email LIKE '%@%' ORDER BY name
        `).all();
        const { results: owns } = await env.DB.prepare(`
            SELECT DISTINCT email, owner_name AS name, owner_phone AS phone, company_name FROM owners WHERE email IS NOT NULL AND email LIKE '%@%' ORDER BY owner_name
        `).all();

        const customers = (custs || []).map(c => ({ email: c.email.trim(), name: c.name || '', phone: c.phone || '', role: 'customer' }));
        const owners = (owns || []).map(o => ({ email: o.email.trim(), name: o.name || o.company_name || '', phone: o.phone || '', role: 'owner' }));

        return jsonResponse({
            customers,
            owners,
            totalCustomers: customers.length,
            totalOwners: owners.length,
            totalDistinct: Array.from(new Set([...customers.map(c => c.email.toLowerCase()), ...owners.map(o => o.email.toLowerCase())])).length
        });
    }

    // GET /api/admin/devices (Real-Time Device & Security Monitoring + Site Visits & App Installs)
    if (path === '/api/admin/devices') {
        await ensureClientAnalyticsTable(env.DB);
        const role = (url.searchParams.get('role') || 'all').toLowerCase();
        const q = (url.searchParams.get('query') || '').trim().toLowerCase();
        const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get('limit') || '100', 10)));
        const analyticsStatus = (url.searchParams.get('analyticsStatus') || 'all').toLowerCase();
        const analyticsPortal = (url.searchParams.get('analyticsPortal') || 'all').toLowerCase();

        let sql = `SELECT * FROM user_login_devices`;
        let conditions = [];
        let params = [];

        if (role !== 'all') {
            conditions.push(`role = ?`);
            params.push(role);
        }
        if (q) {
            conditions.push(`(LOWER(identifier) LIKE ? OR LOWER(user_name) LIKE ? OR LOWER(device_brand) LIKE ? OR LOWER(device_model) LIKE ? OR LOWER(os) LIKE ? OR LOWER(city) LIKE ?)`);
            params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
        }
        if (conditions.length > 0) {
            sql += ` WHERE ` + conditions.join(' AND ');
        }
        sql += ` ORDER BY last_login_at DESC LIMIT ?`;
        params.push(limit);

        const { results: devices } = await env.DB.prepare(sql).bind(...params).all();

        // Recent 30 login events
        const { results: recentLogs } = await env.DB.prepare(`
            SELECT * FROM user_login_logs ORDER BY created_at DESC LIMIT 30
        `).all();

        // Real-Time Stats
        const totalDevRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM user_login_devices').first();
        const mobileDevRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM user_login_devices WHERE device_type = 'Mobile'").first();
        const desktopDevRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM user_login_devices WHERE device_type = 'Desktop'").first();
        const { results: topBrands } = await env.DB.prepare(`
            SELECT device_brand, COUNT(*) AS count
            FROM user_login_devices
            WHERE device_brand != 'Unknown' AND device_brand != ''
            GROUP BY device_brand
            ORDER BY count DESC
            LIMIT 5
        `).all();

        const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const activeTodayRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM user_login_devices WHERE last_login_at >= ?').bind(oneDayAgo).first();

        // Client Traffic, App Install & Uninstall Analytics
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
        let cdaSql = `SELECT * FROM client_device_analytics`;
        const cdaConds = [];
        const cdaParams = [];
        if (analyticsPortal !== 'all' && ['customer', 'owner', 'captain', 'admin'].includes(analyticsPortal)) {
            cdaConds.push('portal = ?');
            cdaParams.push(analyticsPortal);
        }
        if (analyticsStatus === 'inactive') {
            cdaConds.push("install_status = 'installed' AND COALESCE(last_standalone_at, installed_at, last_seen_at) < ?");
            cdaParams.push(fourteenDaysAgo);
        } else if (['web_only', 'installed', 'uninstalled'].includes(analyticsStatus)) {
            cdaConds.push('install_status = ?');
            cdaParams.push(analyticsStatus);
        }
        if (q) {
            cdaConds.push('(LOWER(device_brand) LIKE ? OR LOWER(device_model) LIKE ? OR LOWER(os) LIKE ? OR LOWER(browser) LIKE ? OR LOWER(city) LIKE ? OR LOWER(portal) LIKE ? OR LOWER(user_identifier) LIKE ? OR LOWER(ip_address) LIKE ?)');
            cdaParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
        }
        if (cdaConds.length > 0) cdaSql += ' WHERE ' + cdaConds.join(' AND ');
        cdaSql += ' ORDER BY last_seen_at DESC LIMIT 150';
        const { results: clientAnalytics } = await env.DB.prepare(cdaSql).bind(...cdaParams).all();

        const [
            uniqueVisitorsRow,
            totalVisitsRow,
            todayVisitorsRow,
            installedTotalRow,
            mobileInstalledRow,
            desktopInstalledRow,
            activeAppRow,
            inactiveAppRow,
            uninstalledTotalRow,
            portalBreakdownRes
        ] = await Promise.all([
            env.DB.prepare('SELECT COUNT(DISTINCT device_uid) AS total FROM client_device_analytics').first(),
            env.DB.prepare('SELECT COALESCE(SUM(visit_count), 0) AS total FROM client_device_analytics').first(),
            env.DB.prepare('SELECT COUNT(DISTINCT device_uid) AS total FROM client_device_analytics WHERE last_seen_at >= ?').bind(oneDayAgo).first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM client_device_analytics WHERE install_status = 'installed'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM client_device_analytics WHERE install_status = 'installed' AND device_type IN ('Mobile', 'Tablet')").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM client_device_analytics WHERE install_status = 'installed' AND device_type = 'Desktop'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM client_device_analytics WHERE install_status = 'installed' AND COALESCE(last_standalone_at, installed_at, last_seen_at) >= ?").bind(fourteenDaysAgo).first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM client_device_analytics WHERE install_status = 'installed' AND COALESCE(last_standalone_at, installed_at, last_seen_at) < ?").bind(fourteenDaysAgo).first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM client_device_analytics WHERE install_status = 'uninstalled'").first(),
            env.DB.prepare("SELECT portal, COUNT(*) AS visitors, COALESCE(SUM(visit_count), 0) AS visits, SUM(CASE WHEN install_status = 'installed' THEN 1 ELSE 0 END) AS installs, SUM(CASE WHEN install_status = 'uninstalled' THEN 1 ELSE 0 END) AS uninstalls FROM client_device_analytics GROUP BY portal").all()
        ]);

        return jsonResponse({
            devices: devices || [],
            recentLogs: recentLogs || [],
            stats: {
                totalDevices: totalDevRow?.total || 0,
                mobileDevices: mobileDevRow?.total || 0,
                desktopDevices: desktopDevRow?.total || 0,
                topBrands: topBrands || [],
                activeToday: activeTodayRow?.total || 0
            },
            clientAnalytics: clientAnalytics || [],
            analyticsStats: {
                uniqueVisitors: uniqueVisitorsRow?.total || 0,
                totalVisits: totalVisitsRow?.total || 0,
                todayVisitors: todayVisitorsRow?.total || 0,
                installedTotal: installedTotalRow?.total || 0,
                mobileInstalled: mobileInstalledRow?.total || 0,
                desktopInstalled: desktopInstalledRow?.total || 0,
                activeApp14d: activeAppRow?.total || 0,
                inactiveApp14d: inactiveAppRow?.total || 0,
                uninstalledTotal: uninstalledTotalRow?.total || 0,
                portalBreakdown: portalBreakdownRes?.results || []
            }
        });
    }

    if (path === '/api/admin/owner-requests') {
        const { results } = await env.DB.prepare(
            `SELECT id, company_name, owner_name, bus_number, owner_phone, email,
                    license_doc, pin, security_question, status, created_at
             FROM owner_requests WHERE status = 'pending' ORDER BY created_at DESC`
        ).all();
        const requests = (results || []).map(r => ({
            id: r.id,
            company_name: r.company_name,
            name: r.owner_name,
            owner_name: r.owner_name,
            phone: r.owner_phone,
            owner_phone: r.owner_phone,
            email: r.email || '',
            bus_number: r.bus_number,
            license_data: r.license_doc,
            license_doc: r.license_doc,
            license_file_name: 'license_' + r.owner_phone + '.png',
            license_mime_type: 'image/png',
            route: 'Pingla - Kolkata',
            departure_time: '06:00 AM',
            fare: 399,
            pin: r.pin,
            security_question: r.security_question,
            status: r.status,
            created_at: r.created_at
        }));
        return jsonResponse({ requests });
    }

    if (path === '/api/admin/finance') {
        const { results } = await env.DB.prepare(
            `SELECT f.*, b.passenger_name, b.passenger_phone, b.journey_date, b.status AS booking_status,
                    b.seats, b.bus_name, b.bus_number
             FROM booking_financials f
             JOIN bookings b ON b.id = f.booking_id
             ORDER BY f.updated_at DESC LIMIT 500`
        ).all();
        return jsonResponse({ entries: results });
    }

    if (path === '/api/admin/operator-finance') {
        const { results } = await env.DB.prepare(
            `SELECT b.owner_phone, MAX(b.owner_name) AS owner_name,
                    MAX(b.company_name) AS company_name, COUNT(DISTINCT b.id) AS bus_count,
                    COALESCE(s.commission_mode, 'percentage') AS commission_mode,
                    COALESCE(s.commission_value, 0) AS commission_value
             FROM buses b
             LEFT JOIN operator_financial_settings s ON s.owner_phone = b.owner_phone
             GROUP BY b.owner_phone ORDER BY owner_name`
        ).all();
        return jsonResponse({ operators: results });
    }

    if (path === '/api/admin/reports') {
        const summary = await env.DB.prepare(
            `SELECT COUNT(*) AS booking_count,
                    COALESCE(SUM(CASE WHEN payment_status IN ('received', 'settled') THEN amount ELSE 0 END), 0) AS received_amount,
                    COALESCE(SUM(CASE WHEN payment_status = 'refunded' THEN amount ELSE 0 END), 0) AS refunded_amount,
                    COALESCE(SUM(CASE WHEN payment_status = 'settled' THEN commission_amount ELSE 0 END), 0) AS commission_amount,
                    COALESCE(SUM(CASE WHEN payment_status = 'settled' THEN operator_amount ELSE 0 END), 0) AS operator_settled_amount
             FROM booking_financials`
        ).first();
        const { results } = await env.DB.prepare(
            `SELECT company_name, owner_phone,
                    COUNT(*) AS booking_count,
                    SUM(CASE WHEN payment_status IN ('received', 'settled') THEN amount ELSE 0 END) AS received_amount,
                    SUM(CASE WHEN payment_status = 'refunded' THEN amount ELSE 0 END) AS refunded_amount,
                    SUM(CASE WHEN payment_status = 'settled' THEN commission_amount ELSE 0 END) AS commission_amount,
                    SUM(CASE WHEN payment_status = 'settled' THEN operator_amount ELSE 0 END) AS operator_settled_amount
             FROM booking_financials GROUP BY owner_phone, company_name ORDER BY company_name`
        ).all();
        return jsonResponse({ summary, operators: results });
    }

    if (path === '/api/admin/replica-status') {
        const [queue, state, backfill] = await Promise.all([
            env.DB.prepare(
                `SELECT COUNT(*) AS pending_count,
                        SUM(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END) AS failed_count,
                        MIN(created_at) AS oldest_pending_at
                 FROM firebase_replica_outbox`
            ).first(),
            env.DB.prepare(
                'SELECT last_success_at, last_error FROM firebase_replica_state WHERE id = 1'
            ).first(),
            env.DB.prepare(
                'SELECT table_index, complete FROM firebase_replica_backfill WHERE id = 1'
            ).first()
        ]);
        const configured = Boolean(
            env.FIREBASE_PROJECT_ID && env.FIREBASE_SERVICE_ACCOUNT_EMAIL &&
            env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY
        );
        return jsonResponse({
            configured,
            pendingCount: queue.pending_count || 0,
            failedCount: queue.failed_count || 0,
            oldestPendingAt: queue.oldest_pending_at || null,
            lastSuccessAt: state && state.last_success_at,
            lastError: state && state.last_error,
            backfillComplete: Boolean(backfill && backfill.complete),
            backfillTableIndex: backfill ? backfill.table_index : 0
        });
    }

    if (path === '/api/admin/users') {
        const { results } = await env.DB.prepare(
            'SELECT phone, name, permissions, active, created_at, created_by, updated_at FROM admin_users ORDER BY name'
        ).all();
        return jsonResponse({ users: results.map(user => ({
            ...user,
            permissions: parseJson(user.permissions, [])
        })) });
    }

    if (path === '/api/admin/audit') {
        const { results } = await env.DB.prepare(
            'SELECT id, actor_identifier, action, target, details, created_at FROM admin_audit_log ORDER BY id DESC LIMIT 300'
        ).all();
        return jsonResponse({ entries: results.map(entry => ({
            ...entry,
            details: parseJson(entry.details, {})
        })) });
    }

    // GET /api/admin/notifications
    if (path === '/api/admin/notifications') {
        const { results } = await env.DB.prepare(
            "SELECT * FROM notifications WHERE sender_role = 'admin' ORDER BY created_at DESC LIMIT 200"
        ).all();
        return jsonResponse({ ok: true, notifications: results || [] });
    }

    // GET /api/owner/notifications
    if (path === '/api/owner/notifications') {
        const ownerPhone = auth?.identifier;
        if (!ownerPhone) return jsonError(401, 'Owner authentication required.');
        const sent = await env.DB.prepare(
            "SELECT * FROM notifications WHERE sender_role = 'owner' AND owner_phone = ? ORDER BY created_at DESC LIMIT 200"
        ).bind(ownerPhone).all();
        const received = await env.DB.prepare(
            "SELECT * FROM notifications WHERE sender_role = 'admin' AND status = 'active' AND (target_group = 'owners' OR target_group = 'all') ORDER BY created_at DESC LIMIT 100"
        ).all();
        return jsonResponse({ ok: true, sent: sent.results || [], received: received.results || [] });
    }

    // GET /api/captain/notifications
    if (path === '/api/captain/notifications') {
        const captainPhone = auth?.identifier;
        if (!captainPhone) return jsonError(401, 'Captain authentication required.');
        const captain = await env.DB.prepare("SELECT bus_id FROM captains WHERE phone = ?").bind(captainPhone).first();
        const busId = captain ? captain.bus_id : auth.busId;
        let ownerPhone = '';
        if (busId) {
            const b = await env.DB.prepare("SELECT owner_phone FROM buses WHERE id = ?").bind(busId).first();
            if (b) ownerPhone = b.owner_phone;
        }
        let query = "SELECT * FROM notifications WHERE status = 'active' AND ( (sender_role = 'admin' AND target_group = 'all') ";
        const params = [];
        if (ownerPhone) {
            query += " OR (sender_role = 'owner' AND owner_phone = ? AND target_group IN ('captains', 'both')) ";
            params.push(ownerPhone);
        }
        query += ") ORDER BY created_at DESC LIMIT 100";
        const stmt = env.DB.prepare(query);
        const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
        return jsonResponse({ ok: true, notifications: results || [] });
    }

    // GET /api/customer/notifications
    if (path === '/api/customer/notifications') {
        const customerPhone = (auth && auth.role === 'customer' ? auth.identifier : url.searchParams.get('phone') || request.headers.get('x-customer-phone') || '').trim();
        let bookedOwners = [];
        if (customerPhone) {
            const bookings = await env.DB.prepare(
                "SELECT DISTINCT bus_id FROM bookings WHERE passenger_phone = ?"
            ).bind(customerPhone).all();
            if (bookings.results && bookings.results.length) {
                const busIds = bookings.results.map(r => r.bus_id).filter(Boolean);
                if (busIds.length) {
                    const placeholders = busIds.map(() => '?').join(',');
                    const ownersRes = await env.DB.prepare(
                        `SELECT DISTINCT owner_phone FROM buses WHERE id IN (${placeholders})`
                    ).bind(...busIds).all();
                    if (ownersRes.results) {
                        bookedOwners = ownersRes.results.map(r => r.owner_phone).filter(Boolean);
                    }
                }
            }
        }

        let query = "SELECT * FROM notifications WHERE status = 'active' AND ( (sender_role = 'admin' AND target_group IN ('customers', 'all'))";
        const params = [];
        if (bookedOwners.length > 0) {
            const ownerPlaceholders = bookedOwners.map(() => '?').join(',');
            query += ` OR (sender_role = 'owner' AND target_group IN ('booked_customers', 'both') AND owner_phone IN (${ownerPlaceholders}))`;
            params.push(...bookedOwners);
        }
        query += " ) ORDER BY created_at DESC LIMIT 100";
        const stmt = env.DB.prepare(query);
        const { results } = params.length ? await stmt.bind(...params).all() : await stmt.all();
        return jsonResponse({ ok: true, notifications: results || [] });
    }

    // GET /api/admin/promotions
    if (path === '/api/admin/promotions') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensurePromotionExtensionColumns(env.DB);
        const [promoRes, flags] = await Promise.all([
            env.DB.prepare('SELECT * FROM promotions ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC').all(),
            getFeatureFlags(env.DB)
        ]);
        const promotions = (promoRes.results || []).map(r => ({
            ...r,
            media_type: r.media_type || detectPromoMediaType(r.image_url, ''),
            placement: r.placement || 'popup'
        }));
        return jsonResponse({
            ok: true,
            promotions,
            searchBannerAdsEnabled: flags.searchBannerAds !== false
        });
    }

    // GET /api/admin/subscriptions
    if (path === '/api/admin/subscriptions') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const subs = (await env.DB.prepare(`
            SELECT s.*, o.name as owner_name_db, o.company_name, o.bus_number
            FROM owner_subscriptions s
            LEFT JOIN owners o ON s.owner_phone = o.phone
            ORDER BY s.created_at DESC LIMIT 200
        `).all()).results || [];

        const acl = (await env.DB.prepare(`
            SELECT * FROM access_control_list ORDER BY updated_at DESC
        `).all()).results || [];

        return jsonResponse({ ok: true, subscriptions: subs, accessControlList: acl });
    }

    // GET /api/owner/subscription-status
    if (path === '/api/owner/subscription-status') {
        const ownerPhone = auth?.identifier || url.searchParams.get('phone') || '';
        if (!ownerPhone) return jsonError(400, 'Owner phone required.');

        const activeSub = await env.DB.prepare(`
            SELECT * FROM owner_subscriptions 
            WHERE owner_phone = ? AND status = 'pending' 
            ORDER BY created_at DESC LIMIT 1
        `).bind(ownerPhone).first();

        const acl = await env.DB.prepare(`
            SELECT status, reason FROM access_control_list WHERE phone = ?
        `).bind(ownerPhone).first();

        return jsonResponse({
            ok: true,
            hasDue: Boolean(activeSub),
            subscription: activeSub || null,
            isSuspended: Boolean(acl && (acl.status === 'suspended' || acl.status === 'blocked' || acl.status === 'permanently_banned')),
            accessControl: acl || { status: 'active' }
        });
    }

    // GET /api/support/tickets (Authenticated/token-protected customer support ticket lookup)
    if (path === '/api/support/tickets') {
        const ticketNumber = (url.searchParams.get('ticketNumber') || '').trim();
        const phone = (url.searchParams.get('phone') || '').trim();
        const ticketToken = (url.searchParams.get('ticketToken') || request.headers.get('x-ticket-token') || '').trim();
        const isAdminViewer = auth?.role === 'admin';
        const authCustPhone = auth?.role === 'customer' ? auth.identifier : '';

        const sanitizeTicketOut = (t) => {
            if (!t) return null;
            const { ticket_secret, ...safe } = t;
            return {
                ...safe,
                messages: parseJson(t.messages, [])
            };
        };

        if (ticketNumber) {
            const ticket = await env.DB.prepare('SELECT * FROM support_tickets WHERE ticket_number = ?').bind(ticketNumber).first();
            if (ticket) {
                const ownerMatch = Boolean(ticket.customer_phone && authCustPhone && authCustPhone === ticket.customer_phone);
                const tokenMatch = Boolean(ticket.ticket_secret && ticketToken && constantTimeEqual(ticketToken, ticket.ticket_secret));
                const legacyAnonymous = Boolean(!ticket.ticket_secret && !ticket.customer_phone);
                if (!isAdminViewer && !ownerMatch && !tokenMatch && !legacyAnonymous) {
                    return jsonError(403, 'Unauthorized to access this support ticket.');
                }
                return jsonResponse({
                    ok: true,
                    ticket: sanitizeTicketOut(ticket)
                });
            }
        }
        if (phone && !ticketNumber) {
            if (!isAdminViewer && authCustPhone !== phone) {
                return jsonError(401, 'সাপোর্ট হিস্ট্রি দেখতে অনুগ্রহ করে লগইন করুন। (Please sign in to view support tickets.)');
            }
            const ticket = await env.DB.prepare('SELECT * FROM support_tickets WHERE customer_phone = ? ORDER BY updated_at DESC LIMIT 1').bind(phone).first();
            if (ticket) {
                return jsonResponse({
                    ok: true,
                    ticket: sanitizeTicketOut(ticket)
                });
            }
        }
        return jsonResponse({ ok: true, ticket: null });
    }

    // GET /api/admin/support/tickets (Admin list all support tickets)
    if (path === '/api/admin/support/tickets') {
        const statusFilter = (url.searchParams.get('status') || 'all').trim();
        const search = (url.searchParams.get('search') || '').trim().toLowerCase();

        let query = 'SELECT * FROM support_tickets';
        const conditions = [];
        const params = [];

        if (statusFilter && statusFilter !== 'all') {
            conditions.push('status = ?');
            params.push(statusFilter);
        }
        if (search) {
            conditions.push('(ticket_number LIKE ? OR customer_phone LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(subject) LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY CASE WHEN status = "Open" THEN 0 WHEN status = "In Progress" THEN 1 ELSE 2 END, updated_at DESC LIMIT 100';

        const { results } = await env.DB.prepare(query).bind(...params).all();
        const tickets = (results || []).map(t => ({
            ...t,
            messages: parseJson(t.messages, [])
        }));

        // Get counts
        const pendingCountRow = await env.DB.prepare(
            "SELECT COUNT(*) AS total FROM support_tickets WHERE status = 'Open' OR status = 'In Progress'"
        ).first();

        const openCountRow = await env.DB.prepare(
            "SELECT COUNT(*) AS total FROM support_tickets WHERE status = 'Open'"
        ).first();

        return jsonResponse({
            ok: true,
            tickets,
            totalPending: (pendingCountRow && pendingCountRow.total) || 0,
            openCount: (openCountRow && openCountRow.total) || 0
        });
    }

    // GET /api/admin/support/tickets/:id
    const singleTicketMatch = path.match(/^\/api\/admin\/support\/tickets\/([^/]+)$/);
    if (singleTicketMatch) {
        const ticketId = singleTicketMatch[1];
        const ticket = await env.DB.prepare('SELECT * FROM support_tickets WHERE id = ? OR ticket_number = ?').bind(ticketId, ticketId).first();
        if (!ticket) return jsonError(404, 'Ticket not found.');
        return jsonResponse({
            ok: true,
            ticket: {
                ...ticket,
                messages: parseJson(ticket.messages, [])
            }
        });
    }

    // GET /api/emergency/sos/:id/webrtc-answer?token=...&nonce=... (Customer polls Admin SDP answer)
    const sosWebrtcAnsMatch = path.match(/^\/api\/emergency\/sos\/([^/]+)\/webrtc-answer$/);
    if (sosWebrtcAnsMatch) {
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(sosWebrtcAnsMatch[1]);
        const token = String(url.searchParams.get('token') || request.headers.get('X-Sos-Camera-Token') || '').trim();
        const clientNonce = String(url.searchParams.get('nonce') || '').trim();
        if (!token) return jsonError(403, 'Camera session token required.');

        const sos = await env.DB.prepare(
            `SELECT id, status, camera_consent, camera_active, camera_expires_at, camera_session_token,
                    webrtc_answer, webrtc_answer_ice, webrtc_session_nonce, webrtc_renegotiate
             FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?`
        ).bind(alertId, alertId).first();
        if (!sos || !sos.camera_session_token || sos.camera_session_token !== token) {
            return jsonError(403, 'Invalid or expired SOS camera session token.');
        }

        const nowIso = new Date().toISOString();
        const isExpired = Boolean(sos.camera_expires_at && sos.camera_expires_at <= nowIso);
        if (sos.status !== 'Active' || !sos.camera_consent || !sos.camera_active || isExpired) {
            return jsonResponse({ ok: false, stopped: true });
        }

        let iceList = [];
        try { iceList = JSON.parse(sos.webrtc_answer_ice || '[]'); } catch (_) {}
        return jsonResponse({
            ok: true,
            stopped: false,
            nonce: sos.webrtc_session_nonce || '',
            renegotiate: Boolean(sos.webrtc_renegotiate) || Boolean(clientNonce && sos.webrtc_session_nonce && clientNonce !== sos.webrtc_session_nonce),
            answer: sos.webrtc_answer || '',
            ice: Array.isArray(iceList) ? iceList : []
        });
    }

    // GET /api/admin/emergency/sos/:id/photos (Admin list captured HD photos for an SOS alert)
    const adminSosPhotosGetMatch = path.match(/^\/api\/admin\/emergency\/sos\/([^/]+)\/photos$/);
    if (adminSosPhotosGetMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(adminSosPhotosGetMatch[1]);
        const sos = await env.DB.prepare('SELECT id FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?').bind(alertId, alertId).first();
        if (!sos) return jsonError(404, 'SOS Alert not found.');
        const { results } = await env.DB.prepare(
            'SELECT id, sos_id, captured_by, photo_data, created_at FROM sos_captured_photos WHERE sos_id = ? ORDER BY created_at DESC LIMIT 30'
        ).bind(sos.id).all();
        return jsonResponse({ ok: true, photos: results || [] });
    }

    // GET /api/admin/emergency/sos/:id/camera (Admin view opt-in live WebRTC offer + camera frame)
    const adminSosCamMatch = path.match(/^\/api\/admin\/emergency\/sos\/([^/]+)\/camera$/);
    if (adminSosCamMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(adminSosCamMatch[1]);
        const sos = await env.DB.prepare(
            `SELECT id, alert_number, customer_name, customer_phone, emergency_type, status, maps_url,
                    current_location_text, camera_consent, camera_active, camera_frame,
                    camera_updated_at, camera_expires_at,
                    webrtc_offer, webrtc_offer_ice, webrtc_answer, webrtc_session_nonce,
                    (SELECT COUNT(*) FROM sos_captured_photos p WHERE p.sos_id = emergency_sos_alerts.id) AS photos_count
             FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?`
        ).bind(alertId, alertId).first();
        if (!sos) return jsonError(404, 'SOS Alert not found.');

        const nowIso = new Date().toISOString();
        const isExpired = Boolean(sos.camera_expires_at && sos.camera_expires_at <= nowIso);
        const stillLive = Boolean(sos.camera_consent && sos.camera_active && sos.status === 'Active' && !isExpired);

        if (sos.camera_active && !stillLive) {
            await env.DB.prepare(
                "UPDATE emergency_sos_alerts SET camera_active = 0, camera_frame = '', camera_session_token = '', webrtc_offer = '', webrtc_answer = '', updated_at = ? WHERE id = ?"
            ).bind(nowIso, sos.id).run();
        }

        let offerIce = [];
        try { offerIce = JSON.parse(sos.webrtc_offer_ice || '[]'); } catch (_) {}

        return jsonResponse({
            ok: true,
            alertId: sos.id,
            alertNumber: sos.alert_number,
            customerName: sos.customer_name || 'Passenger',
            customerPhone: sos.customer_phone || '',
            emergencyType: sos.emergency_type || '',
            status: sos.status || 'Active',
            mapsUrl: sos.maps_url || '',
            currentLocationText: sos.current_location_text || '',
            cameraConsent: Boolean(sos.camera_consent),
            cameraActive: stillLive,
            cameraUpdatedAt: sos.camera_updated_at || null,
            cameraExpiresAt: sos.camera_expires_at || null,
            frame: stillLive ? (sos.camera_frame || '') : '',
            webrtcOffer: stillLive ? (sos.webrtc_offer || '') : '',
            webrtcOfferIce: stillLive && Array.isArray(offerIce) ? offerIce : [],
            webrtcAnswer: stillLive ? (sos.webrtc_answer || '') : '',
            webrtcNonce: sos.webrtc_session_nonce || '',
            photosCount: Number(sos.photos_count || 0)
        });
    }

    // GET /api/admin/emergency/sos (Admin list all emergency SOS alerts)
    if (path === '/api/admin/emergency/sos') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const nowIso = new Date().toISOString();
        await env.DB.prepare(
            "UPDATE emergency_sos_alerts SET camera_active = 0, camera_frame = '', camera_session_token = '', webrtc_offer = '', webrtc_answer = '' WHERE camera_active = 1 AND (status != 'Active' OR (camera_expires_at IS NOT NULL AND camera_expires_at <= ?))"
        ).bind(nowIso).run();

        const statusFilter = (url.searchParams.get('status') || 'all').trim();
        const search = (url.searchParams.get('search') || '').trim().toLowerCase();

        let query = `SELECT id, alert_number, customer_phone, customer_name, emergency_type, description,
                            latitude, longitude, maps_url, current_location_text, bus_id, bus_name,
                            status, resolved_at, resolved_by, resolution_notes,
                            camera_consent, camera_active, camera_updated_at, camera_expires_at,
                            CASE WHEN camera_frame IS NOT NULL AND camera_frame != '' THEN 1 ELSE 0 END AS has_live_frame,
                            (SELECT COUNT(*) FROM sos_captured_photos p WHERE p.sos_id = emergency_sos_alerts.id) AS photos_count,
                            created_at, updated_at
                     FROM emergency_sos_alerts`;
        const conditions = [];
        const params = [];

        if (statusFilter && statusFilter !== 'all') {
            conditions.push('status = ?');
            params.push(statusFilter);
        }
        if (search) {
            conditions.push('(alert_number LIKE ? OR customer_phone LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(emergency_type) LIKE ? OR LOWER(current_location_text) LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += " ORDER BY CASE WHEN status = 'Active' THEN 0 ELSE 1 END, created_at DESC LIMIT 100";

        const { results } = await env.DB.prepare(query).bind(...params).all();

        const activeCountRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM emergency_sos_alerts WHERE status = 'Active'").first();
        const resolvedCountRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM emergency_sos_alerts WHERE status = 'Resolved'").first();
        const totalCountRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM emergency_sos_alerts").first();

        return jsonResponse({
            ok: true,
            alerts: results || [],
            stats: {
                active: (activeCountRow && activeCountRow.total) || 0,
                resolved: (resolvedCountRow && resolvedCountRow.total) || 0,
                total: (totalCountRow && totalCountRow.total) || 0
            }
        });
    }

    return jsonError(404, 'API endpoint not found: ' + path);
}

async function handlePost(context) {
    const { request, env, auth } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /api/telemetry/client-event (Public anonymous site visit, PWA install & uninstall signal)
    if (path === '/api/telemetry/client-event') {
        await ensureClientAnalyticsTable(env.DB);
        const body = await readJson(request);
        const rawUid = String(body?.deviceUid || '').trim();
        if (!/^[a-zA-Z0-9_-]{6,64}$/.test(rawUid)) {
            return jsonError(400, 'Invalid client device UID.');
        }
        const portal = ['customer', 'owner', 'captain', 'admin'].includes(body?.portal) ? body.portal : 'customer';
        const event = ['visit', 'standalone_open', 'installed', 'uninstalled'].includes(body?.event) ? body.event : 'visit';
        const countVisit = body?.countVisit !== false;
        const devInfo = extractDeviceInfo(request, body);
        const nowIso = new Date().toISOString();
        const clientId = `${rawUid}_${portal}`;
        const screen = String(body?.screen || body?.deviceInfo?.screen || '').slice(0, 32);
        const userRole = String((auth?.role && auth.role !== 'guest') ? auth.role : (body?.userRole || '')).slice(0, 24);
        const userIdentifier = String((auth?.identifier) ? auth.identifier : (body?.userIdentifier || '')).slice(0, 64);

        const initialStatus = (event === 'installed' || event === 'standalone_open')
            ? 'installed'
            : (event === 'uninstalled' ? 'uninstalled' : 'web_only');
        const initialVisitCount = (event === 'visit' || event === 'standalone_open') ? (countVisit ? 1 : 0) : 0;
        const initialStandaloneCount = event === 'standalone_open' ? 1 : 0;
        const installedAtVal = (event === 'installed' || event === 'standalone_open') ? nowIso : null;
        const standaloneAtVal = event === 'standalone_open' ? nowIso : null;
        const uninstalledAtVal = event === 'uninstalled' ? nowIso : null;

        await env.DB.prepare(`
            INSERT INTO client_device_analytics (
                client_id, device_uid, portal, device_type, device_brand, device_model, os, browser, screen,
                ip_address, city, region, country, install_status, visit_count, standalone_open_count,
                user_identifier, user_role, first_seen_at, last_seen_at, installed_at, last_standalone_at,
                uninstalled_at, last_event, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(client_id) DO UPDATE SET
                device_type = CASE WHEN (excluded.os != 'Unknown OS' OR excluded.device_brand != 'Unknown') THEN excluded.device_type ELSE client_device_analytics.device_type END,
                device_brand = CASE WHEN excluded.device_brand != 'Unknown' THEN excluded.device_brand ELSE client_device_analytics.device_brand END,
                device_model = CASE WHEN excluded.device_model != '' THEN excluded.device_model ELSE client_device_analytics.device_model END,
                os = CASE WHEN excluded.os != 'Unknown OS' THEN excluded.os ELSE client_device_analytics.os END,
                browser = CASE WHEN excluded.browser != 'Browser' THEN excluded.browser ELSE client_device_analytics.browser END,
                screen = CASE WHEN excluded.screen != '' THEN excluded.screen ELSE client_device_analytics.screen END,
                ip_address = excluded.ip_address,
                city = CASE WHEN excluded.city != '' THEN excluded.city ELSE client_device_analytics.city END,
                region = CASE WHEN excluded.region != '' THEN excluded.region ELSE client_device_analytics.region END,
                country = excluded.country,
                user_identifier = CASE WHEN excluded.user_identifier != '' THEN excluded.user_identifier ELSE client_device_analytics.user_identifier END,
                user_role = CASE WHEN excluded.user_role != '' THEN excluded.user_role ELSE client_device_analytics.user_role END,
                install_status = CASE
                    WHEN excluded.last_event IN ('installed', 'standalone_open') THEN 'installed'
                    WHEN excluded.last_event = 'uninstalled' THEN 'uninstalled'
                    ELSE client_device_analytics.install_status
                END,
                visit_count = client_device_analytics.visit_count + excluded.visit_count,
                standalone_open_count = client_device_analytics.standalone_open_count + excluded.standalone_open_count,
                last_seen_at = excluded.last_seen_at,
                installed_at = CASE
                    WHEN excluded.last_event IN ('installed', 'standalone_open') THEN COALESCE(client_device_analytics.installed_at, excluded.installed_at)
                    ELSE client_device_analytics.installed_at
                END,
                last_standalone_at = CASE
                    WHEN excluded.last_event = 'standalone_open' THEN excluded.last_standalone_at
                    ELSE client_device_analytics.last_standalone_at
                END,
                uninstalled_at = CASE
                    WHEN excluded.last_event = 'uninstalled' THEN excluded.uninstalled_at
                    WHEN excluded.last_event IN ('installed', 'standalone_open') THEN NULL
                    ELSE client_device_analytics.uninstalled_at
                END,
                last_event = excluded.last_event,
                updated_at = excluded.updated_at
        `).bind(
            clientId, rawUid, portal, devInfo.deviceType, devInfo.deviceBrand, devInfo.deviceModel || '',
            devInfo.os, devInfo.browser, screen, devInfo.ipAddress, devInfo.city || '', devInfo.region || '',
            devInfo.country || 'IN', initialStatus, initialVisitCount, initialStandaloneCount,
            userIdentifier, userRole, nowIso, nowIso, installedAtVal, standaloneAtVal, uninstalledAtVal,
            event, nowIso
        ).run();

        return jsonResponse({ ok: true, clientId, event });
    }

    // POST /api/promotions/:id/click
    const promoClickMatch = path.match(/^\/api\/promotions\/([^/]+)\/click$/);
    if (promoClickMatch) {
        const promoId = decodeURIComponent(promoClickMatch[1]);
        try {
            await env.DB.prepare('UPDATE promotions SET clicks_count = clicks_count + 1 WHERE id = ?')
                .bind(promoId).run();
        } catch (e) {}
        return jsonResponse({ ok: true });
    }

    if (path === '/api/admin/replica-backfill') {
        if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_SERVICE_ACCOUNT_EMAIL ||
            !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) {
            return jsonError(503, 'Configure the Firebase project and service account before starting the initial backup.');
        }
        const result = await enqueueFirebaseBackfillBatch(env.DB);
        return jsonResponse(result);
    }

    // POST /api/admin/owners/features or PATCH /api/admin/owners/:phone/features
    if (path === '/api/admin/owners/features' || (path.startsWith('/api/admin/owners/') && path.endsWith('/features'))) {
        const body = await readJson(request);
        const parts = path.split('/');
        const phone = (parts.length >= 5 && parts[4] !== 'features') ? decodeURIComponent(parts[4]) : body?.phone;
        if (!phone) return jsonError(400, 'Owner phone is required.');
        const features = typeof body?.features === 'string' ? body.features : JSON.stringify(body?.features || {});
        await env.DB.prepare('UPDATE owners SET features = ? WHERE phone = ?').bind(features, phone).run();
        return jsonResponse({ ok: true, phone, features: parseJson(features, {}) });
    }

    // POST /api/admin/customers/features or PATCH /api/admin/customers/:phone/features
    if (path === '/api/admin/customers/features' || (path.startsWith('/api/admin/customers/') && path.endsWith('/features'))) {
        const body = await readJson(request);
        const parts = path.split('/');
        const phone = (parts.length >= 5 && parts[4] !== 'features') ? decodeURIComponent(parts[4]) : body?.phone;
        if (!phone) return jsonError(400, 'Customer phone is required.');
        const features = typeof body?.features === 'string' ? body.features : JSON.stringify(body?.features || {});
        await env.DB.prepare('UPDATE customers SET features = ?, updated_at = ? WHERE phone = ?')
            .bind(features, new Date().toISOString(), phone).run();
        return jsonResponse({ ok: true, phone, features: parseJson(features, {}) });
    }

    // POST /api/admin/captains/features or PATCH /api/admin/captains/:phone/features
    if (path === '/api/admin/captains/features' || (path.startsWith('/api/admin/captains/') && path.endsWith('/features'))) {
        const body = await readJson(request);
        const parts = path.split('/');
        const phone = (parts.length >= 5 && parts[4] !== 'features') ? decodeURIComponent(parts[4]) : body?.phone;
        if (!phone) return jsonError(400, 'Captain phone is required.');
        const features = typeof body?.features === 'string' ? body.features : JSON.stringify(body?.features || {});
        await env.DB.prepare("UPDATE portal_credentials SET features = ?, updated_at = ? WHERE role = 'captain' AND identifier = ?")
            .bind(features, new Date().toISOString(), phone).run();
        return jsonResponse({ ok: true, phone, features: parseJson(features, {}) });
    }

    // POST /api/admin/features/bulk - Bulk apply features to all owners, all customers, or all captains
    if (path === '/api/admin/features/bulk') {
        const body = await readJson(request);
        const target = String(body?.target || 'owners').trim(); // 'owners', 'customers', or 'captains'
        const features = typeof body?.features === 'string' ? body.features : JSON.stringify(body?.features || {});
        if (target === 'customers') {
            await env.DB.prepare('UPDATE customers SET features = ?, updated_at = ?').bind(features, new Date().toISOString()).run();
            return jsonResponse({ ok: true, target: 'customers', message: 'Features updated for all customers.' });
        } else if (target === 'captains') {
            await env.DB.prepare("UPDATE portal_credentials SET features = ?, updated_at = ? WHERE role = 'captain'").bind(features, new Date().toISOString()).run();
            return jsonResponse({ ok: true, target: 'captains', message: 'Features updated for all captains.' });
        } else {
            await env.DB.prepare('UPDATE owners SET features = ?').bind(features).run();
            return jsonResponse({ ok: true, target: 'owners', message: 'Features updated for all owners.' });
        }
    }

    // POST /api/admin/customers/reset-pin
    if (path === '/api/admin/customers/reset-pin') {
        const body = await readJson(request);
        const phone = String((body && body.phone) || '').trim();
        const newPin = String((body && body.newPin) || '').trim();
        if (!phone || !/^\d{4}$/.test(newPin)) return jsonError(400, 'Customer phone and 4-digit PIN required.');
        const customer = await env.DB.prepare('SELECT phone FROM customers WHERE phone = ?').bind(phone).first();
        if (!customer) return jsonError(404, 'Customer account not found.');
        const pinSalt = secureRandomHex(16);
        const pinHash = await deriveSecretHash(newPin, pinSalt);
        await env.DB.prepare('UPDATE customers SET pin = ?, pin_salt = ?, pin_hash = ?, pin_requested_at = NULL, updated_at = ? WHERE phone = ?')
            .bind(newPin, pinSalt, pinHash, new Date().toISOString(), phone).run();
        await saveCredential(env.DB, { role: 'customer', identifier: phone, pin: newPin });
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'customer' AND identifier = ?").bind(phone).run();
        return jsonResponse({ ok: true, phone, pin: newPin, message: 'Customer PIN updated successfully.' });
    }

    // POST /api/admin/captains/reset-pin
    if (path === '/api/admin/captains/reset-pin') {
        const body = await readJson(request);
        const captainId = body && body.id;
        const newPin = String((body && body.newPin) || '').trim();
        if (!captainId || !/^\d{4}$/.test(newPin)) return jsonError(400, 'Captain ID and 4-digit PIN required.');
        const bus = await env.DB.prepare('SELECT id, driver_phone FROM buses WHERE id = ? AND driver_phone != ?')
            .bind(captainId, '').first();
        if (!bus) return jsonError(404, 'Captain account not found.');
        await setCredentialPin(env.DB, { role: 'captain', identifier: bus.driver_phone, busId: bus.id, pin: newPin });
        await env.DB.prepare("UPDATE captains SET pin = ?, updated_at = ? WHERE phone = ? OR bus_id = ?")
            .bind(newPin, new Date().toISOString(), bus.driver_phone, bus.id).run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?")
            .bind(bus.driver_phone).run();
        return jsonResponse({ ok: true });
    }

    // POST /api/admin/owners/reset-pin
    if (path === '/api/admin/owners/reset-pin') {
        const body = await readJson(request);
        const phone = String((body && body.phone) || '').trim();
        const newPin = String((body && body.newPin) || '').trim();
        if (!phone || !/^\d{4}$/.test(newPin)) return jsonError(400, 'Owner phone and 4-digit PIN required.');
        const owner = await env.DB.prepare('SELECT owner_phone FROM buses WHERE owner_phone = ? LIMIT 1')
            .bind(phone).first();
        if (!owner) return jsonError(404, 'Owner account not found.');
        await saveCredential(env.DB, { role: 'owner', identifier: phone, pin: newPin });
        await env.DB.prepare("UPDATE owners SET pin = ? WHERE phone = ?").bind(newPin, phone).run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'owner' AND identifier = ?")
            .bind(phone).run();
        return jsonResponse({ ok: true });
    }

    // POST /api/owner/send-register-otp
    if (path === '/api/owner/send-register-otp') {
        const body = await readJson(request);
        const email = String((body && body.email) || '').trim().toLowerCase();
        if (!email || !email.includes('@')) return jsonError(400, 'বৈধ ইমেইল ঠিকানা দিন (Enter valid email).');
        try {
            await sendEmailOtp(env, { email, role: 'owner', purpose: 'owner_register_' + email });
            return jsonResponse({ ok: true, message: 'ওটিপি আপনার ইমেইলে পাঠানো হয়েছে!' });
        } catch (err) {
            return jsonError(400, err.message);
        }
    }

    if (path === '/api/auth/owner/register' || path === '/api/owner/register') {
        const body = await readJson(request);
        const name = String(body?.ownerName || body?.owner_name || body?.name || '').trim();
        const companyName = String(body?.companyName || body?.company_name || '').trim();
        const phone = String(body?.phone || body?.ownerPhone || body?.owner_phone || '').trim();
        const email = String(body?.email || body?.ownerEmail || '').trim().toLowerCase();
        const otp = String(body?.otp || '').trim();
        const busNumber = String(body?.busNumber || body?.bus_number || '').trim().toUpperCase();
        const pin = String(body?.pin || '').trim();
        const securityQuestion = String(body?.securityQuestion || body?.security_question || '').trim();
        const securityAnswer = String(body?.securityAnswer || body?.security_answer || '').trim();
        const licenseData = String(body?.licenseData || body?.license_doc || body?.licenseDoc || '');

        if (name.length < 2 || companyName.length < 2) {
            return jsonError(400, 'Enter a valid owner name and bus company name.');
        }
        if (!/^[6-9]\d{9}$/.test(phone)) {
            return jsonError(400, 'Enter a valid 10-digit mobile number.');
        }

        // Check if phone number is permanently banned / blacklisted
        try {
            const acl = await env.DB.prepare('SELECT status FROM access_control_list WHERE phone = ?').bind(phone).first();
            if (acl && acl.status === 'permanently_banned') {
                return jsonError(403, '⛔ এই মোবাইল নম্বরটি অ্যাডমিন কর্তৃক স্থায়ীভাবে নিষিদ্ধ (Blacklisted) করা হয়েছে। নতুন করে অ্যাকাউন্ট তৈরি করা সম্ভব নয়।');
            }
        } catch (ae) {}
        if (email && !email.includes('@')) {
            return jsonError(400, 'Enter a valid email address.');
        }
        if (busNumber.length < 3) {
            return jsonError(400, 'Enter a valid bus registration number.');
        }
        if (!/^\d{4}$/.test(pin) || !securityQuestion || !securityAnswer) {
            return jsonError(400, 'Set a 4-digit PIN, a recovery question, and an answer.');
        }

        if (email) {
            if (!otp) {
                return jsonError(400, 'ইমেইল ভেরিফিকেশনের জন্য ৬-সংখ্যার ওটিপি কোড আবশ্যক। (Email OTP is required.)');
            }
            try {
                await verifyEmailOtp(env, { email, otp, purpose: 'owner_register_' + email });
            } catch (err) {
                return jsonError(400, err.message);
            }
        }

        const existingOwner = await env.DB.prepare(
            'SELECT status FROM owners WHERE phone = ?'
        ).bind(phone).first();
        if (existingOwner && existingOwner.status === 'active') {
            return jsonError(409, 'এই মোবাইল নম্বরে ইতিমধ্যেই একটি অনুমোদিত ওনার অ্যাকাউন্ট আছে। সরাসরি লগইন করুন।');
        }

        const reqId = `REQ_${Date.now()}_${secureRandomHex(4)}`;
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO owner_requests (
                id, company_name, owner_name, bus_number, owner_phone, email,
                license_doc, pin, security_question, security_answer, status,
                created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
             ON CONFLICT (owner_phone) DO UPDATE SET
                company_name = excluded.company_name,
                owner_name = excluded.owner_name,
                bus_number = excluded.bus_number,
                email = excluded.email,
                license_doc = excluded.license_doc,
                pin = excluded.pin,
                security_question = excluded.security_question,
                security_answer = excluded.security_answer,
                status = 'pending',
                updated_at = excluded.updated_at`
        ).bind(
            reqId, companyName, name, busNumber, phone, email || null,
            licenseData, pin, securityQuestion, securityAnswer,
            now, now
        ).run();

        return jsonResponse({
            ok: true,
            status: 'pending',
            message: 'আপনার রেজিস্ট্রেশন রিকোয়েস্ট অ্যাডমিন অনুমোদনের জন্য সফলভাবে পাঠানো হয়েছে! অ্যাডমিন অনুমোদন করার সাথে সাথে আপনি ৪-ডিজিটের পিন দিয়ে লগইন করতে পারবেন।'
        }, 200);
    }

    // POST /api/customer/register
    if (path === '/api/customer/register') {
        await ensureCustomerPhotoColumns(env.DB);
        const body = await readJson(request);
        const name = String((body && body.name) || '').trim();
        const phone = String((body && body.phone) || '').trim();
        const email = String((body && body.email) || '').trim().toLowerCase();
        const pin = String((body && body.pin) || '').trim();
        const question = String((body && body.securityQuestion) || '').trim();
        const answer = String((body && body.securityAnswer) || '').trim();

        if (!name || name.length < 2 || name.length > 80) return jsonError(400, 'Enter a name between 2 and 80 characters.');
        if (!/^[6-9]\d{9}$/.test(phone)) return jsonError(400, 'Please enter a valid 10-digit Indian mobile number.');
        if (!/^\d{4}$/.test(pin)) return jsonError(400, 'Please enter a 4-digit PIN.');
        if (question.length < 5 || answer.length < 3) return jsonError(400, 'Set a recovery question and an answer.');

        // Fraud & Suspension Check on Registration
        try {
            const banCheck = await env.DB.prepare('SELECT status, reason FROM access_control_list WHERE phone = ?').bind(phone).first();
            if (banCheck && (banCheck.status === 'permanently_banned' || banCheck.status === 'suspended' || banCheck.status === 'blocked')) {
                return jsonError(403, `⛔ এই মোবাইল নম্বরটি অ্যাডমিন কর্তৃক সাময়িকভাবে স্থগিত বা নিষিদ্ধ করা হয়েছে। নতুন রেজিস্ট্রেশন সম্ভব নয়।`);
            }
        } catch (be) {}

        const existing = await env.DB.prepare('SELECT status FROM customers WHERE phone = ?').bind(phone).first();
        if (existing && existing.status === 'active') {
            return jsonError(409, 'An account already exists with this mobile number. Please log in.');
        }
        const pinSalt = secureRandomHex(16);
        const pinHash = await deriveSecretHash(pin, pinSalt);
        const answerSalt = secureRandomHex(16);
        const answerHash = await deriveSecretHash(answer.toLowerCase(), answerSalt);
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO customers (
                phone, name, email, pin, pin_salt, pin_hash, security_question,
                security_answer, security_answer_salt, security_answer_hash, status, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
             ON CONFLICT (phone) DO UPDATE SET
                name = excluded.name, email = excluded.email, pin = excluded.pin,
                pin_salt = excluded.pin_salt, pin_hash = excluded.pin_hash,
                security_question = excluded.security_question,
                security_answer = excluded.security_answer,
                security_answer_salt = excluded.security_answer_salt,
                security_answer_hash = excluded.security_answer_hash,
                status = 'active', created_at = excluded.created_at,
                updated_at = excluded.updated_at`
        ).bind(phone, name, email || null, pin, pinSalt, pinHash, question, answer, answerSalt, answerHash, now, now).run();
        await saveCredential(env.DB, { role: 'customer', identifier: phone, pin, securityQuestion: question, securityAnswer: answer });
        const session = await createCustomerSession(env.DB, phone);
        const devInfo = extractDeviceInfo(request, body);
        await recordUserLoginDevice(env.DB, 'customer', phone, name, devInfo);
        const defaultCustomerFeatures = {
            offline_tickets: false,
            referral_rewards: false,
            voice_search: false,
            parcel_booking: false,
            meal_preorder: false,
            women_safety: false,
            whatsapp_booking: false,
            bluetooth_offline: false,
            ncmc_smart_card: false,
            agent_portal: false
        };
        return jsonResponse({
            ok: true,
            status: 'active',
            token: session.token,
            expiresAt: session.expiresAt,
            customer: {
                phone,
                name,
                email: email || null,
                profilePhoto: '',
                avatarPreference: 'auto',
                features: defaultCustomerFeatures
            }
        });
    }

    // POST /api/customer/login
    if (path === '/api/customer/login') {
        await ensureCustomerPhotoColumns(env.DB);
        const body = await readJson(request);
        const phone = String((body && body.phone) || '').trim();
        const pin = String((body && body.pin) || '').trim();

        if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4}$/.test(pin)) {
            return jsonError(400, 'Please enter a valid 10-digit mobile number and 4-digit PIN.');
        }

        const lock = await env.DB.prepare(
            "SELECT locked_until FROM portal_login_attempts WHERE role = 'customer' AND identifier = ?"
        ).bind(phone).first();
        if (lock && lock.locked_until && lock.locked_until > new Date().toISOString()) {
            return jsonError(429, 'Too many failed attempts. Try again in 15 minutes.');
        }

        // Check ACL for Customer Fraud & Suspension
        try {
            const custAcl = await env.DB.prepare('SELECT status, reason FROM access_control_list WHERE phone = ?').bind(phone).first();
            if (custAcl) {
                if (custAcl.status === 'permanently_banned') {
                    return jsonError(403, '⛔ এই কাস্টমার মোবাইল নম্বরটি নিয়ম লঙ্ঘন বা ফ্রডের কারণে স্থায়ীভাবে নিষিদ্ধ (Permanently Banned) করা হয়েছে।');
                }
                if (custAcl.status === 'suspended' || custAcl.status === 'blocked') {
                    return jsonError(403, `⚠️ আপনার কাস্টমার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত (Suspended) রয়েছে। ${custAcl.reason ? 'কারণ: ' + custAcl.reason : 'অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।'}`);
                }
            }
        } catch (ce) {}

        const customer = await env.DB.prepare('SELECT * FROM customers WHERE phone = ?').bind(phone).first();
        if (!customer) {
            if (await recordCustomerFailedLogin(env.DB, phone)) {
                return jsonError(429, 'Too many failed attempts. Try again in 15 minutes.');
            }
            return jsonError(401, 'Invalid mobile number or PIN.');
        }
        if (customer.status !== 'active') {
            return jsonError(403, '⚠️ আপনার কাস্টমার অ্যাকাউন্টটি অ্যাডমিন দ্বারা সাময়িকভাবে স্থগিত বা নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।');
        }
        const pinHash = await deriveSecretHash(pin, customer.pin_salt);
        if (!constantTimeEqual(pinHash, customer.pin_hash)) {
            if (await recordCustomerFailedLogin(env.DB, phone)) {
                return jsonError(429, 'Too many failed attempts. Try again in 15 minutes.');
            }
            return jsonError(401, 'Invalid mobile number or PIN.');
        }
        await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'customer' AND identifier = ?").bind(phone).run();
        const session = await createCustomerSession(env.DB, phone);
        const devInfo = extractDeviceInfo(request, body);
        await recordUserLoginDevice(env.DB, 'customer', phone, customer.name, devInfo);

        const defaultCustomerFeatures = {
            offline_tickets: false,
            referral_rewards: false,
            voice_search: false,
            parcel_booking: false,
            meal_preorder: false,
            women_safety: false,
            whatsapp_booking: false,
            bluetooth_offline: false,
            ncmc_smart_card: false,
            agent_portal: false
        };
        const customerFeatures = { ...defaultCustomerFeatures, ...parseJson(customer.features, {}) };

        return jsonResponse({
            ok: true,
            token: session.token,
            expiresAt: session.expiresAt,
            customer: {
                phone: customer.phone,
                name: customer.name,
                email: customer.email || '',
                profilePhoto: customer.profile_photo || '',
                avatarPreference: customer.avatar_preference || 'auto',
                features: customerFeatures
            }
        });
    }

    // POST /api/customer/profile-photo (Customer self-upload, change, or preference switch)
    if (path === '/api/customer/profile-photo') {
        if (!auth || auth.role !== 'customer' || !auth.identifier) {
            return jsonError(401, 'Please sign in to update your profile photo.');
        }
        await ensureCustomerPhotoColumns(env.DB);
        const body = await readJson(request);
        if (!body || typeof body !== 'object') {
            return jsonError(400, 'Invalid request body.');
        }

        const existing = await env.DB.prepare(
            'SELECT phone, name, email, features, profile_photo, avatar_preference FROM customers WHERE phone = ?'
        ).bind(auth.identifier).first();
        if (!existing) return jsonError(404, 'Customer account not found.');

        const clearPhoto = Boolean(body.clearPhoto);
        let nextPhoto = existing.profile_photo || '';
        if (clearPhoto) {
            nextPhoto = '';
        } else if (body.profilePhoto !== undefined) {
            const check = sanitizeProfilePhotoInput(body.profilePhoto);
            if (!check.ok) return jsonError(400, check.error);
            nextPhoto = check.value;
        }

        const rawPref = String(body.avatarPreference || (body.profilePhoto ? 'custom' : (clearPhoto ? 'auto' : (existing.avatar_preference || 'auto')))).trim().toLowerCase();
        const allowedPrefs = new Set(['auto', 'male', 'female', 'custom']);
        let nextPref = allowedPrefs.has(rawPref) ? rawPref : 'auto';
        if (nextPref === 'custom' && !nextPhoto) nextPref = 'auto';

        const now = new Date().toISOString();
        await env.DB.prepare(
            'UPDATE customers SET profile_photo = ?, avatar_preference = ?, updated_at = ? WHERE phone = ?'
        ).bind(nextPhoto, nextPref, now, auth.identifier).run();

        return jsonResponse({
            ok: true,
            message: clearPhoto ? 'প্রোফাইল ফটো মুছে ফেলা হয়েছে।' : 'প্রোফাইল ফটো সফলভাবে আপডেট হয়েছে!',
            customer: {
                phone: existing.phone,
                name: existing.name,
                email: existing.email || '',
                profilePhoto: nextPhoto,
                avatarPreference: nextPref,
                features: parseJson(existing.features, {})
            }
        });
    }

    // POST /api/customer/forgot-pin
    if (path === '/api/customer/forgot-pin') {
        const body = await readJson(request);
        const phone = String((body && body.phone) || '').trim();
        const answer = String((body && body.securityAnswer) || '').trim().toLowerCase();
        const newPin = String((body && body.newPin) || '').trim();

        if (!/^[6-9]\d{9}$/.test(phone)) return jsonError(400, 'Valid 10-digit mobile number required.');
        if (!/^\d{4}$/.test(newPin)) return jsonError(400, 'New PIN must be exactly 4 digits.');

        const lock = await env.DB.prepare(
            "SELECT locked_until FROM portal_login_attempts WHERE role = 'customer' AND identifier = ?"
        ).bind(phone).first();
        if (lock && lock.locked_until && lock.locked_until > new Date().toISOString()) {
            return jsonError(429, 'Too many recovery attempts. Try again in 15 minutes.');
        }
        const customer = await env.DB.prepare(
            "SELECT * FROM customers WHERE phone = ? AND status = 'active'"
        ).bind(phone).first();
        if (!customer) return jsonError(404, 'No active customer account found for this number.');
        let answerMatches = false;
        if (customer.security_answer_salt && customer.security_answer_hash) {
            const answerHash = await deriveSecretHash(answer, customer.security_answer_salt);
            answerMatches = constantTimeEqual(answerHash, customer.security_answer_hash);
        } else if (customer.security_answer) {
            answerMatches = customer.security_answer.trim().toLowerCase() === answer;
        } else {
            const cred = await env.DB.prepare(
                "SELECT security_answer_salt, security_answer_hash FROM portal_credentials WHERE role = 'customer' AND identifier = ?"
            ).bind(phone).first();
            if (cred && cred.security_answer_salt && cred.security_answer_hash) {
                const answerHash = await deriveSecretHash(answer, cred.security_answer_salt);
                answerMatches = constantTimeEqual(answerHash, cred.security_answer_hash);
            }
        }
        if (!answerMatches) {
            if (await recordCustomerFailedLogin(env.DB, phone)) {
                return jsonError(429, 'Too many recovery attempts. Try again in 15 minutes.');
            }
            return jsonError(401, 'The recovery answer is incorrect.');
        }
        const pinSalt = secureRandomHex(16);
        const pinHash = await deriveSecretHash(newPin, pinSalt);
        await env.DB.prepare('UPDATE customers SET pin = ?, pin_salt = ?, pin_hash = ?, pin_requested_at = NULL, updated_at = ? WHERE phone = ?')
            .bind(newPin, pinSalt, pinHash, new Date().toISOString(), phone).run();
        await saveCredential(env.DB, { role: 'customer', identifier: phone, pin: newPin });
        await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'customer' AND identifier = ?").bind(phone).run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'customer' AND identifier = ?").bind(phone).run();
        return jsonResponse({ ok: true, message: 'PIN reset. Sign in with your new PIN.' });
    }

    // POST /api/customer/send-reset-otp
    if (path === '/api/customer/send-reset-otp') {
        const body = await readJson(request);
        const email = String((body && body.email) || '').trim().toLowerCase();
        const phone = String((body && body.phone) || '').trim();

        let customer = null;
        if (email && email.includes('@')) {
            customer = await env.DB.prepare(
                'SELECT phone, email, name FROM customers WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) ORDER BY created_at DESC'
            ).bind(email).first();
        } else if (phone && /^[6-9]\d{9}$/.test(phone)) {
            customer = await env.DB.prepare(
                'SELECT phone, email, name FROM customers WHERE phone = ?'
            ).bind(phone).first();
        } else {
            return jsonError(400, 'অনুগ্রহ করে আপনার সঠিক রেজিস্টার্ড ইমেইল প্রদান করুন (Please enter your valid registered email).');
        }

        if (!customer) {
            return jsonError(404, email
                ? 'এই ইমেইল আইডি দিয়ে কোনো রেজিস্টার্ড যাত্রী অ্যাকাউন্ট পাওয়া যায়নি (No customer account found with this email).'
                : 'এই নম্বরে কোনো যাত্রী অ্যাকাউন্ট পাওয়া যায়নি (Customer account not found).');
        }

        if (!customer.email || !customer.email.includes('@')) {
            return jsonError(400, 'আপনার অ্যাকাউন্টে কোনো ইমেইল যুক্ত নেই। সিকিউরিটি প্রশ্নের মাধ্যমে অথবা অ্যাডমিনের মাধ্যমে পিন রিসেট করুন (No email linked. Use security question or ask Admin).');
        }

        const targetEmail = customer.email.trim().toLowerCase();
        const purpose = 'customer_reset_' + targetEmail;

        try {
            await sendEmailOtp(env, { email: targetEmail, role: 'customer', purpose });
            const parts = targetEmail.split('@');
            const masked = parts[0].slice(0, 2) + '***@' + parts[1];
            return jsonResponse({
                ok: true,
                email: targetEmail,
                phone: customer.phone,
                emailMasked: masked,
                message: `ওটিপি আপনার রেজিস্টার্ড ইমেইলে (${masked}) সফলভাবে পাঠানো হয়েছে!`
            });
        } catch (err) {
            return jsonError(400, err.message);
        }
    }

    // POST /api/customer/reset-by-otp
    if (path === '/api/customer/reset-by-otp') {
        const body = await readJson(request);
        const email = String((body && body.email) || '').trim().toLowerCase();
        const phone = String((body && body.phone) || '').trim();
        const otp = String((body && body.otp) || '').trim();
        const newPin = String((body && body.newPin) || '').trim();

        if (!otp || !/^\d{4}$/.test(newPin)) {
            return jsonError(400, 'ওটিপি কোড এবং নতুন ৪-সংখ্যার পিন প্রদান করুন (OTP and 4-digit PIN required).');
        }

        let customer = null;
        if (email && email.includes('@')) {
            customer = await env.DB.prepare(
                'SELECT phone, email, name FROM customers WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) ORDER BY created_at DESC'
            ).bind(email).first();
        } else if (phone && /^[6-9]\d{9}$/.test(phone)) {
            customer = await env.DB.prepare(
                'SELECT phone, email, name FROM customers WHERE phone = ?'
            ).bind(phone).first();
        } else {
            return jsonError(400, 'রেজিস্টার্ড ইমেইল প্রদান করুন (Registered email required).');
        }

        if (!customer || !customer.email) {
            return jsonError(404, 'গ্রাহকের অ্যাকাউন্ট বা রেজিস্টার্ড ইমেইল পাওয়া যায়নি (Customer account or email not found).');
        }

        const targetEmail = customer.email.trim().toLowerCase();
        try {
            await verifyEmailOtp(env, { email: targetEmail, otp, purpose: 'customer_reset_' + targetEmail });
        } catch (err) {
            if (customer.phone) {
                try {
                    await verifyEmailOtp(env, { email: targetEmail, otp, purpose: 'customer_reset_' + customer.phone });
                } catch (e2) {
                    return jsonError(400, err.message);
                }
            } else {
                return jsonError(400, err.message);
            }
        }

        const pinSalt = secureRandomHex(16);
        const pinHash = await deriveSecretHash(newPin, pinSalt);
        await env.DB.prepare('UPDATE customers SET pin = ?, pin_salt = ?, pin_hash = ?, pin_requested_at = NULL, updated_at = ? WHERE phone = ?')
            .bind(newPin, pinSalt, pinHash, new Date().toISOString(), customer.phone).run();
        await saveCredential(env.DB, { role: 'customer', identifier: customer.phone, pin: newPin });
        await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'customer' AND identifier = ?").bind(customer.phone).run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'customer' AND identifier = ?").bind(customer.phone).run();
        return jsonResponse({
            ok: true,
            phone: customer.phone,
            message: `পিন সফলভাবে আপডেট করা হয়েছে! আপনার মোবাইল নম্বর (${customer.phone}) এবং নতুন পিন দিয়ে লগইন করুন।`
        });
    }

    // POST /api/customer/request-admin-pin
    if (path === '/api/customer/request-admin-pin') {
        const body = await readJson(request);
        const phone = String((body && body.phone) || '').trim();
        if (!/^[6-9]\d{9}$/.test(phone)) {
            return jsonError(400, 'বৈধ ১০-সংখ্যার মোবাইল নম্বর দিন (Enter a valid 10-digit mobile number).');
        }
        const customer = await env.DB.prepare('SELECT phone, name FROM customers WHERE phone = ?').bind(phone).first();
        if (!customer) {
            return jsonError(404, 'এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি (Account not found).');
        }
        const now = new Date().toISOString();
        await env.DB.prepare('UPDATE customers SET pin_requested_at = ? WHERE phone = ?')
            .bind(now, phone).run();
        return jsonResponse({
            ok: true,
            message: 'অ্যাডমিনের কাছে আপনার পিন রিসেট রিকোয়েস্ট সফলভাবে জমা হয়েছে। অ্যাডমিন শীঘ্রই আপনার সাথে যোগাযোগ করে পিন জানিয়ে দেবে।'
        });
    }

    if (path === '/api/customer/logout') {
        const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+([a-f0-9]{64})$/i);
        if (match) {
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'customer' AND token_hash = ?")
                .bind(bytesToHex(new Uint8Array(digest))).run();
        }
        return jsonResponse({ ok: true });
    }

    const ownerRequestMatch = path.match(/^\/api\/admin\/owner-requests\/([^/]+)$/);
    if (ownerRequestMatch) {
        const idOrPhone = decodeURIComponent(ownerRequestMatch[1]);
        const body = await readJson(request);
        const status = body?.status || (body?.action === 'approve' ? 'approved' : body?.action === 'reject' ? 'rejected' : null);
        if (!['approved', 'rejected'].includes(status)) {
            return jsonError(400, 'A valid review status (approved or rejected) is required.');
        }

        const req = await env.DB.prepare(
            "SELECT * FROM owner_requests WHERE (id = ? OR owner_phone = ?) AND status = 'pending' LIMIT 1"
        ).bind(idOrPhone, idOrPhone).first();
        if (!req) return jsonError(404, 'Pending owner registration request not found.');

        const now = new Date().toISOString();
        if (status === 'rejected') {
            await env.DB.prepare(
                "UPDATE owner_requests SET status = 'rejected', updated_at = ? WHERE id = ?"
            ).bind(now, req.id).run();
            await recordAdminAudit(env.DB, auth, 'owner_rejected', req.owner_phone);
            return jsonResponse({ ok: true, status: 'rejected' });
        }

        const busId = `BUS_${secureRandomHex(8)}`;
        const pinSalt = secureRandomHex(16);
        const pinHash = await deriveSecretHash(req.pin, pinSalt);
        const answerSalt = secureRandomHex(16);
        const answerHash = await deriveSecretHash(String(req.security_answer || '').toLowerCase(), answerSalt);

        await env.DB.batch([
            env.DB.prepare(
                `INSERT OR REPLACE INTO owners (
                    phone, name, email, pin, company_name, bus_number, license_doc,
                    security_question, security_answer, status, created_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
            ).bind(req.owner_phone, req.owner_name, req.email || null, req.pin, req.company_name, req.bus_number, req.license_doc || '', req.security_question, req.security_answer, now),
            env.DB.prepare(
                `INSERT OR REPLACE INTO buses (
                    id, name, bus_number, owner_name, owner_phone, owner_email, route,
                    active_routes, stoppages, fare_per_stop, fare_per_km, window_seat_extra, time, fare, total_seats, image, driver_phone,
                    company_name, ticket_terms, emergency_phone, allow_online_payment, allow_cash_payment,
                    approval_status, rejection_reason
                 ) VALUES (?, ?, ?, ?, ?, ?, 'Pingla - Kolkata', '["Pingla - Kolkata"]',
                           '["Pingla","Debra","Kharagpur","Kolaghat","Kolkata"]', 45, 3.5, 30, '06:00 AM', 399, 65, '', '',
                           ?, 'Please arrive 15 minutes before scheduled departure.', ?, 1, 1,
                           'approved', '')`
            ).bind(busId, req.company_name, req.bus_number, req.owner_name, req.owner_phone, req.email || '', req.company_name, req.owner_phone),
            env.DB.prepare(
                `INSERT OR REPLACE INTO portal_credentials (
                    role, identifier, bus_id, pin_salt, pin_hash, security_question,
                    security_answer_salt, security_answer_hash, active, updated_at
                 ) VALUES ('owner', ?, NULL, ?, ?, ?, ?, ?, 1, ?)`
            ).bind(req.owner_phone, pinSalt, pinHash, req.security_question, answerSalt, answerHash, now),
            env.DB.prepare(
                "UPDATE owner_requests SET status = 'approved', updated_at = ? WHERE id = ?"
            ).bind(now, req.id)
        ]);

        await recordAdminAudit(env.DB, auth, 'owner_approved', req.owner_phone, { busId, busNumber: req.bus_number });
        return jsonResponse({ ok: true, status: 'approved', busId });
    }

    if (path === '/api/admin/users') {
        const body = await readJson(request);
        const name = String((body && body.name) || '').trim();
        const phone = String((body && body.phone) || '').trim();
        const pin = String((body && body.pin) || '');
        const permissions = body && body.permissions;
        if (!name || name.length > 80 || !/^[6-9]\d{9}$/.test(phone) ||
            !/^\d{4}$/.test(pin) || !Array.isArray(permissions) || !permissions.length ||
            permissions.some(permission => !adminPermissionKeys.includes(permission))) {
            return jsonError(400, 'Provide a name, mobile, 4-digit PIN, and valid permissions.');
        }
        if (phone === auth.identifier) return jsonError(400, 'Use another mobile number for the administrator account.');
        const now = new Date().toISOString();
        await saveCredential(env.DB, { role: 'admin', identifier: phone, pin });
        await env.DB.prepare(
            `INSERT INTO admin_users (phone, name, permissions, active, created_at, created_by, updated_at)
             VALUES (?, ?, ?, 1, ?, ?, ?)
             ON CONFLICT (phone) DO UPDATE SET name = excluded.name,
                permissions = excluded.permissions, active = 1, updated_at = excluded.updated_at`
        ).bind(phone, name, JSON.stringify([...new Set(permissions)]), now, auth.identifier, now).run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'admin' AND identifier = ?")
            .bind(phone).run();
        await recordAdminAudit(env.DB, auth, 'admin_user_upsert', phone, { permissions });
        return jsonResponse({ ok: true });
    }

    const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUserMatch && request.method === 'POST') {
        const phone = decodeURIComponent(adminUserMatch[1]);
        const body = await readJson(request);
        if (!/^[6-9]\d{9}$/.test(phone) || !body || typeof body.active !== 'boolean') {
            return jsonError(400, 'A valid administrator mobile number and active flag are required.');
        }
        const result = await env.DB.prepare('UPDATE admin_users SET active = ?, updated_at = ? WHERE phone = ?')
            .bind(body.active ? 1 : 0, new Date().toISOString(), phone).run();
        if (!result.meta?.changes) return jsonError(404, 'Administrator account not found.');
        if (!body.active) {
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'admin' AND identifier = ?")
                .bind(phone).run();
        }
        await recordAdminAudit(env.DB, auth, body.active ? 'admin_user_enabled' : 'admin_user_disabled', phone);
        return jsonResponse({ ok: true });
    }

    if (path === '/api/admin/operator-finance') {
        const body = await readJson(request);
        const ownerPhone = String((body && body.ownerPhone) || '').trim();
        const mode = body && body.commissionMode;
        const value = Number(body && body.commissionValue);
        if (!/^[6-9]\d{9}$/.test(ownerPhone) || !['percentage', 'fixed'].includes(mode) ||
            !Number.isFinite(value) || value < 0 || (mode === 'percentage' && value > 100)) {
            return jsonError(400, 'Provide an owner mobile, commission mode, and valid commission value.');
        }
        const owner = await env.DB.prepare('SELECT owner_phone FROM buses WHERE owner_phone = ? LIMIT 1')
            .bind(ownerPhone).first();
        if (!owner) return jsonError(404, 'No operator found for that mobile number.');
        await env.DB.prepare(
            `INSERT INTO operator_financial_settings (owner_phone, commission_mode, commission_value, updated_at, updated_by)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (owner_phone) DO UPDATE SET commission_mode = excluded.commission_mode,
                commission_value = excluded.commission_value, updated_at = excluded.updated_at,
                updated_by = excluded.updated_by`
        ).bind(ownerPhone, mode, value, new Date().toISOString(), auth.identifier).run();
        await recordAdminAudit(env.DB, auth, 'operator_commission_updated', ownerPhone, {
            commissionMode: mode,
            commissionValue: value
        });
        return jsonResponse({ ok: true });
    }

    const financeMatch = path.match(/^\/api\/admin\/finance\/([^/]+)$/);
    if (financeMatch) {
        const bookingId = decodeURIComponent(financeMatch[1]);
        const body = await readJson(request);
        const paymentStatus = body && body.paymentStatus;
        const note = String((body && body.note) || '').trim().slice(0, 500);
        if (!['pending', 'received', 'refund_requested', 'refunded', 'settled'].includes(paymentStatus)) {
            return jsonError(400, 'Select a valid payment or settlement status.');
        }
        const existing = await env.DB.prepare(
            'SELECT payment_status FROM booking_financials WHERE booking_id = ?'
        ).bind(bookingId).first();
        const currentStatus = existing ? existing.payment_status : 'pending';
        const allowedTransitions = {
            pending: ['pending', 'received'],
            received: ['received', 'refund_requested', 'settled'],
            refund_requested: ['refund_requested', 'received', 'refunded'],
            settled: ['settled', 'refund_requested'],
            refunded: ['refunded']
        };
        if (!allowedTransitions[currentStatus]?.includes(paymentStatus)) {
            return jsonError(409, `Cannot change payment status from ${currentStatus} to ${paymentStatus}.`);
        }
        const booking = await env.DB.prepare(
            `SELECT b.id, b.fare, bs.owner_phone, COALESCE(bs.company_name, bs.owner_name || ' Travels') AS company_name
             FROM bookings b JOIN buses bs ON (bs.id = b.bus_id OR (bs.id || '_RETURN') = b.bus_id) WHERE b.id = ?`
        ).bind(bookingId).first();
        if (!booking) return jsonError(404, 'Booking not found.');
        const setting = await env.DB.prepare(
            'SELECT commission_mode, commission_value FROM operator_financial_settings WHERE owner_phone = ?'
        ).bind(booking.owner_phone).first();
        const value = setting ? setting.commission_value : 0;
        const commission = paymentStatus === 'settled'
            ? Math.min(booking.fare, setting && setting.commission_mode === 'fixed' ? value : booking.fare * value / 100)
            : 0;
        const operatorAmount = paymentStatus === 'settled' ? Math.max(0, booking.fare - commission) : 0;
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO booking_financials
                (booking_id, owner_phone, company_name, amount, payment_status, commission_amount, operator_amount, note, updated_at, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (booking_id) DO UPDATE SET payment_status = excluded.payment_status,
                commission_amount = excluded.commission_amount, operator_amount = excluded.operator_amount,
                note = excluded.note, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
        ).bind(
            bookingId, booking.owner_phone, booking.company_name, booking.fare, paymentStatus,
            commission, operatorAmount, note, now, auth.identifier
        ).run();
        await recordAdminAudit(env.DB, auth, 'booking_finance_updated', bookingId, {
            paymentStatus,
            commission,
            operatorAmount
        });
        return jsonResponse({ ok: true, paymentStatus, commissionAmount: commission, operatorAmount });
    }

    // POST /api/owner/captains
    if (path === '/api/owner/captains') {
        const body = await readJson(request);
        const { busId, name, phone, pin } = body || {};
        if (!busId || !name || !phone || !pin) return jsonError(400, 'Bus, Name, Phone, and PIN required.');
        if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4}$/.test(pin)) return jsonError(400, 'Valid 10-digit phone and 4-digit PIN required.');
        const cleanPhone = String(phone).trim();
        const cleanName = String(name).trim();
        if (cleanName.length < 2 || cleanName.length > 80) return jsonError(400, 'Enter a captain name between 2 and 80 characters.');
        const bus = await env.DB.prepare('SELECT id, driver_phone FROM buses WHERE id = ? AND owner_phone = ?')
            .bind(busId, auth.identifier).first();
        if (!bus) return jsonError(404, 'Bus not found.');
        const existingAssignment = await env.DB.prepare(
            "SELECT bus_id FROM portal_credentials WHERE role = 'captain' AND identifier = ?"
        ).bind(cleanPhone).first();
        if (existingAssignment && existingAssignment.bus_id !== busId) {
            return jsonError(409, 'This captain mobile number is already assigned to another bus.');
        }
        if (bus.driver_phone && bus.driver_phone !== cleanPhone) {
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND bus_id = ?")
                .bind(busId).run();
            await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'captain' AND bus_id = ?")
                .bind(busId).run();
        }
        const now = new Date().toISOString();
        const captainId = `CAPT_${busId}_${cleanPhone.slice(-4)}`;
        await env.DB.prepare(
            `INSERT INTO captains (id, bus_id, name, phone, pin, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)
             ON CONFLICT (id) DO UPDATE SET bus_id = excluded.bus_id, name = excluded.name, pin = excluded.pin, active = 1, updated_at = excluded.updated_at`
        ).bind(captainId, busId, cleanName, cleanPhone, pin.trim(), now, now).run();

        await env.DB.prepare('UPDATE buses SET driver_phone = ?, driver_name = ? WHERE id = ?')
            .bind(cleanPhone, cleanName, busId).run();
        await saveCredential(env.DB, { role: 'captain', identifier: cleanPhone, busId, pin: pin.trim() });
        return jsonResponse({ ok: true, captainId: busId });
    }

    // POST /api/admin/captains (Super Admin registering a captain on behalf of a bus owner)
    if (path === '/api/admin/captains') {
        const body = await readJson(request);
        const { busId, name, phone, pin } = body || {};
        if (!busId || !name || !phone || !pin) return jsonError(400, 'Bus, Name, Phone, and 4-digit PIN required.');
        if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4}$/.test(pin)) return jsonError(400, 'Valid 10-digit phone and 4-digit PIN required.');
        const cleanPhone = String(phone).trim();
        const cleanName = String(name).trim();
        if (cleanName.length < 2 || cleanName.length > 80) return jsonError(400, 'Enter a captain name between 2 and 80 characters.');

        const bus = await env.DB.prepare('SELECT id, name, bus_number, owner_name, owner_phone, driver_phone FROM buses WHERE id = ?')
            .bind(busId).first();
        if (!bus) return jsonError(404, 'Selected bus not found.');

        const existingAssignment = await env.DB.prepare(
            "SELECT bus_id FROM portal_credentials WHERE role = 'captain' AND identifier = ?"
        ).bind(cleanPhone).first();
        if (existingAssignment && existingAssignment.bus_id !== busId) {
            return jsonError(409, 'This captain mobile number is already assigned to another bus.');
        }

        if (bus.driver_phone && bus.driver_phone !== cleanPhone) {
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND bus_id = ?").bind(busId).run();
            await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'captain' AND bus_id = ?").bind(busId).run();
        }

        const now = new Date().toISOString();
        const captainId = `CAPT_${busId}_${cleanPhone.slice(-4)}`;
        await env.DB.prepare(
            `INSERT INTO captains (id, bus_id, name, phone, pin, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)
             ON CONFLICT (id) DO UPDATE SET bus_id = excluded.bus_id, name = excluded.name, pin = excluded.pin, active = 1, updated_at = excluded.updated_at`
        ).bind(captainId, busId, cleanName, cleanPhone, pin.trim(), now, now).run();

        await env.DB.prepare('UPDATE buses SET driver_phone = ?, driver_name = ? WHERE id = ?')
            .bind(cleanPhone, cleanName, busId).run();

        await saveCredential(env.DB, { role: 'captain', identifier: cleanPhone, busId, pin: pin.trim() });
        return jsonResponse({ ok: true, message: 'Captain registered successfully', captainId, busId });
    }

    // POST /api/admin/impersonate-captain (Admin direct access to any Captain Portal)
    if (path === '/api/admin/impersonate-captain') {
        if (!auth || auth.role !== 'admin') {
            return jsonError(403, 'Administrator access required.');
        }
        const body = await readJson(request);
        const { phone, busId } = body || {};

        let bus = null;
        let captainPhone = String(phone || '').trim();

        if (busId) {
            bus = await env.DB.prepare('SELECT id, name, bus_number, company_name, driver_name, driver_phone, owner_phone FROM buses WHERE id = ?').bind(busId).first();
        }

        if (!bus && captainPhone) {
            bus = await env.DB.prepare('SELECT id, name, bus_number, company_name, driver_name, driver_phone, owner_phone FROM buses WHERE driver_phone = ?').bind(captainPhone).first();
        }

        if (!bus && captainPhone) {
            const captRow = await env.DB.prepare('SELECT * FROM captains WHERE phone = ?').bind(captainPhone).first();
            if (captRow && captRow.bus_id) {
                bus = await env.DB.prepare('SELECT id, name, bus_number, company_name, driver_name, driver_phone, owner_phone FROM buses WHERE id = ?').bind(captRow.bus_id).first();
            }
        }

        if (!bus) {
            return jsonError(404, 'No bus or captain found for the specified details.');
        }

        if (!captainPhone) {
            captainPhone = bus.driver_phone || (bus.owner_phone || '8768447312');
        }

        let captainName = '';
        if (captainPhone) {
            const cpt = await env.DB.prepare('SELECT name FROM captains WHERE phone = ?').bind(captainPhone).first();
            if (cpt && cpt.name) captainName = cpt.name;
        }
        if (!captainName) captainName = bus.driver_name || ((bus.company_name || bus.name) + ' Captain');

        // Create a valid session token in portal_sessions
        const token = secureRandomHex(32);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
        const tokenHash = bytesToHex(new Uint8Array(digest));
        const now = new Date();
        // Ephemeral admin impersonation session (valid for 2 hours)
        const expiresAt = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();

        await env.DB.prepare(
            'INSERT INTO portal_sessions (token_hash, role, identifier, bus_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(tokenHash, 'captain', captainPhone, bus.id, now.toISOString(), expiresAt).run();

        return jsonResponse({
            ok: true,
            token,
            expiresAt,
            captain: {
                id: bus.id,
                name: captainName,
                phone: captainPhone,
                busId: bus.id,
                busName: bus.name,
                busNumber: bus.bus_number,
                companyName: bus.company_name || `${bus.name} Travels`,
                impersonatedByAdmin: true
            }
        });
    }

    // POST /api/admin/impersonate-owner (Admin direct access to any Bus Owner Portal)
    if (path === '/api/admin/impersonate-owner') {
        if (!auth || auth.role !== 'admin') {
            return jsonError(403, 'Administrator access required.');
        }
        const body = await readJson(request);
        const ownerPhone = String(body?.phone || '').trim();
        if (!ownerPhone) {
            return jsonError(400, 'Owner phone number required.');
        }

        let owner = await env.DB.prepare('SELECT phone, name, email, company_name, bus_number FROM owners WHERE phone = ?').bind(ownerPhone).first();
        if (!owner) {
            const bus = await env.DB.prepare('SELECT owner_phone, owner_name, company_name, bus_number, name FROM buses WHERE owner_phone = ?').bind(ownerPhone).first();
            if (bus) {
                owner = {
                    phone: bus.owner_phone,
                    name: bus.owner_name || bus.name,
                    email: '',
                    company_name: bus.company_name || bus.name,
                    bus_number: bus.bus_number
                };
            }
        }

        if (!owner) {
            return jsonError(404, 'Bus owner not found for the specified phone number.');
        }

        // Create a valid session token in portal_sessions
        const token = secureRandomHex(32);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
        const tokenHash = bytesToHex(new Uint8Array(digest));
        const now = new Date();
        // Ephemeral admin impersonation session (valid for 2 hours)
        const expiresAt = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();

        await env.DB.prepare(
            'INSERT INTO portal_sessions (token_hash, role, identifier, bus_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(tokenHash, 'owner', owner.phone, 'ADMIN_IMPERSONATION', now.toISOString(), expiresAt).run();

        return jsonResponse({
            ok: true,
            token,
            expiresAt,
            owner: {
                phone: owner.phone,
                name: owner.name,
                email: owner.email || '',
                companyName: owner.company_name || `${owner.name} Travels`,
                busNumber: owner.bus_number || '',
                impersonatedByAdmin: true
            }
        });
    }

    // POST /api/admin/impersonate-customer (Admin direct access to any Customer Portal without PIN or OTP)
    if (path === '/api/admin/impersonate-customer') {
        if (!auth || auth.role !== 'admin') {
            return jsonError(403, 'Administrator access required.');
        }
        const body = await readJson(request);
        const customerPhone = String(body?.phone || '').trim();
        if (!customerPhone) {
            return jsonError(400, 'Customer phone number required.');
        }

        await ensureCustomerPhotoColumns(env.DB);
        let customer = await env.DB.prepare('SELECT phone, name, email, profile_photo, avatar_preference FROM customers WHERE phone = ?').bind(customerPhone).first();
        if (!customer) {
            const bk = await env.DB.prepare('SELECT passenger_name, passenger_phone FROM bookings WHERE passenger_phone = ? ORDER BY created_at DESC LIMIT 1').bind(customerPhone).first();
            if (bk) {
                customer = {
                    phone: bk.passenger_phone,
                    name: bk.passenger_name || 'Customer',
                    email: ''
                };
            }
        }
        if (!customer) {
            return jsonError(404, 'Customer account not found for this phone number.');
        }

        const token = secureRandomHex(32);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
        const tokenHash = bytesToHex(new Uint8Array(digest));
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();

        await env.DB.prepare(
            'INSERT INTO portal_sessions (token_hash, role, identifier, bus_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(tokenHash, 'customer', customer.phone, 'ADMIN_IMPERSONATION', now.toISOString(), expiresAt).run();

        return jsonResponse({
            ok: true,
            token,
            expiresAt,
            customer: {
                phone: customer.phone,
                name: customer.name,
                email: customer.email || '',
                profilePhoto: customer.profile_photo || '',
                avatarPreference: customer.avatar_preference || 'auto',
                impersonatedByAdmin: true
            }
        });
    }

    // POST /api/admin/customers/photo (Admin view/upload/change/reset customer profile photo)
    if (path === '/api/admin/customers/photo') {
        if (!auth || auth.role !== 'admin') {
            return jsonError(403, 'Administrator access required.');
        }
        await ensureCustomerPhotoColumns(env.DB);
        const body = await readJson(request);
        const phone = String(body?.phone || '').trim();
        if (!/^[6-9]\d{9}$/.test(phone)) {
            return jsonError(400, 'বৈধ ১০-সংখ্যার কাস্টমার মোবাইল নম্বর দিন।');
        }
        const existing = await env.DB.prepare(
            'SELECT phone, name, profile_photo, avatar_preference FROM customers WHERE phone = ?'
        ).bind(phone).first();
        if (!existing) return jsonError(404, 'কাস্টমার অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');

        const clearPhoto = Boolean(body?.clearPhoto);
        let nextPhoto = existing.profile_photo || '';
        if (clearPhoto) {
            nextPhoto = '';
        } else if (body?.profilePhoto !== undefined) {
            const check = sanitizeProfilePhotoInput(body.profilePhoto);
            if (!check.ok) return jsonError(400, check.error);
            nextPhoto = check.value;
        }

        const rawPref = String(body?.avatarPreference || (body?.profilePhoto ? 'custom' : (clearPhoto ? 'auto' : (existing.avatar_preference || 'auto')))).trim().toLowerCase();
        const allowedPrefs = new Set(['auto', 'male', 'female', 'custom']);
        let nextPref = allowedPrefs.has(rawPref) ? rawPref : 'auto';
        if (nextPref === 'custom' && !nextPhoto) nextPref = 'auto';

        const now = new Date().toISOString();
        await env.DB.prepare(
            'UPDATE customers SET profile_photo = ?, avatar_preference = ?, updated_at = ? WHERE phone = ?'
        ).bind(nextPhoto, nextPref, now, phone).run();

        try {
            await logAdminAudit(env.DB, auth.identifier, 'CUSTOMER_PHOTO_UPDATE', phone, {
                hasCustomPhoto: Boolean(nextPhoto),
                avatarPreference: nextPref
            });
        } catch (_) {}

        return jsonResponse({
            ok: true,
            phone,
            profilePhoto: nextPhoto,
            avatarPreference: nextPref,
            message: clearPhoto ? 'কাস্টমারের কাস্টম ফটো মুছে ফেলা হয়েছে।' : 'কাস্টমারের প্রোফাইল ফটো সফলভাবে আপডেট হয়েছে!'
        });
    }

    // POST /api/admin/customers/edit (Admin edit customer name, mobile number, email)
    if (path === '/api/admin/customers/edit') {
        if (!auth || auth.role !== 'admin') {
            return jsonError(403, 'Administrator access required.');
        }
        const body = await readJson(request);
        const oldPhone = String(body?.oldPhone || '').trim();
        const newPhone = String(body?.phone || '').trim();
        const newName = String(body?.name || '').trim();
        const newEmail = String(body?.email || '').trim().toLowerCase();

        if (!/^[6-9]\d{9}$/.test(oldPhone)) {
            return jsonError(400, 'বৈধ পূর্ববর্তী ১০-সংখ্যার মোবাইল নম্বর দিন।');
        }
        if (!/^[6-9]\d{9}$/.test(newPhone)) {
            return jsonError(400, 'বৈধ নতুন ১০-সংখ্যার মোবাইল নম্বর দিন।');
        }
        if (!newName || newName.length < 2) {
            return jsonError(400, 'যাত্রীর সঠিক নাম প্রদান করুন (কমপক্ষে ২ অক্ষর)।');
        }

        const existingCust = await env.DB.prepare('SELECT phone, name, email FROM customers WHERE phone = ?').bind(oldPhone).first();
        if (!existingCust) {
            return jsonError(404, 'যাত্রী অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
        }

        const now = new Date().toISOString();

        if (newPhone !== oldPhone) {
            const conflict = await env.DB.prepare('SELECT phone FROM customers WHERE phone = ?').bind(newPhone).first();
            if (conflict) {
                return jsonError(409, 'এই মোবাইল নম্বরে ইতিমধ্যেই একটি কাস্টমার অ্যাকাউন্ট রয়েছে। অন্য মোবাইল নম্বর দিন।');
            }

            // Update customers table (phone, name, email, updated_at)
            await env.DB.prepare(
                'UPDATE customers SET phone = ?, name = ?, email = ?, updated_at = ? WHERE phone = ?'
            ).bind(newPhone, newName, newEmail || null, now, oldPhone).run();

            // Update portal_credentials
            await env.DB.prepare(
                'UPDATE portal_credentials SET identifier = ?, updated_at = ? WHERE role = ? AND identifier = ?'
            ).bind(newPhone, now, 'customer', oldPhone).run();

            // Update portal_sessions
            await env.DB.prepare(
                'UPDATE portal_sessions SET identifier = ? WHERE role = ? AND identifier = ?'
            ).bind(newPhone, 'customer', oldPhone).run();

            // Update user_login_devices
            await env.DB.prepare(
                'UPDATE user_login_devices SET identifier = ? WHERE role = ? AND identifier = ?'
            ).bind(newPhone, 'customer', oldPhone).run();

            // Update bookings
            await env.DB.prepare(
                'UPDATE bookings SET passenger_phone = ?, passenger_name = ? WHERE passenger_phone = ?'
            ).bind(newPhone, newName, oldPhone).run();

            // Update access_control_list if exists
            await env.DB.prepare(
                'UPDATE access_control_list SET phone = ? WHERE phone = ?'
            ).bind(newPhone, oldPhone).run();
        } else {
            // Phone is unchanged, only name/email changed
            await env.DB.prepare(
                'UPDATE customers SET name = ?, email = ?, updated_at = ? WHERE phone = ?'
            ).bind(newName, newEmail || null, now, oldPhone).run();

            // Update bookings passenger_name
            await env.DB.prepare(
                'UPDATE bookings SET passenger_name = ? WHERE passenger_phone = ?'
            ).bind(newName, oldPhone).run();
        }

        return jsonResponse({
            ok: true,
            message: 'যাত্রীর তথ্য সফলভাবে আপডেট করা হয়েছে!',
            customer: {
                phone: newPhone,
                name: newName,
                email: newEmail
            }
        });
    }

    const captainUpdateMatch = path.match(/^\/api\/(owner|admin)\/captains\/([^/]+)$/);
    if (captainUpdateMatch) {
        const role = captainUpdateMatch[1];
        const busId = decodeURIComponent(captainUpdateMatch[2]);
        const body = await readJson(request);
        const bus = await env.DB.prepare(
            `SELECT id, driver_phone FROM buses WHERE id = ? ${role === 'owner' ? 'AND owner_phone = ?' : ''}`
        ).bind(...(role === 'owner' ? [busId, auth.identifier] : [busId])).first();
        if (!bus || !bus.driver_phone) return jsonError(404, 'Captain account not found.');

        if (typeof body?.toggleActive === 'boolean') {
            const result = await env.DB.prepare(
                `UPDATE portal_credentials SET active = ?, updated_at = ?
                 WHERE role = 'captain' AND identifier = ? AND bus_id = ?`
            ).bind(body.toggleActive ? 1 : 0, new Date().toISOString(), bus.driver_phone, bus.id).run();
            await env.DB.prepare(
                `UPDATE captains SET active = ?, updated_at = ? WHERE bus_id = ? AND phone = ?`
            ).bind(body.toggleActive ? 1 : 0, new Date().toISOString(), bus.id, bus.driver_phone).run();

            if (!result.meta?.changes) return jsonError(404, 'Captain account not found.');
            if (!body.toggleActive) {
                await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?")
                    .bind(bus.driver_phone).run();
            }
            return jsonResponse({ ok: true, active: body.toggleActive });
        }
        if (body?.pin !== undefined) {
            const pin = String(body.pin).trim();
            if (!/^\d{4}$/.test(pin)) return jsonError(400, 'Captain PIN must be exactly 4 digits.');
            const pinSalt = secureRandomHex(16);
            const pinHash = await deriveSecretHash(pin, pinSalt);
            const result = await env.DB.prepare(
                `UPDATE portal_credentials SET pin_salt = ?, pin_hash = ?, updated_at = ?
                 WHERE role = 'captain' AND identifier = ? AND bus_id = ?`
            ).bind(pinSalt, pinHash, new Date().toISOString(), bus.driver_phone, bus.id).run();
            await env.DB.prepare(
                `UPDATE captains SET pin = ?, updated_at = ? WHERE bus_id = ? AND phone = ?`
            ).bind(pin, new Date().toISOString(), bus.id, bus.driver_phone).run();

            if (!result.meta?.changes) return jsonError(404, 'Captain account not found.');
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?")
                .bind(bus.driver_phone).run();
            return jsonResponse({ ok: true });
        }
        if (body?.name !== undefined) {
            const name = String(body.name).trim();
            if (name.length < 2 || name.length > 80) return jsonError(400, 'Enter a captain name between 2 and 80 characters.');
            await env.DB.prepare('UPDATE buses SET driver_name = ? WHERE id = ?')
                .bind(name, bus.id).run();
            return jsonResponse({ ok: true });
        }
        return jsonError(400, 'Captain status, PIN, or name update is required.');
    }

    if (path === '/api/auth/login' || path === '/api/owner/login') {
        const body = await readJson(request);
        const role = (path === '/api/owner/login') ? 'owner' : (body && body.role);
        const identifier = String((body && (body.identifier || body.phone || body.username || body.user)) || '').trim().toLowerCase();
        const pin = String((body && (body.pin || body.password)) || '');
        if (!['admin', 'owner', 'captain'].includes(role)) {
            return jsonError(400, 'A valid role is required.');
        }
        if (role === 'admin') {
            if (!pin || pin.length < 4 || pin.length > 64) {
                return jsonError(400, 'Admin password must be between 4 and 64 characters.');
            }
        } else {
            if (!/^\d{4}$/.test(pin)) {
                return jsonError(400, 'A valid 4-digit PIN is required.');
            }
        }
        if (role === 'admin' && identifier !== 'admin' && identifier !== 'support.busyatra@gmail.com' && !/^[6-9]\d{9}$/.test(identifier)) {
            return jsonError(400, 'Enter the administrator username, email, or mobile number.');
        }
        if (role !== 'admin' && !/^[6-9]\d{9}$/.test(identifier)) {
            return jsonError(400, 'Enter a valid 10-digit mobile number.');
        }
        const flags = await getFeatureFlags(env.DB);
        if (role === 'captain' && !flags.captainPortal) {
            return jsonError(403, 'The captain portal is currently disabled.');
        }

        if (role === 'owner') {
            // Check Access Control List (Suspended or Permanently Banned)
            try {
                const acl = await env.DB.prepare('SELECT status, reason FROM access_control_list WHERE phone = ?').bind(identifier).first();
                if (acl) {
                    if (acl.status === 'permanently_banned') {
                        return jsonError(403, '⛔ এই মোবাইল নম্বরটি স্থায়ীভাবে নিষিদ্ধ (Permanently Banned) করা হয়েছে।');
                    }
                    if (acl.status === 'suspended' || acl.status === 'blocked') {
                        return jsonError(403, `⚠️ আপনার বাস মালিক অ্যাকাউন্টটি সাময়িকভাবে স্থগিত (Suspended) রয়েছে। ${acl.reason ? 'কারণ: ' + acl.reason : 'বকেয়া সাবস্ক্রিপশন চার্জ বাকি রয়েছে।'} অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।`);
                    }
                }
            } catch (ae) {}

            const owner = await env.DB.prepare(
                'SELECT phone, name, pin, company_name, bus_number, status, security_question FROM owners WHERE phone = ?'
            ).bind(identifier).first();
            if (!owner) {
                const req = await env.DB.prepare(
                    'SELECT status FROM owner_requests WHERE owner_phone = ?'
                ).bind(identifier).first();
                if (req && req.status === 'pending') {
                    return jsonError(403, 'আপনার অ্যাকাউন্টটি এখনও অ্যাডমিন অনুমোদনের অপেক্ষায় রয়েছে (Pending Approval)। অ্যাডমিন অনুমোদন করলে লগইন করতে পারবেন।');
                }
                if (req && req.status === 'rejected') {
                    return jsonError(403, 'আপনার অ্যাকাউন্ট রিকোয়েস্টটি অ্যাডমিন দ্বারা বাতিল করা হয়েছে।');
                }
                return jsonError(404, 'এই নম্বরে কোনো বাস ওনার অ্যাকাউন্ট নেই। অনুগ্রহ করে প্রথমে রেজিস্ট্রেশন করুন।');
            }
            if (owner.status !== 'active') {
                return jsonError(403, 'আপনার ওনার অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।');
            }
            const ownerLock = await env.DB.prepare(
                "SELECT locked_until FROM portal_login_attempts WHERE role = 'owner' AND identifier = ?"
            ).bind(identifier).first();
            if (ownerLock && ownerLock.locked_until && ownerLock.locked_until > new Date().toISOString()) {
                return jsonError(429, 'অনেকবার ভুল পিন দেওয়া হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন। (Too many failed attempts. Try again in 15 minutes.)');
            }
            const ownerCred = await env.DB.prepare(
                "SELECT * FROM portal_credentials WHERE role = 'owner' AND identifier = ?"
            ).bind(identifier).first();
            let ownerPinOk = false;
            if (ownerCred && ownerCred.pin_salt && ownerCred.pin_hash) {
                const ownerHash = await deriveSecretHash(pin, ownerCred.pin_salt);
                ownerPinOk = constantTimeEqual(ownerHash, ownerCred.pin_hash);
            } else if (owner.pin && owner.pin === pin) {
                ownerPinOk = true;
                await saveCredential(env.DB, { role: 'owner', identifier, pin });
            }
            if (!ownerPinOk) {
                if (await recordFailedLogin(env.DB, 'owner', identifier)) {
                    return jsonError(429, 'অনেকবার ভুল পিন দেওয়া হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন। (Too many failed attempts. Try again in 15 minutes.)');
                }
                return jsonError(401, 'ভুল পিন (Invalid PIN)। সঠিক ৪-ডিজিটের পিন দিন।');
            }
            await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'owner' AND identifier = ?").bind(identifier).run();
            const token = secureRandomHex(32);
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
            const tokenHash = bytesToHex(new Uint8Array(digest));
            const now = new Date();
            // Standard owner session (valid for 30 days)
            const expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
            await env.DB.prepare(
                'INSERT INTO portal_sessions (token_hash, role, identifier, bus_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(tokenHash, 'owner', identifier, null, now.toISOString(), expiresAt).run();

            const devInfo = extractDeviceInfo(request, body);
            await recordUserLoginDevice(env.DB, 'owner', identifier, owner.name, devInfo);

            return jsonResponse({
                token,
                expiresAt,
                owner: {
                    name: owner.name,
                    phone: owner.phone,
                    companyName: owner.company_name,
                    busNumber: owner.bus_number
                },
                securityConfigured: Boolean(owner.security_question)
            });
        }

        if (role === 'captain') {
            // Check Access Control List for Captain
            try {
                const captAcl = await env.DB.prepare('SELECT status, reason FROM access_control_list WHERE phone = ?').bind(identifier).first();
                if (captAcl) {
                    if (captAcl.status === 'permanently_banned') {
                        return jsonError(403, '⛔ এই ক্যাপ্টেন নম্বরটি স্থায়ীভাবে নিষিদ্ধ (Permanently Banned) করা হয়েছে।');
                    }
                    if (captAcl.status === 'suspended' || captAcl.status === 'blocked') {
                        return jsonError(403, '⚠️ আপনার ক্যাপ্টেন অ্যাকাউন্টটি সাময়িকভাবে স্থগিত রয়েছে।');
                    }
                }
            } catch (ce) {}

            const captainLock = await env.DB.prepare(
                "SELECT locked_until FROM portal_login_attempts WHERE role = 'captain' AND identifier = ?"
            ).bind(identifier).first();
            if (captainLock && captainLock.locked_until && captainLock.locked_until > new Date().toISOString()) {
                return jsonError(429, 'অনেকবার ভুল পিন দেওয়া হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন। (Too many failed attempts. Try again in 15 minutes.)');
            }
            const captainRow = await env.DB.prepare(
                'SELECT * FROM captains WHERE phone = ?'
            ).bind(identifier).first();
            let bus = null;
            if (captainRow) {
                if (!captainRow.active) {
                    return jsonError(403, 'আপনার ক্যাপ্টেন অ্যাকাউন্টটি বাস ওনার দ্বারা নিষ্ক্রিয় করা হয়েছে।');
                }
                const captCred = await env.DB.prepare(
                    "SELECT * FROM portal_credentials WHERE role = 'captain' AND identifier = ?"
                ).bind(identifier).first();
                let captPinOk = false;
                if (captCred && captCred.pin_salt && captCred.pin_hash) {
                    const captHash = await deriveSecretHash(pin, captCred.pin_salt);
                    captPinOk = constantTimeEqual(captHash, captCred.pin_hash);
                } else if (captainRow.pin && captainRow.pin === pin) {
                    captPinOk = true;
                    await saveCredential(env.DB, { role: 'captain', identifier, busId: captainRow.bus_id, pin });
                }
                if (!captPinOk) {
                    if (await recordFailedLogin(env.DB, 'captain', identifier)) {
                        return jsonError(429, 'অনেকবার ভুল পিন দেওয়া হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন। (Too many failed attempts. Try again in 15 minutes.)');
                    }
                    return jsonError(401, 'ভুল পিন (Invalid PIN)। সঠিক ৪-ডিজিটের পিন দিন।');
                }
                await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'captain' AND identifier = ?").bind(identifier).run();
                bus = await env.DB.prepare(
                    'SELECT id, name, bus_number, company_name, driver_name, owner_phone FROM buses WHERE id = ?'
                ).bind(captainRow.bus_id).first();
            } else {
                const result = await authenticateWithPin(env.DB, role, identifier, pin);
                if (result.error) return result.error;
                bus = await env.DB.prepare(
                    'SELECT id, name, bus_number, company_name, driver_name, owner_phone FROM buses WHERE id = ? AND driver_phone = ?'
                ).bind(result.identity.busId, identifier).first();
            }
            if (!bus) {
                bus = await env.DB.prepare(
                    'SELECT id, name, bus_number, company_name, driver_name, owner_phone FROM buses WHERE driver_phone = ?'
                ).bind(identifier).first();
            }
            if (!bus) return jsonError(403, 'This captain account has no assigned bus.');

            // Check if bus owner is suspended / banned
            if (bus && bus.owner_phone) {
                try {
                    const ownerAcl = await env.DB.prepare('SELECT status, reason FROM access_control_list WHERE phone = ?').bind(bus.owner_phone).first();
                    if (ownerAcl && (ownerAcl.status === 'suspended' || ownerAcl.status === 'blocked' || ownerAcl.status === 'permanently_banned')) {
                        return jsonError(403, '⚠️ আপনার বাস মালিকের অ্যাকাউন্ট সাময়িকভাবে স্থগিত/ব্যান থাকায় ক্যাপ্টেন লগইন বন্ধ রয়েছে। মালিকের সাথে যোগাযোগ করুন।');
                    }
                } catch (oe) {}
            }

            const token = secureRandomHex(32);
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
            const tokenHash = bytesToHex(new Uint8Array(digest));
            const now = new Date();
            // Standard owner session (valid for 30 days)
            const expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
            await env.DB.prepare(
                'INSERT INTO portal_sessions (token_hash, role, identifier, bus_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(tokenHash, 'captain', identifier, bus.id, now.toISOString(), expiresAt).run();

            const captName = (captainRow && captainRow.name) || bus.driver_name || ((bus.company_name || bus.name) + ' Captain');
            const devInfo = extractDeviceInfo(request, body);
            await recordUserLoginDevice(env.DB, 'captain', identifier, captName, devInfo);

            return jsonResponse({
                token,
                expiresAt,
                captain: {
                    id: bus.id,
                    name: captName,
                    phone: identifier,
                    busId: bus.id,
                    busName: bus.name,
                    busNumber: bus.bus_number
                }
            });
        }

        if (role === 'admin') {
            if (identifier === 'admin' || identifier === 'support.busyatra@gmail.com') {
                const adminCred = await env.DB.prepare(
                    "SELECT * FROM portal_credentials WHERE role = 'admin' AND (identifier = 'admin' OR identifier = 'support.busyatra@gmail.com')"
                ).first();
                if (!adminCred) {
                    await saveCredential(env.DB, { role: 'admin', identifier: 'admin', pin: '1234' });
                }
            }
        }
        const adminPermissions = role === 'admin' ? await getAdminPermissions(env.DB, identifier) : null;
        if (role === 'admin' && !adminPermissions) {
            return jsonError(403, 'This administrator account is disabled or not configured.');
        }
        const result = await authenticateWithPin(env.DB, role, identifier, pin);
        if (result.error) return result.error;

        if (role === 'admin') {
            const devInfo = extractDeviceInfo(request, body);
            await recordUserLoginDevice(env.DB, 'admin', identifier, 'Super Admin', devInfo);
        }

        const response = { token: result.session.token, expiresAt: result.session.expiresAt };
        if (role === 'admin') response.permissions = adminPermissions;
        return jsonResponse(response);
    }

    // GET /api/auth/admin/status
    if (path === '/api/auth/admin/status') {
        const cred = await env.DB.prepare(
            "SELECT security_question, security_answer_salt, security_answer_hash FROM portal_credentials WHERE role = 'admin' AND identifier = 'support.busyatra@gmail.com'"
        ).first() || await env.DB.prepare(
            "SELECT security_question, security_answer_salt, security_answer_hash FROM portal_credentials WHERE role = 'admin' AND identifier = 'admin'"
        ).first();
        const isSetup = Boolean(cred && cred.security_question && cred.security_answer_hash);
        return jsonResponse({
            ok: true,
            email: 'support.busyatra@gmail.com',
            isSetup,
            securityQuestion: (cred && cred.security_question) || 'Primary route?'
        });
    }

    // POST /api/auth/send-otp
    if (path === '/api/auth/send-otp') {
        const body = await readJson(request);
        const role = String((body && body.role) || '').trim();
        let email = String((body && body.email) || '').trim().toLowerCase();
        const purpose = String((body && body.purpose) || 'login').trim();
        if (role === 'admin') {
            email = 'support.busyatra@gmail.com';
        }
        if (!email || !email.includes('@')) {
            return jsonError(400, 'বৈধ ইমেইল ঠিকানা প্রদান করুন (Enter a valid email address).');
        }
        try {
            const result = await sendEmailOtp(env, { email, role, purpose });
            return jsonResponse(result);
        } catch (err) {
            return jsonError(400, err.message);
        }
    }

    // POST /api/auth/admin/otp-setup
    if (path === '/api/auth/admin/otp-setup') {
        const body = await readJson(request);
        const otp = String((body && body.otp) || '').trim();
        const pin = String((body && (body.pin || body.newPin)) || '').trim();
        const question = String((body && body.securityQuestion) || '').trim();
        const answer = String((body && body.securityAnswer) || '').trim();
        if (!otp || !/^\d{4,64}$/.test(pin) || !question || !answer) {
            return jsonError(400, 'ওটিপি, ৪-সংখ্যার পিন, সিকিউরিটি প্রশ্ন ও উত্তর সঠিকভাবে পূরণ করুন (OTP, PIN, Security Question and Answer required).');
        }
        try {
            await verifyEmailOtp(env, { email: 'support.busyatra@gmail.com', otp, purpose: 'admin_setup' });
        } catch (err) {
            return jsonError(400, err.message);
        }
        const targets = ['admin', '7585979791', '8768447312', 'support.busyatra@gmail.com'];
        for (const target of targets) {
            await saveCredential(env.DB, {
                role: 'admin',
                identifier: target,
                pin,
                securityQuestion: question,
                securityAnswer: answer
            });
        }
        await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'admin'").run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'admin'").run();
        const session = await createPortalSession(env.DB, { role: 'admin', identifier: 'support.busyatra@gmail.com' });
        return jsonResponse({
            ok: true,
            token: session.token,
            expiresAt: session.expiresAt,
            permissions: ['all', ...adminPermissionKeys],
            message: 'অ্যাডমিন সিকিউরিটি সেটআপ সফলভাবে সম্পন্ন হয়েছে!'
        });
    }

    // POST /api/auth/admin/reset-by-otp
    if (path === '/api/auth/admin/reset-by-otp') {
        const body = await readJson(request);
        const otp = String((body && body.otp) || '').trim();
        const pin = String((body && (body.pin || body.newPin)) || '').trim();
        if (!otp || !/^\d{4,64}$/.test(pin)) {
            return jsonError(400, 'ওটিপি এবং নতুন পিন প্রদান করুন (Enter valid OTP and new PIN).');
        }
        try {
            await verifyEmailOtp(env, { email: 'support.busyatra@gmail.com', otp, purpose: 'admin_reset' });
        } catch (err) {
            return jsonError(400, err.message);
        }
        const targets = ['admin', '7585979791', '8768447312', 'support.busyatra@gmail.com'];
        for (const target of targets) {
            await saveCredential(env.DB, { role: 'admin', identifier: target, pin });
        }
        await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'admin'").run();
        await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'admin-recovery'").run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'admin'").run();
        const session = await createPortalSession(env.DB, { role: 'admin', identifier: 'support.busyatra@gmail.com' });
        return jsonResponse({
            ok: true,
            token: session.token,
            expiresAt: session.expiresAt,
            permissions: ['all', ...adminPermissionKeys],
            message: 'পিন সফলভাবে আপডেট হয়েছে এবং লগইন সম্পন্ন হয়েছে!'
        });
    }

    if (path === '/api/auth/admin/setup') {
        const body = await readJson(request);
        if (!env.ADMIN_SETUP_KEY || env.ADMIN_SETUP_KEY.length < 32) {
            return jsonError(503, 'Configure ADMIN_SETUP_KEY with at least 32 characters before admin setup.');
        }
        const setupIdentifier = request.headers.get('CF-Connecting-IP') || 'unknown';
        const setupLock = await env.DB.prepare(
            "SELECT locked_until FROM portal_login_attempts WHERE role = 'admin-setup' AND identifier = ?"
        ).bind(setupIdentifier).first();
        if (setupLock && setupLock.locked_until && setupLock.locked_until > new Date().toISOString()) {
            return jsonError(429, 'Too many setup attempts. Try again in 15 minutes.');
        }
        if (!body || !constantTimeEqual(String(body.setupKey || ''), env.ADMIN_SETUP_KEY)) {
            await recordFailedLogin(env.DB, 'admin-setup', setupIdentifier);
            return jsonError(403, 'The admin setup key is invalid.');
        }
        if (!/^\d{4}$/.test(String(body.pin || '')) ||
            typeof body.securityQuestion !== 'string' || body.securityQuestion.trim().length < 5 ||
            typeof body.securityAnswer !== 'string' || body.securityAnswer.trim().length < 3) {
            return jsonError(400, 'Set a 4-digit PIN, a recovery question, and an answer.');
        }
        const configured = await env.DB.prepare(
            "SELECT identifier FROM portal_credentials WHERE role = 'admin' AND identifier = 'admin'"
        ).first();
        if (configured) return jsonError(409, 'Admin setup has already been completed.');
        try {
            const pinSalt = secureRandomHex(16);
            const pinHash = await deriveSecretHash(body.pin, pinSalt);
            const securityAnswerSalt = secureRandomHex(16);
            const securityAnswerHash = await deriveSecretHash(body.securityAnswer.trim().toLowerCase(), securityAnswerSalt);
            await env.DB.prepare(
                `INSERT INTO portal_credentials (
                    role, identifier, pin_salt, pin_hash, security_question,
                    security_answer_salt, security_answer_hash, updated_at
                 ) VALUES ('admin', 'admin', ?, ?, ?, ?, ?, ?)`
            ).bind(
                pinSalt, pinHash, body.securityQuestion.trim(), securityAnswerSalt,
                securityAnswerHash, new Date().toISOString()
            ).run();
        } catch (error) {
            if (/UNIQUE|constraint/i.test(error.message || '')) {
                return jsonError(409, 'Admin setup has already been completed.');
            }
            throw error;
        }
        const session = await createPortalSession(env.DB, { role: 'admin', identifier: 'admin' });
        return jsonResponse({ token: session.token, expiresAt: session.expiresAt });
    }

    if (path === '/api/auth/admin/reset') {
        const body = await readJson(request);
        const newPin = String((body && (body.pin || body.newPassword || body.newPin)) || '').trim();
        if (!body || newPin.length < 4 || newPin.length > 64 || !body.answer) {
            return jsonError(400, 'A recovery answer and new password (min 4 characters) are required.');
        }
        const credential = await env.DB.prepare(
            "SELECT * FROM portal_credentials WHERE role = 'admin' AND (identifier = 'support.busyatra@gmail.com' OR identifier = 'admin')"
        ).first();
        if (!credential) return jsonError(404, 'Admin account is not configured.');
        const lock = await env.DB.prepare(
            "SELECT locked_until FROM portal_login_attempts WHERE role = 'admin-recovery' AND identifier = 'admin'"
        ).first();
        if (lock && lock.locked_until && lock.locked_until > new Date().toISOString()) {
            return jsonError(429, 'Too many recovery attempts. Try again in 15 minutes.');
        }
        const answerHash = await deriveSecretHash(String(body.answer).trim().toLowerCase(), credential.security_answer_salt);
        if (!constantTimeEqual(answerHash, credential.security_answer_hash || '')) {
            if (await recordFailedLogin(env.DB, 'admin-recovery', 'admin')) {
                return jsonError(429, 'Too many recovery attempts. Try again in 15 minutes.');
            }
            return jsonError(401, 'The recovery answer is incorrect.');
        }
        const targets = ['admin', '7585979791', '8768447312', 'support.busyatra@gmail.com'];
        for (const target of targets) {
            await saveCredential(env.DB, { role: 'admin', identifier: target, pin: newPin });
        }
        await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'admin-recovery' AND identifier = 'admin'").run();
        await env.DB.prepare("DELETE FROM portal_login_attempts WHERE role = 'admin' AND identifier = 'admin'").run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'admin'").run();
        const session = await createPortalSession(env.DB, { role: 'admin', identifier: 'support.busyatra@gmail.com' });
        return jsonResponse({
            ok: true,
            token: session.token,
            expiresAt: session.expiresAt,
            permissions: ['all', ...adminPermissionKeys],
            message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!'
        });
    }

    // POST /api/admin/change-password
    if (path === '/api/admin/change-password') {
        const body = await readJson(request);
        const currentPassword = String((body && (body.currentPassword || body.currentPin)) || '').trim();
        const newPassword = String((body && (body.newPassword || body.newPin || body.password)) || '').trim();
        const securityQuestion = body && body.securityQuestion ? String(body.securityQuestion).trim() : null;
        const securityAnswer = body && body.securityAnswer ? String(body.securityAnswer).trim() : null;

        if (!newPassword || newPassword.length < 6 || newPassword.length > 64) {
            return jsonError(400, 'নতুন পাসওয়ার্ড কমপক্ষে ৬ এবং সর্বোচ্চ ৬৪ অক্ষরের হতে হবে (New password must be 6 to 64 characters).');
        }

        const cred = await env.DB.prepare(
            "SELECT * FROM portal_credentials WHERE role = 'admin' AND identifier = ?"
        ).bind(auth.identifier).first();

        if (cred && cred.pin_salt && cred.pin_hash) {
            if (!currentPassword) {
                return jsonError(400, 'বর্তমান পাসওয়ার্ড প্রদান করুন (Current password is required).');
            }
            const currentHash = await deriveSecretHash(currentPassword, cred.pin_salt);
            if (!constantTimeEqual(currentHash, cred.pin_hash)) {
                return jsonError(401, 'বর্তমান পাসওয়ার্ডটি ভুল (Current password is incorrect).');
            }
        }

        const targets = Array.from(new Set([auth.identifier, 'admin', '7585979791', '8768447312', 'support.busyatra@gmail.com']));
        for (const target of targets) {
            await saveCredential(env.DB, {
                role: 'admin',
                identifier: target,
                pin: newPassword,
                securityQuestion: securityQuestion || (cred ? cred.security_question : null),
                securityAnswer: securityAnswer || null
            });
        }

        await recordAdminAudit(env.DB, auth, 'admin_password_changed', auth.identifier);
        return jsonResponse({ ok: true, message: 'অ্যাডমিন পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে (Admin password updated successfully)!' });
    }

    if (path === '/api/auth/owner/reset' || path === '/api/owner/forgot-pin') {
        const body = await readJson(request);
        const phone = String((body && body.phone) || '').trim();
        const answer = String((body && (body.answer || body.securityAnswer)) || '').trim().toLowerCase();
        const pin = String((body && (body.pin || body.newPin)) || '');
        if (!/^[6-9]\d{9}$/.test(phone) || !answer || !/^\d{4}$/.test(pin)) {
            return jsonError(400, 'Enter the owner mobile number, recovery answer, and a new 4-digit PIN.');
        }
        const lock = await env.DB.prepare(
            "SELECT locked_until FROM portal_login_attempts WHERE role = 'owner-recovery' AND identifier = ?"
        ).bind(phone).first();
        if (lock && lock.locked_until && lock.locked_until > new Date().toISOString()) {
            return jsonError(429, 'Too many recovery attempts. Try again in 15 minutes.');
        }

        let isMatch = false;
        const credential = await env.DB.prepare(
            'SELECT * FROM portal_credentials WHERE role = ? AND identifier = ?'
        ).bind('owner', phone).first();
        if (credential && credential.security_answer_salt && credential.security_answer_hash) {
            const answerHash = await deriveSecretHash(answer, credential.security_answer_salt);
            isMatch = constantTimeEqual(answerHash, credential.security_answer_hash || '');
        }

        if (!isMatch) {
            const owner = await env.DB.prepare('SELECT security_answer FROM owners WHERE phone = ?').bind(phone).first();
            if (owner && owner.security_answer && owner.security_answer.toLowerCase().trim() === answer) {
                isMatch = true;
            }
        }

        if (!isMatch) {
            if (await recordFailedLogin(env.DB, 'owner-recovery', phone)) {
                return jsonError(429, 'Too many recovery attempts. Try again in 15 minutes.');
            }
            return jsonError(401, 'The recovery answer is incorrect.');
        }

        await saveCredential(env.DB, { role: 'owner', identifier: phone, pin });
        await env.DB.prepare('UPDATE owners SET pin = ? WHERE phone = ?').bind(pin, phone).run();
        await env.DB.prepare('DELETE FROM portal_login_attempts WHERE role = ? AND identifier = ?')
            .bind('owner-recovery', phone).run();
        await env.DB.prepare('DELETE FROM portal_login_attempts WHERE role = ? AND identifier = ?')
            .bind('owner', phone).run();
        await env.DB.prepare('DELETE FROM portal_sessions WHERE role = ? AND identifier = ?')
            .bind('owner', phone).run();
        return jsonResponse({ ok: true, message: 'পিন সফলভাবে আপডেট করা হয়েছে! নতুন পিন দিয়ে লগইন করুন।' });
    }

    // POST /api/owner/send-reset-otp
    if (path === '/api/owner/send-reset-otp') {
        const body = await readJson(request);
        const email = String((body && body.email) || '').trim().toLowerCase();
        const phone = String((body && body.phone) || '').trim();

        let owner = null;
        if (email && email.includes('@')) {
            // Find owner by email across owners, buses, and owner_requests
            owner = await env.DB.prepare('SELECT phone, name, email, company_name FROM owners WHERE LOWER(TRIM(email)) = ? LIMIT 1').bind(email).first();
            if (!owner) {
                const bus = await env.DB.prepare('SELECT owner_phone, owner_name, owner_email, company_name FROM buses WHERE LOWER(TRIM(owner_email)) = ? LIMIT 1').bind(email).first();
                if (bus) {
                    owner = { phone: bus.owner_phone, name: bus.owner_name, email: bus.owner_email, company_name: bus.company_name };
                }
            }
            if (!owner) {
                const req = await env.DB.prepare('SELECT owner_phone, owner_name, email, company_name FROM owner_requests WHERE LOWER(TRIM(email)) = ? LIMIT 1').bind(email).first();
                if (req) {
                    owner = { phone: req.owner_phone, name: req.owner_name, email: req.email, company_name: req.company_name };
                }
            }
            if (!owner) {
                return jsonError(404, 'এই ইমেইল ঠিকানায় কোনো বাস মালিকের অ্যাকাউন্ট খুঁজে পাওয়া যায়নি (No owner found with this email).');
            }
        } else if (phone && /^[6-9]\d{9}$/.test(phone)) {
            owner = await env.DB.prepare('SELECT phone, name, email, company_name FROM owners WHERE phone = ? LIMIT 1').bind(phone).first();
            if (!owner) {
                const bus = await env.DB.prepare('SELECT owner_phone, owner_name, owner_email, company_name FROM buses WHERE owner_phone = ? LIMIT 1').bind(phone).first();
                if (bus) {
                    owner = { phone: bus.owner_phone, name: bus.owner_name, email: bus.owner_email, company_name: bus.company_name };
                }
            }
            if (!owner) {
                return jsonError(404, 'এই নম্বরে কোনো বাস মালিক খুঁজে পাওয়া যায়নি (Owner account not found).');
            }
            if (!owner.email || !owner.email.includes('@')) {
                return jsonError(400, 'আপনার অ্যাকাউন্টে কোনো ইমেইল যুক্ত নেই। অনুগ্রহ করে সিকিউরিটি প্রশ্ন ব্যবহার করে পিন রিসেট করুন (No email linked. Use security question).');
            }
        } else {
            return jsonError(400, 'অনুগ্রহ করে বাস রেজিস্ট্রেশনের সময় দেওয়া নিবন্ধিত ইমেইল ঠিকানা দিন (Enter your registered owner email address).');
        }

        const targetEmail = owner.email.trim().toLowerCase();
        try {
            await sendEmailOtp(env, { email: targetEmail, role: 'owner', purpose: 'owner_reset_' + targetEmail });
            const parts = targetEmail.split('@');
            const masked = parts[0].length > 2 ? (parts[0].slice(0, 2) + '***@' + parts[1]) : (parts[0] + '***@' + parts[1]);
            return jsonResponse({
                ok: true,
                email: targetEmail,
                phone: owner.phone,
                emailMasked: masked,
                message: `৬-সংখ্যার ওটিপি আপনার রেজিস্টার্ড ইমেইলে (${masked}) সফলভাবে পাঠানো হয়েছে!`
            });
        } catch (err) {
            return jsonError(400, err.message);
        }
    }

    // POST /api/owner/reset-by-otp
    if (path === '/api/owner/reset-by-otp') {
        const body = await readJson(request);
        const email = String((body && body.email) || '').trim().toLowerCase();
        let phone = String((body && body.phone) || '').trim();
        const otp = String((body && body.otp) || '').trim();
        const pin = String((body && (body.pin || body.newPin)) || '').trim();

        if (!otp || otp.length !== 6 || !/^\d{4}$/.test(pin)) {
            return jsonError(400, '৬-সংখ্যার ওটিপি এবং নতুন ৪-সংখ্যার পিন সঠিকভাবে দিন (6-digit OTP and 4-digit PIN required).');
        }

        let owner = null;
        if (email && email.includes('@')) {
            owner = await env.DB.prepare('SELECT phone, name, email, company_name FROM owners WHERE LOWER(TRIM(email)) = ? LIMIT 1').bind(email).first();
            if (!owner) {
                const bus = await env.DB.prepare('SELECT owner_phone, owner_name, owner_email, company_name FROM buses WHERE LOWER(TRIM(owner_email)) = ? LIMIT 1').bind(email).first();
                if (bus) {
                    owner = { phone: bus.owner_phone, name: bus.owner_name, email: bus.owner_email, company_name: bus.company_name };
                }
            }
            if (!owner) {
                const req = await env.DB.prepare('SELECT owner_phone, owner_name, email, company_name FROM owner_requests WHERE LOWER(TRIM(email)) = ? LIMIT 1').bind(email).first();
                if (req) {
                    owner = { phone: req.owner_phone, name: req.owner_name, email: req.email, company_name: req.company_name };
                }
            }
        } else if (phone && /^[6-9]\d{9}$/.test(phone)) {
            owner = await env.DB.prepare('SELECT phone, name, email, company_name FROM owners WHERE phone = ? LIMIT 1').bind(phone).first();
            if (!owner) {
                const bus = await env.DB.prepare('SELECT owner_phone, owner_name, owner_email, company_name FROM buses WHERE owner_phone = ? LIMIT 1').bind(phone).first();
                if (bus) {
                    owner = { phone: bus.owner_phone, name: bus.owner_name, email: bus.owner_email, company_name: bus.company_name };
                }
            }
        }

        if (!owner || !owner.email) {
            return jsonError(404, 'মালিকের অ্যাকাউন্ট বা নিবন্ধিত ইমেইল পাওয়া যায়নি (Owner account or email not found).');
        }

        const targetEmail = owner.email.trim().toLowerCase();
        const targetPhone = owner.phone;

        try {
            await verifyEmailOtp(env, { email: targetEmail, otp, purpose: 'owner_reset_' + targetEmail });
        } catch (err) {
            try {
                await verifyEmailOtp(env, { email: targetEmail, otp, purpose: 'owner_reset_' + targetPhone });
            } catch {
                return jsonError(400, err.message);
            }
        }

        const existingCred = await env.DB.prepare(
            'SELECT security_question, security_answer_salt, security_answer_hash FROM portal_credentials WHERE role = ? AND identifier = ?'
        ).bind('owner', targetPhone).first();

        const hasSecQ = Boolean(existingCred && existingCred.security_question && existingCred.security_answer_salt);
        const secQ = hasSecQ ? existingCred.security_question : 'What is your registered email address?';
        const secA = hasSecQ ? null : targetEmail;

        // Save credential in portal_credentials and update in owners / owner_requests
        await saveCredential(env.DB, {
            role: 'owner',
            identifier: targetPhone,
            pin,
            securityQuestion: secQ,
            securityAnswer: secA
        });
        await env.DB.prepare('UPDATE owners SET pin = ? WHERE phone = ?').bind(pin, targetPhone).run();
        await env.DB.prepare('UPDATE owner_requests SET pin = ? WHERE owner_phone = ?').bind(pin, targetPhone).run();

        // Clear previous login attempts and old sessions
        await env.DB.prepare('DELETE FROM portal_login_attempts WHERE role = ? AND identifier = ?')
            .bind('owner-recovery', targetPhone).run();
        await env.DB.prepare('DELETE FROM portal_login_attempts WHERE role = ? AND identifier = ?')
            .bind('owner', targetPhone).run();
        await env.DB.prepare('DELETE FROM portal_sessions WHERE role = ? AND identifier = ?')
            .bind('owner', targetPhone).run();

        // Directly create new session so the owner opens the dashboard immediately!
        const session = await createPortalSession(env.DB, {
            role: 'owner',
            identifier: targetPhone
        });

        const ownerPayload = {
            phone: targetPhone,
            name: owner.name || owner.company_name || 'Bus Owner',
            companyName: owner.company_name || owner.name || 'Bus Fleet',
            email: targetEmail
        };

        return jsonResponse({
            ok: true,
            message: 'পিন সফলভাবে আপডেট হয়েছে এবং ওনার প্যানেল ওপেন করা হচ্ছে!',
            token: session.token,
            expiresAt: session.expiresAt,
            owner: ownerPayload,
            securityConfigured: true
        });
    }

    if (path === '/api/auth/owner/setup') {
        const body = await readJson(request);
        if (!body || !/^\d{4}$/.test(String(body.pin || '')) ||
            typeof body.securityQuestion !== 'string' || body.securityQuestion.trim().length < 5 ||
            typeof body.securityAnswer !== 'string' || body.securityAnswer.trim().length < 3) {
            return jsonError(400, 'Set a 4-digit PIN, a recovery question, and an answer.');
        }
        const credential = await env.DB.prepare(
            'SELECT security_question, security_answer_salt, security_answer_hash FROM portal_credentials WHERE role = ? AND identifier = ?'
        ).bind('owner', auth.identifier).first();
        if (!credential) return jsonError(404, 'Owner PIN was not initialized by the administrator.');
        if (credential.security_question && credential.security_answer_salt && credential.security_answer_hash) {
            return jsonError(409, 'Owner recovery is already configured.');
        }
        await saveCredential(env.DB, {
            role: 'owner',
            identifier: auth.identifier,
            pin: body.pin,
            securityQuestion: body.securityQuestion.trim(),
            securityAnswer: body.securityAnswer
        });
        await env.DB.prepare('DELETE FROM portal_sessions WHERE role = ? AND identifier = ?')
            .bind('owner', auth.identifier).run();
        const session = await createPortalSession(env.DB, {
            role: 'owner',
            identifier: auth.identifier
        });
        return jsonResponse({ token: session.token, expiresAt: session.expiresAt });
    }

    if (path === '/api/admin/reset-pin') {
        const body = await readJson(request);
        const role = body && body.role;
        const identifier = String((body && body.identifier) || '').trim();
        const newPin = String((body && body.newPin) || '');
        if (!body || !['owner', 'captain', 'customer'].includes(role) ||
            !/^[6-9]\d{9}$/.test(identifier) ||
            !/^\d{4}$/.test(newPin)) {
            return jsonError(400, 'Select an account type and enter its valid mobile number and 4-digit PIN.');
        }
        if (role === 'owner') {
            const owner = await env.DB.prepare('SELECT id FROM buses WHERE owner_phone = ? LIMIT 1')
                .bind(identifier).first();
            if (!owner) return jsonError(404, 'No owner account was found for this mobile number.');
            await setCredentialPin(env.DB, { role, identifier, pin: newPin });
            await env.DB.prepare("UPDATE owners SET pin = ? WHERE phone = ?").bind(newPin, identifier).run();
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'owner' AND identifier = ?")
                .bind(identifier).run();
        } else if (role === 'captain') {
            const bus = await env.DB.prepare(
                'SELECT id FROM buses WHERE driver_phone = ? ORDER BY id LIMIT 1'
            ).bind(identifier).first();
            if (!bus) return jsonError(404, 'No captain account was found for this mobile number.');
            await setCredentialPin(env.DB, { role, identifier, busId: bus.id, pin: newPin });
            await env.DB.prepare("UPDATE captains SET pin = ?, updated_at = ? WHERE phone = ? OR bus_id = ?")
                .bind(newPin, new Date().toISOString(), identifier, bus.id).run();
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?")
                .bind(identifier).run();
        } else {
            const customer = await env.DB.prepare(
                'SELECT status FROM customers WHERE phone = ?'
            ).bind(identifier).first();
            if (!customer) return jsonError(404, 'No customer account was found for this mobile number.');
            const pinSalt = secureRandomHex(16);
            const pinHash = await deriveSecretHash(newPin, pinSalt);
            await env.DB.prepare('UPDATE customers SET pin = ?, pin_salt = ?, pin_hash = ?, pin_requested_at = NULL, updated_at = ? WHERE phone = ?')
                .bind(newPin, pinSalt, pinHash, new Date().toISOString(), identifier).run();
            await saveCredential(env.DB, { role: 'customer', identifier, pin: newPin });
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'customer' AND identifier = ?").bind(identifier).run();
        }
        await recordAdminAudit(env.DB, auth, `${role}_pin_reset`, identifier);
        return jsonResponse({ ok: true });
    }

    if (path === '/api/auth/logout') {
        const match = (request.headers.get('Authorization') || '').match(/^Bearer ([a-f0-9]{64})$/i);
        if (match) {
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1]));
            await env.DB.prepare('DELETE FROM portal_sessions WHERE token_hash = ?')
                .bind(bytesToHex(new Uint8Array(digest))).run();
        }
        return jsonResponse({ ok: true });
    }

    // POST /api/seats/hold (Enterprise Atomic Hop-Level Seat Lock via PRIMARY KEY Constraint)
    if (path === '/api/seats/hold') {
        await ensureEnterpriseSegmentTables(env.DB);
        const body = await readJson(request);
        const { busId, journeyDate, seats: rawSeats, sessionId, customerPhone, boarding, dropping } = body || {};
        const seats = Array.isArray(rawSeats) ? [...new Set(rawSeats.map(s => String(s).trim()).filter(Boolean))] : [];
        if (!busId || !journeyDate || !seats.length || !sessionId) {
            return jsonError(400, 'Missing busId, journeyDate, seats, or sessionId.');
        }

        const isReturnTrip = String(busId).endsWith('_RETURN');
        const physicalBusId = String(busId).replace('_RETURN', '');
        const checkBus = await env.DB.prepare('SELECT * FROM buses WHERE id = ?').bind(physicalBusId).first();
        if (!checkBus) return jsonError(404, 'Bus not found.');
        const flags = await getFeatureFlags(env.DB);

        const stops = getEffectiveStoppagesList(checkBus, isReturnTrip);
        let bIdx = boarding ? resolveStoppageIdx(stops, boarding) : 0;
        let dIdx = dropping ? resolveStoppageIdx(stops, dropping) : Math.max(1, stops.length - 1);
        if (bIdx < 0 || dIdx <= bIdx) {
            bIdx = 0;
            dIdx = Math.max(1, stops.length - 1);
        }
        const effectiveBoarding = stops[bIdx] || boarding || stops[0];

        // Check boarding-stop departure state (supports mid-route running bus booking!)
        const enrouteState = evaluateEnrouteStopState(checkBus, journeyDate, effectiveBoarding, isReturnTrip, flags);
        if (!enrouteState.allowed) {
            return jsonError(400, `দুঃখিত! ${effectiveBoarding} স্টপেজে বাসটির ছাড়ার সময় ইতিমধ্যে পার হয়ে গেছে। অন্য স্টপেজ বা ভবিষ্যতের তারিখ নির্বাচন করুন। (Bus already departed/passed ${effectiveBoarding}.)`);
        }

        const now = new Date();
        const nowIso = now.toISOString();

        // 1. Purge expired holds atomically
        await Promise.all([
            env.DB.prepare('DELETE FROM seat_holds WHERE expires_at <= ?').bind(nowIso).run(),
            env.DB.prepare('DELETE FROM seat_hold_legs WHERE expires_at <= ?').bind(nowIso).run()
        ]);

        const reuseEnabled = flags.segmentSeatReuse !== false;
        const holdFrom = reuseEnabled ? bIdx : 0;
        const holdTo = reuseEnabled ? dIdx : Math.max(1, stops.length - 1);

        // 2. Check if already permanently booked on overlapping hops
        const occupiedForSeg = new Set(await getSegmentOccupiedSeats(env.DB, busId, journeyDate, holdFrom, holdTo, flags));
        const conflictingBooked = seats.filter(s => occupiedForSeg.has(s));
        if (conflictingBooked.length > 0) {
            const taken = conflictingBooked.join(', ');
            return jsonError(409, `সিট ${taken} এই রুটে ইতিমধ্যে বুক হয়ে গেছে। অন্য সিট নির্বাচন করুন। (Seat ${taken} is already booked.)`);
        }

        // 3. Check if temporarily locked by another passenger on overlapping hops
        const { heldSeats } = await getSegmentHeldSeats(env.DB, busId, journeyDate, holdFrom, holdTo, sessionId, nowIso, flags);
        const heldSet = new Set(heldSeats);
        const heldConflict = seats.filter(s => heldSet.has(s));
        if (heldConflict.length > 0) {
            const lockedSeats = heldConflict.join(', ');
            return jsonError(409, `সিট ${lockedSeats} সাময়িকভাবে অন্য যাত্রীর জন্য লক রয়েছে। অনুগ্রহ করে অন্য সিট বাছুন। (Seat ${lockedSeats} is temporarily held.)`);
        }

        // 4. Preserve existing active hold expiry ONLY if this session already holds the exact same seats & segment
        const { results: existingLegRows } = await env.DB.prepare(
            `SELECT DISTINCT seat_number, expires_at, boarding_idx, dropping_idx FROM seat_hold_legs
             WHERE bus_id = ? AND journey_date = ? AND session_id = ? AND expires_at > ?`
        ).bind(busId, journeyDate, sessionId, nowIso).all();

        if (flags.seatHoldTimer === false) {
            return jsonResponse({
                ok: true,
                holdDisabled: true,
                holdMinutes: 0,
                expiresAt: null,
                expiresInSeconds: 0,
                seats
            });
        }
        const holdMins = Number(flags.seatHoldMinutes) || 15;

        let expiresAt;
        const existingList = existingLegRows || [];
        const existingSeatSet = new Set(existingList.map(r => r.seat_number));
        const sameSeg = existingList.length > 0 && existingList.every(r => Number(r.boarding_idx) === holdFrom && Number(r.dropping_idx) === holdTo);
        const allSeatsAlreadyHeld = sameSeg && seats.length > 0 && seats.every(s => existingSeatSet.has(s)) && existingSeatSet.size === seats.length;

        if (allSeatsAlreadyHeld && existingList[0]?.expires_at) {
            expiresAt = existingList[0].expires_at;
        } else {
            expiresAt = new Date(now.getTime() + holdMins * 60 * 1000).toISOString();
            const tripDir = isReturnTrip ? 'DOWN' : 'UP';
            const hopInserts = [];
            for (const seat of seats) {
                for (let h = holdFrom; h < holdTo; h++) {
                    hopInserts.push(
                        env.DB.prepare(
                            `INSERT INTO seat_hold_legs (bus_id, journey_date, seat_number, hop_idx, session_id, customer_phone, boarding_idx, dropping_idx, expires_at, created_at, trip_direction)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                        ).bind(busId, journeyDate, seat, h, sessionId, customerPhone || null, holdFrom, holdTo, expiresAt, nowIso, tripDir)
                    );
                }
            }
            const statements = [
                env.DB.prepare('DELETE FROM seat_hold_legs WHERE bus_id = ? AND journey_date = ? AND session_id = ?').bind(busId, journeyDate, sessionId),
                env.DB.prepare('DELETE FROM seat_holds WHERE bus_id = ? AND journey_date = ? AND session_id = ?').bind(busId, journeyDate, sessionId),
                ...hopInserts
            ];
            try {
                await env.DB.batch(statements);
            } catch (err) {
                if (/UNIQUE|constraint/i.test(err.message || '')) {
                    return jsonError(409, `দুঃখিত! আপনার নির্বাচিত সিট (${seats.join(', ')}) এই মুহূর্তে অন্য একজন যাত্রী পেমেন্টের জন্য লক করে ফেলেছেন। অন্য সিট বাছুন। (Seat(s) ${seats.join(', ')} were just locked by another passenger.)`);
                }
                throw err;
            }
        }

        const remainingSecs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000));
        return jsonResponse({
            ok: true,
            holdMinutes: Math.ceil(remainingSecs / 60),
            expiresAt,
            expiresInSeconds: remainingSecs,
            seats
        });
    }

    // POST /api/seats/release
    if (path === '/api/seats/release') {
        await ensureEnterpriseSegmentTables(env.DB);
        const body = await readJson(request);
        const { busId, journeyDate, sessionId, seats } = body || {};
        if (sessionId) {
            if (seats && Array.isArray(seats) && seats.length > 0) {
                const placeholders = seats.map(() => '?').join(',');
                if (busId && journeyDate) {
                    await Promise.all([
                        env.DB.prepare(`DELETE FROM seat_holds WHERE bus_id = ? AND journey_date = ? AND session_id = ? AND seat_number IN (${placeholders})`).bind(busId, journeyDate, sessionId, ...seats).run(),
                        env.DB.prepare(`DELETE FROM seat_hold_legs WHERE bus_id = ? AND journey_date = ? AND session_id = ? AND seat_number IN (${placeholders})`).bind(busId, journeyDate, sessionId, ...seats).run()
                    ]);
                } else {
                    await Promise.all([
                        env.DB.prepare(`DELETE FROM seat_holds WHERE session_id = ? AND seat_number IN (${placeholders})`).bind(sessionId, ...seats).run(),
                        env.DB.prepare(`DELETE FROM seat_hold_legs WHERE session_id = ? AND seat_number IN (${placeholders})`).bind(sessionId, ...seats).run()
                    ]);
                }
            } else if (busId && journeyDate) {
                await Promise.all([
                    env.DB.prepare('DELETE FROM seat_holds WHERE bus_id = ? AND journey_date = ? AND session_id = ?').bind(busId, journeyDate, sessionId).run(),
                    env.DB.prepare('DELETE FROM seat_hold_legs WHERE bus_id = ? AND journey_date = ? AND session_id = ?').bind(busId, journeyDate, sessionId).run()
                ]);
            } else {
                await Promise.all([
                    env.DB.prepare('DELETE FROM seat_holds WHERE session_id = ?').bind(sessionId).run(),
                    env.DB.prepare('DELETE FROM seat_hold_legs WHERE session_id = ?').bind(sessionId).run()
                ]);
            }
        }
        return jsonResponse({ ok: true });
    }

    // POST /api/bookings (Customer booking)
    if (path === '/api/bookings') {
        const body = await readJson(request);
        if (!body) return jsonError(400, 'Invalid JSON body.');

        const {
            busId,
            passengerName,
            passengerPhone,
            seats,
            boarding,
            dropping,
            date,
            fare,
            paymentMode,
            utrNumber,
            promoCode,
            sessionId,
            idempotencyKey
        } = body;

        const cleanSessionId = sessionId ? String(sessionId).trim() : '';
        const cleanIdempotencyKey = idempotencyKey ? String(idempotencyKey).trim().slice(0, 128) : null;

        // Idempotency replay protection (prevents duplicate bookings on network retries / double-taps)
        if (cleanIdempotencyKey) {
            const existingBk = await env.DB.prepare('SELECT * FROM bookings WHERE idempotency_key = ? LIMIT 1').bind(cleanIdempotencyKey).first();
            if (existingBk) {
                const existingBus = await env.DB.prepare('SELECT * FROM buses WHERE id = ?').bind(String(existingBk.bus_id).replace('_RETURN', '')).first();
                return jsonResponse({
                    idempotentReplay: true,
                    booking: {
                        id: existingBk.id,
                        busId: existingBus ? existingBus.id : existingBk.bus_id,
                        busName: existingBk.bus_name,
                        busNumber: existingBk.bus_number,
                        ownerName: existingBk.owner_name,
                        companyName: existingBus ? (existingBus.company_name || `${existingBus.owner_name} Travels`) : `${existingBk.owner_name} Travels`,
                        gstNumber: existingBus?.gst_number || '',
                        ticketTerms: existingBus?.ticket_terms || '',
                        emergencyPhone: existingBus?.emergency_phone || existingBus?.driver_phone || existingBus?.owner_phone || '',
                        departureTime: existingBus?.time || '',
                        passengerName: existingBk.passenger_name,
                        passengerPhone: existingBk.passenger_phone,
                        seats: parseJson(existingBk.seats, []),
                        boarding: existingBk.boarding,
                        dropping: existingBk.dropping,
                        date: existingBk.journey_date,
                        fare: existingBk.fare,
                        paymentMode: existingBk.payment_mode,
                        utrNumber: existingBk.utr_number || 'N/A',
                        status: existingBk.status,
                        createdAt: existingBk.created_at
                    }
                }, 200);
            }
        }

        if (!busId || !passengerName || !passengerPhone || !Array.isArray(seats) || !seats.length || !date || typeof fare !== 'number') {
            return jsonError(400, 'Missing required booking fields.');
        }
        if (passengerName.trim().length > 50 || !/^[6-9]\d{9}$/.test(String(passengerPhone).trim())) {
            return jsonError(400, 'A valid passenger name and 10-digit mobile number are required.');
        }
        if (!isValidJourneyDate(date) || date < new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })) {
            return jsonError(400, 'Choose today or a future journey date.');
        }
        if (new Set(seats).size !== seats.length || seats.some(seat => typeof seat !== 'string' || !/^S\d+$/.test(seat))) {
            return jsonError(400, 'Seat selection is invalid.');
        }

        const rawPassengerPhone = String(passengerPhone || '').trim();
        const bookerPhone = String(body.customerPhone || request.headers.get('x-customer-phone') || passengerPhone || '').trim();

        // Fraud & Suspension Check for Passenger and Booker
        try {
            const checkAcl = await env.DB.prepare(
                "SELECT status, reason FROM access_control_list WHERE phone = ? OR phone = ?"
            ).bind(bookerPhone, rawPassengerPhone).first();
            if (checkAcl) {
                if (checkAcl.status === 'permanently_banned') {
                    return jsonError(403, '⛔ এই মোবাইল নম্বরটি নিয়ম লঙ্ঘন বা ফ্রডের কারণে স্থায়ীভাবে নিষিদ্ধ (Permanently Banned) করা হয়েছে। টিকিট বুকিং সম্ভব নয়।');
                }
                if (checkAcl.status === 'suspended' || checkAcl.status === 'blocked') {
                    return jsonError(403, `⚠️ আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত (Suspended) রয়েছে। ${checkAcl.reason ? 'কারণ: ' + checkAcl.reason : 'অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।'}`);
                }
            }
            const custRow = await env.DB.prepare("SELECT status FROM customers WHERE phone = ?").bind(bookerPhone).first();
            if (custRow && (custRow.status === 'suspended' || custRow.status === 'banned')) {
                return jsonError(403, '⚠️ আপনার কাস্টমার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত বা নিষ্ক্রিয় করা হয়েছে। নতুন টিকিট বুকিং সম্ভব নয়।');
            }
        } catch (aclErr) {}

        let customer = await getCustomerIdentity(request, env.DB);
        let customerSessionToken = null;
        let customerSessionExpiresAt = null;
        let wasNewlyRegistered = false;

        if (!customer && bookerPhone) {
            let registeredCustomer = await env.DB.prepare(
                "SELECT phone, name, status FROM customers WHERE phone = ?"
            ).bind(bookerPhone).first();

            // Auto-register seamless customer profile if not found, guaranteeing booking NEVER fails with 401
            if (!registeredCustomer) {
                const now = new Date().toISOString();
                const defaultPin = bookerPhone.slice(-4);
                const pinSalt = secureRandomHex(16);
                const pinHash = await deriveSecretHash(defaultPin, pinSalt);
                const ansSalt = secureRandomHex(16);
                const ansHash = await deriveSecretHash('kolkata', ansSalt);
                try {
                    await env.DB.prepare(
                        `INSERT INTO customers (
                            phone, name, email, pin, pin_salt, pin_hash, security_question,
                            security_answer, security_answer_salt, security_answer_hash, status, created_at, updated_at
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
                    ).bind(
                        bookerPhone,
                        passengerName.trim().slice(0, 80),
                        null,
                        defaultPin,
                        pinSalt,
                        pinHash,
                        'আপনার জন্মস্থান কোন শহরে?',
                        'kolkata',
                        ansSalt,
                        ansHash,
                        now,
                        now
                    ).run();
                    registeredCustomer = { phone: bookerPhone, name: passengerName.trim(), status: 'active' };
                    wasNewlyRegistered = true;
                } catch (regErr) {
                    console.warn('Auto customer registration notice:', regErr);
                }
            }

            // Security: ONLY auto-issue a session token for a newly created account;
            // NEVER mint a session for an existing PIN-protected account without login.
            if (registeredCustomer && wasNewlyRegistered) {
                customer = { role: 'customer', identifier: registeredCustomer.phone };
                try {
                    const session = await createCustomerSession(env.DB, registeredCustomer.phone);
                    customerSessionToken = session.token;
                    customerSessionExpiresAt = session.expiresAt;
                } catch (sessErr) {
                    console.warn('Auto session creation warning:', sessErr);
                }
            } else if (bookerPhone) {
                customer = { role: 'customer', identifier: bookerPhone };
            }
        }

        if (!customer) {
            return jsonError(401, 'টিকিট বুকিং করার জন্য অনুগ্রহ করে প্রথমে লগইন করুন (Please login to book seats).');
        }

        await ensureEnterpriseSegmentTables(env.DB);
        const physicalBusId = String(busId).replace('_RETURN', '');
        const isReturnTrip = String(busId).endsWith('_RETURN');
        const bus = await env.DB.prepare('SELECT * FROM buses WHERE id = ?').bind(physicalBusId).first();
        if (!bus) return jsonError(404, 'Selected bus does not exist.');
        const flags = await getFeatureFlags(env.DB);
        const service = await env.DB.prepare(
            `SELECT COALESCE(enabled, 1) AS enabled FROM bus_service_dates WHERE bus_id = ? AND journey_date = ?`
        ).bind(physicalBusId, date).first();
        if (service && !service.enabled) return jsonError(409, 'This bus is not operating on the selected date.');
        if (seats.some(seat => Number(seat.slice(1)) < 1 || Number(seat.slice(1)) > (bus.total_seats || 65))) {
            return jsonError(400, 'One or more selected seats do not exist on this bus.');
        }

        const stoppages = getEffectiveStoppagesList(bus, isReturnTrip);
        const boardingIndex = resolveStoppageIdx(stoppages, boarding);
        const droppingIndex = resolveStoppageIdx(stoppages, dropping);
        if (boardingIndex < 0 || droppingIndex <= boardingIndex) {
            return jsonError(400, 'The selected boarding and dropping points are invalid.');
        }
        const canonicalBoarding = stoppages[boardingIndex];
        const canonicalDropping = stoppages[droppingIndex];

        // Check boarding-stop departure state (supports mid-route running bus booking!)
        const enrouteState = evaluateEnrouteStopState(bus, date, canonicalBoarding, isReturnTrip, flags);
        if (!enrouteState.allowed) {
            return jsonError(400, `দুঃখিত! ${canonicalBoarding} স্টপেজে বাসটির ছাড়ার সময় ইতিমধ্যে পার হয়ে গেছে। টিকিট বুকিং সম্ভব নয়। (Bus departure time for ${canonicalBoarding} has already passed.)`);
        }

        const reuseEnabled = flags.segmentSeatReuse !== false;
        const legFromIdx = reuseEnabled ? boardingIndex : 0;
        const legToIdx = reuseEnabled ? droppingIndex : Math.max(1, stoppages.length - 1);

        const occupiedForSeg = new Set(await getSegmentOccupiedSeats(env.DB, busId, date, legFromIdx, legToIdx, flags));
        const alreadyBookedConflict = seats.filter(s => occupiedForSeg.has(s));
        if (alreadyBookedConflict.length > 0) {
            return jsonError(409, `সিট ${alreadyBookedConflict.join(', ')} ইতিমধ্যেই বুক হয়ে গেছে। অনুগ্রহ করে অন্য আসন নির্বাচন করুন। (Seat ${alreadyBookedConflict.join(', ')} is already booked.)`);
        }

        const cleanMode = (paymentMode === 'Cash' || String(paymentMode).toLowerCase().includes('cash')) ? 'Cash' : 'UPI';
        if ((cleanMode === 'UPI' && (!flags.onlinePayment || bus.allow_online_payment === 0)) ||
            (cleanMode === 'Cash' && (!flags.cashPayment || bus.allow_cash_payment === 0))) {
            return jsonError(400, 'The selected payment method is currently unavailable.');
        }
        const paymentScreenshot = String(body.paymentScreenshot || body.payment_screenshot || '').trim();
        if (paymentScreenshot) {
            if (!paymentScreenshot.startsWith('data:image/') && !/^https?:\/\//i.test(paymentScreenshot)) {
                return jsonError(400, 'Invalid payment screenshot image format.');
            }
            if (paymentScreenshot.length > 750000) {
                return jsonError(413, 'পেমেন্ট স্ক্রিনশট ছবির সাইজ অনেক বড়। অনুগ্রহ করে ছোট/কম্প্রেসড ছবি আপলোড করুন।');
            }
        }
        const busRequiresScreenshot = bus.require_payment_screenshot !== 0;
        const busRequiresUtr = Boolean(bus.enable_utr);
        if (cleanMode === 'UPI' && busRequiresScreenshot && !paymentScreenshot) {
            return jsonError(400, 'অনলাইন ইউপিআই পেমেন্টের স্ক্রিনশট আপলোড করা বাধ্যতামূলক। (Payment screenshot is required for this bus.)');
        }
        if (cleanMode === 'UPI' && busRequiresUtr && !utrNumber) {
            return jsonError(400, 'ইউপিআই লেনদেন / ইউটিআর (UTR) নম্বরটি দেওয়া বাধ্যতামূলক। (UTR number is required for this bus.)');
        }
        const cleanUtr = cleanMode === 'UPI' ? (utrNumber ? String(utrNumber).trim() : 'N/A') : null;

        const baseBusFare = resolveSegmentFare(bus, canonicalBoarding, canonicalDropping, isReturnTrip, flags);
        const seatLayoutParsed = parseJson(bus.seat_layout, null);
        const winExtra = flags.windowSeatPricing ? Number(bus.window_seat_extra || 0) : 0;
        const isSeatWindowServer = (seatNum) => {
            if (seatLayoutParsed && Array.isArray(seatLayoutParsed.seats)) {
                const found = seatLayoutParsed.seats.find(s => String(s.number) === String(seatNum) || String(s.id) === String(seatNum));
                if (found) return Boolean(found.isWindow || found.type === 'window');
            }
            const num = parseInt(String(seatNum).replace(/\D/g, ''), 10) || 0;
            const mod = num % 5;
            return mod === 1 || mod === 2 || mod === 0;
        };
        const seatsBaseTotal = seats.reduce((sum, s) => sum + baseBusFare + (winExtra > 0 && isSeatWindowServer(s) ? winExtra : 0), 0);

        let discount = 0;
        let appliedCouponCode = null;
        if (promoCode) {
            if (!flags.promoCodes) return jsonError(400, 'Promo codes are currently disabled.');
            const cleanCode = String(promoCode).trim().toUpperCase();
            const coupon = await env.DB.prepare(
                'SELECT code, discount, active, min_fare, max_uses, used_count, expires_at FROM coupons WHERE code = ? AND active = 1'
            ).bind(cleanCode).first();
            if (!coupon) return jsonError(400, 'The promo code is invalid or inactive.');
            if (coupon.expires_at && coupon.expires_at < new Date().toISOString()) {
                return jsonError(400, 'এই প্রোমো কোডের মেয়াদ শেষ হয়ে গেছে (Promo code has expired).');
            }
            if (coupon.max_uses !== null && coupon.max_uses !== undefined && Number(coupon.used_count || 0) >= Number(coupon.max_uses)) {
                return jsonError(400, 'এই প্রোমো কোডের ব্যবহারের সীমা শেষ হয়ে গেছে (Promo code usage limit reached).');
            }
            if (seatsBaseTotal < Number(coupon.min_fare || 0)) {
                return jsonError(400, `এই কুপন ব্যবহারের জন্য ন্যূনতম ভাড়া ₹${coupon.min_fare} হতে হবে।`);
            }
            discount = Number(coupon.discount) || 0;
            appliedCouponCode = coupon.code;
        }
        const expectedFare = Math.max(0, seatsBaseTotal - discount);

        // Enterprise-grade smooth booking: authoritative owner fare is booked without blocking the passenger
        const finalBookingFare = expectedFare;

        // Duplicate UTR check for UPI payments (if UTR provided)
        if (cleanMode === 'UPI' && cleanUtr && cleanUtr !== 'N/A') {
            const existingUtr = await env.DB.prepare(
                "SELECT id FROM bookings WHERE payment_mode = 'UPI' AND utr_number = ? AND status != 'Rejected' LIMIT 1"
            ).bind(cleanUtr).first();
            if (existingUtr) {
                return jsonError(409, 'This UPI Transaction ID / UTR has already been submitted for another booking. Please check your transaction details.');
            }
        }

        // Purge expired holds and verify no other passenger holds an active lock on overlapping hops
        const nowHoldIso = new Date().toISOString();
        await Promise.all([
            env.DB.prepare('DELETE FROM seat_holds WHERE expires_at <= ?').bind(nowHoldIso).run(),
            env.DB.prepare('DELETE FROM seat_hold_legs WHERE expires_at <= ?').bind(nowHoldIso).run()
        ]);
        if (flags.seatHoldTimer !== false) {
            const { heldSeats: otherHeldSeats } = await getSegmentHeldSeats(env.DB, busId, date, legFromIdx, legToIdx, cleanSessionId, nowHoldIso, flags);
            const otherHeldSet = new Set(otherHeldSeats);
            const holdConflictList = seats.filter(s => otherHeldSet.has(s));
            if (holdConflictList.length > 0) {
                const lockedList = holdConflictList.join(', ');
                return jsonError(409, `সিট ${lockedList} সাময়িকভাবে অন্য যাত্রীর জন্য লক রয়েছে। অনুগ্রহ করে অন্য সিট বাছুন। (Seat ${lockedList} is currently held by another passenger.)`);
            }
        }

        const bookingId = "BK_" + Math.random().toString(36).substring(2, 9).toUpperCase();
        const createdAt = new Date().toISOString();
        const status = 'Pending Approval';
        const tripDirection = isReturnTrip ? 'DOWN' : 'UP';
        const bookingBusName = isReturnTrip ? `${bus.name} (Return)` : bus.name;

        // Atomic batch: Insert booking + hop-level seat leg reservations + release temporary holds in ONE D1 transaction
        const heldPlaceholders = seats.map(() => '?').join(',');
        const legInsertStmts = [];
        for (const s of seats) {
            for (let h = legFromIdx; h < legToIdx; h++) {
                legInsertStmts.push(
                    env.DB.prepare(
                        `INSERT INTO booking_seat_legs (bus_id, journey_date, seat_number, hop_idx, booking_id, boarding_idx, dropping_idx, boarding, dropping)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(busId, date, s, h, bookingId, legFromIdx, legToIdx, canonicalBoarding, canonicalDropping)
                );
            }
        }
        const statements = [
            env.DB.prepare(
                `INSERT INTO bookings (
                    id, bus_id, bus_name, bus_number, owner_name, passenger_name, passenger_phone,
                    seats, boarding, dropping, journey_date, fare, payment_mode, utr_number, status, created_at, trip_direction, payment_screenshot, idempotency_key
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                bookingId, busId, bookingBusName, bus.bus_number, bus.owner_name, passengerName.trim(), passengerPhone.trim(),
                JSON.stringify(seats), canonicalBoarding, canonicalDropping, date, finalBookingFare, cleanMode, cleanUtr, status, createdAt, tripDirection, paymentScreenshot, cleanIdempotencyKey
            ),
            ...legInsertStmts,
            env.DB.prepare(
                `DELETE FROM seat_hold_legs WHERE bus_id = ? AND journey_date = ? AND seat_number IN (${heldPlaceholders}) AND hop_idx >= ? AND hop_idx < ?`
            ).bind(busId, date, ...seats, legFromIdx, legToIdx),
            env.DB.prepare(
                `DELETE FROM seat_holds WHERE bus_id = ? AND journey_date = ? AND seat_number IN (${heldPlaceholders})`
            ).bind(busId, date, ...seats)
        ];
        try {
            await env.DB.batch(statements);
            if (appliedCouponCode) {
                await env.DB.prepare(
                    'UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE code = ?'
                ).bind(appliedCouponCode).run().catch(() => {});
            }
        } catch (error) {
            if (cleanIdempotencyKey && /idempotency_key/i.test(error.message || '')) {
                const replayBk = await env.DB.prepare('SELECT * FROM bookings WHERE idempotency_key = ? LIMIT 1').bind(cleanIdempotencyKey).first();
                if (replayBk) {
                    return jsonResponse({
                        idempotentReplay: true,
                        booking: {
                            id: replayBk.id,
                            busId: bus.id,
                            busName: bus.name,
                            busNumber: bus.bus_number,
                            ownerName: bus.owner_name,
                            companyName: bus.company_name || `${bus.owner_name} Travels`,
                            gstNumber: bus.gst_number || '',
                            ticketTerms: bus.ticket_terms || '',
                            emergencyPhone: bus.emergency_phone || bus.driver_phone || bus.owner_phone,
                            departureTime: bus.time,
                            passengerName: replayBk.passenger_name,
                            passengerPhone: replayBk.passenger_phone,
                            seats: parseJson(replayBk.seats, []),
                            boarding: replayBk.boarding,
                            dropping: replayBk.dropping,
                            date: replayBk.journey_date,
                            fare: replayBk.fare,
                            paymentMode: replayBk.payment_mode,
                            utrNumber: replayBk.utr_number || 'N/A',
                            status: replayBk.status,
                            createdAt: replayBk.created_at
                        }
                    }, 200);
                }
            }
            if (/UNIQUE|constraint/i.test(error.message || '')) {
                return jsonError(409, 'দুঃখিত! আপনার নির্বাচিত আসনটি এইমাত্র অন্য যাত্রী বুক করে নিয়েছেন। অনুগ্রহ করে অন্য আসন বেছে নিন। (One or more selected seats were just booked. Please choose other seats.)');
            }
            throw error;
        }

        // Record financials safely
        try {
            await env.DB.prepare(
               `INSERT INTO booking_financials
                   (booking_id, owner_phone, company_name, amount, payment_status, updated_at, updated_by)
                VALUES (?, ?, ?, ?, 'pending', ?, 'system')`
            ).bind(
               bookingId, bus.owner_phone, bus.company_name || `${bus.owner_name} Travels`,
               finalBookingFare, createdAt
            ).run();
        } catch (finError) {
            console.warn('Could not record booking_financials entry:', finError);
        }

        const newBooking = {
            id: bookingId,
            busId: bus.id,
            busName: bus.name,
            busNumber: bus.bus_number,
            ownerName: bus.owner_name,
            companyName: bus.company_name || `${bus.owner_name} Travels`,
            gstNumber: bus.gst_number || '',
            ticketTerms: bus.ticket_terms || '',
            emergencyPhone: bus.emergency_phone || bus.driver_phone || bus.owner_phone,
            departureTime: bus.time,
            passengerName,
            passengerPhone,
            seats,
            boarding,
            dropping,
            date,
            fare: finalBookingFare,
            paymentMode: cleanMode,
            utrNumber: cleanUtr || 'N/A',
            status,
            createdAt
        };

        if (bookerPhone) {
            const devInfo = extractDeviceInfo(request, body);
            await recordUserLoginDevice(env.DB, 'customer', bookerPhone, passengerName.trim(), devInfo);
        }

        return jsonResponse({
            booking: newBooking,
            customerSession: customerSessionToken ? {
                token: customerSessionToken,
                expiresAt: customerSessionExpiresAt,
                customer: { phone: bookerPhone, name: passengerName.trim() }
            } : undefined
        }, 201);
    }

    // POST /api/bookings/cancellation
    if (path === '/api/bookings/cancellation') {
        await ensureEnterpriseSegmentTables(env.DB);
        const body = await readJson(request);
        if (!body || !body.bookingId) return jsonError(400, 'bookingId required.');
        const flags = await getFeatureFlags(env.DB);
        if (flags.ticketCancellation === false) {
            return jsonError(403, 'অ্যাডমিন কর্তৃক বর্তমানে অনলাইন টিকিট বাতিল অপশনটি বন্ধ রাখা হয়েছে। (Online ticket cancellation is currently disabled by Admin.)');
        }
        const bId = String(body.bookingId).trim();
        const reason = String(body.reason || body.cancelReason || '').trim();
        const customerPhone = String(auth?.identifier || body.phone || body.passengerPhone || '').trim();
        if (!customerPhone) {
            return jsonError(401, 'Passenger mobile number is required to request cancellation.');
        }

        const existing = await env.DB.prepare(
            `SELECT b.id, b.status, b.passenger_phone, b.boarded, b.bus_id, b.journey_date, b.boarding,
                    bs.time, bs.return_time, bs.stoppage_timings, bs.return_stoppage_timings
             FROM bookings b
             LEFT JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
             WHERE b.id = ?`
        ).bind(bId).first();
        if (!existing) return jsonError(404, 'Booking not found.');
        if (existing.status === 'Cancelled' || existing.status === 'Rejected') {
            return jsonError(400, 'This booking has already been cancelled or rejected.');
        }
        if (existing.passenger_phone !== customerPhone) {
            return jsonError(403, 'You are not authorized to cancel this booking.');
        }
        if (existing.boarded) {
            return jsonError(409, 'যাত্রী ইতিমধ্যেই বাসে উঠে পড়েছেন। বোর্ডিং-এর পর অনলাইন ক্যানসেলেশন সম্ভব নয়। (Cannot cancel after boarding.)');
        }
        const isRet = String(existing.bus_id || '').endsWith('_RETURN');
        let depTime = (isRet ? (existing.return_time || existing.time) : existing.time) || '07:00 AM';
        const timingsRaw = isRet ? (existing.return_stoppage_timings || existing.stoppage_timings) : existing.stoppage_timings;
        if (timingsRaw && existing.boarding) {
            const tObj = parseJson(timingsRaw, {});
            const foundTime = resolveStoppageTimingValue(tObj, existing.boarding);
            if (foundTime) depTime = foundTime;
        }
        if (isTripTimePassedIST(existing.journey_date, depTime)) {
            return jsonError(400, 'বাস ছেড়ে দেওয়ার সময় পেরিয়ে গেছে। এখন আর অনলাইনে টিকিট বাতিল করা সম্ভব নয়। (Cannot cancel after bus departure.)');
        }
        if (flags.cancellationCutoffEnabled !== false) {
            const cutoffHours = Number(flags.cancellationCutoffHours ?? 8);
            const parsedDep = parseTripDateTimeIST(existing.journey_date, depTime);
            if (parsedDep && cutoffHours > 0 && parsedDep.hoursUntil < cutoffHours) {
                return jsonError(400, `যাত্রা শুরুর ${cutoffHours} ঘণ্টার কম সময় বাকি থাকায় এখন আর অনলাইনে টিকিট বাতিল করা সম্ভব নয়। (Cancellation closed within ${cutoffHours} hours of departure.)`);
            }
        }

        const update = await env.DB.prepare(
            `UPDATE bookings SET status = 'Cancellation Requested', cancel_reason = ?, refund_status = 'requested'
             WHERE id = ? AND passenger_phone = ?`
        ).bind(reason, bId, customerPhone).run();
        if (!update.meta?.changes) return jsonError(404, 'Cancellable booking not found.');
        return jsonResponse({ ok: true, message: 'Cancellation request submitted.' });
    }

    // POST /api/owner/bookings/:id/status OR /api/admin/bookings/:id/status OR /api/captain/bookings/:id/status
    const statusMatch = path.match(/^\/api\/(owner|admin|captain)\/bookings\/([^/]+)\/status$/);
    if (statusMatch) {
        const role = statusMatch[1];
        const bookingId = decodeURIComponent(statusMatch[2]);
        const body = await readJson(request);
        const newStatus = body ? body.status : null;
        const remarks = String((body && (body.remarks || body.rejectionRemarks)) || '').trim();
        const refundAmount = Number(body && body.refundAmount !== undefined ? body.refundAmount : 0) || 0;
        const refundStatus = String((body && body.refundStatus) || (newStatus === 'Cancelled' ? (refundAmount > 0 ? 'processing' : 'none') : 'none')).trim();

        if (!newStatus || !['Approved', 'Rejected', 'Cancelled', 'Pending Approval'].includes(newStatus)) {
            return jsonError(400, 'Valid status is required.');
        }

        await ensureEnterpriseSegmentTables(env.DB);
        const existingBooking = await env.DB.prepare('SELECT id, status, fare, bus_id, journey_date, seats, boarding, dropping FROM bookings WHERE id = ?').bind(bookingId).first();
        if (!existingBooking) return jsonError(404, 'Booking not found.');
        if (auth && auth.role === 'owner') {
            const ownedBooking = await env.DB.prepare(
                `SELECT b.id FROM bookings b JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
                 WHERE b.id = ? AND bs.owner_phone = ?`
            ).bind(bookingId, auth.identifier).first();
            if (!ownedBooking) return jsonError(404, 'Booking not found.');
        }
        if (auth && auth.role === 'captain') {
            const captainBus = await env.DB.prepare(
                `SELECT b.id FROM bookings b JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
                 WHERE b.id = ? AND (bs.id = ? OR bs.driver_phone = ?)`
            ).bind(bookingId, auth.busId || '', auth.identifier).first();
            if (!captainBus) return jsonError(404, 'Booking not found for this captain.');
        }

        if (existingBooking.status === 'Rejected' && newStatus === 'Rejected') {
            return jsonError(409, 'This booking has already been rejected.');
        }
        if (existingBooking.status === 'Cancelled' && newStatus === 'Cancelled') {
            return jsonError(409, 'This booking has already been cancelled.');
        }

        const nowIso = new Date().toISOString();
        const wasInactive = ['Cancelled', 'Rejected'].includes(existingBooking.status);
        const becomingActive = ['Approved', 'Pending Approval'].includes(newStatus);

        if (newStatus === 'Cancelled') {
            await env.DB.prepare(
                `UPDATE bookings SET status = 'Cancelled', rejection_remarks = ?, refund_amount = ?, refund_status = ?, cancelled_at = ? WHERE id = ?`
            ).bind(remarks, refundAmount, refundStatus, nowIso, bookingId).run();
            await env.DB.prepare('DELETE FROM booking_seats WHERE booking_id = ?').bind(bookingId).run();
            await env.DB.prepare('DELETE FROM booking_seat_legs WHERE booking_id = ?').bind(bookingId).run();
        } else if (newStatus === 'Rejected') {
            await env.DB.prepare('UPDATE bookings SET status = ?, rejection_remarks = ? WHERE id = ?').bind(newStatus, remarks, bookingId).run();
            await env.DB.prepare('DELETE FROM booking_seats WHERE booking_id = ?').bind(bookingId).run();
            await env.DB.prepare('DELETE FROM booking_seat_legs WHERE booking_id = ?').bind(bookingId).run();
        } else if (wasInactive && becomingActive) {
            const seatList = parseJson(existingBooking.seats, []);
            const flags = await getFeatureFlags(env.DB);
            const isRetBk = String(existingBooking.bus_id || '').endsWith('_RETURN');
            const busForBk = await env.DB.prepare('SELECT stoppages, return_stoppages FROM buses WHERE id = ?')
                .bind(String(existingBooking.bus_id || '').replace('_RETURN', '')).first();
            const stopsList = getEffectiveStoppagesList(busForBk, isRetBk);
            let fIdx = resolveStoppageIdx(stopsList, existingBooking.boarding);
            let tIdx = resolveStoppageIdx(stopsList, existingBooking.dropping);
            if (flags.segmentSeatReuse === false || fIdx < 0 || tIdx <= fIdx) {
                fIdx = 0;
                tIdx = Math.max(1, stopsList.length - 1);
            }
            if (Array.isArray(seatList) && seatList.length > 0) {
                await Promise.all([
                    env.DB.prepare('DELETE FROM seat_holds WHERE expires_at <= ?').bind(nowIso).run(),
                    env.DB.prepare('DELETE FROM seat_hold_legs WHERE expires_at <= ?').bind(nowIso).run()
                ]);
                const { heldSeats: otherHeld } = await getSegmentHeldSeats(env.DB, existingBooking.bus_id, existingBooking.journey_date, fIdx, tIdx, '', nowIso, flags);
                const conflictHeld = seatList.filter(s => otherHeld.includes(s));
                if (conflictHeld.length > 0) {
                    const taken = conflictHeld.join(', ');
                    return jsonError(409, `সিট ${taken} বর্তমানে অন্য যাত্রী পেমেন্টের জন্য হোল্ড করে রেখেছেন। তাই পুনরায় Approve করা যাবে না। (Seats ${taken} currently held.)`);
                }
                const occupied = await getSegmentOccupiedSeats(env.DB, existingBooking.bus_id, existingBooking.journey_date, fIdx, tIdx, flags);
                const conflictOcc = seatList.filter(s => occupied.includes(s));
                if (conflictOcc.length > 0) {
                    return jsonError(409, 'এই বুকিংয়ের আসনগুলো ইতিমধ্যেই অন্য যাত্রী বুক করে নিয়েছেন। পুনরায় Approve করা সম্ভব নয়।');
                }
            }
            const statusStmt = newStatus === 'Approved'
                ? env.DB.prepare("UPDATE bookings SET status = 'Approved', refund_status = 'none' WHERE id = ?").bind(bookingId)
                : env.DB.prepare('UPDATE bookings SET status = ? WHERE id = ?').bind(newStatus, bookingId);
            const legReactivateStmts = [];
            if (Array.isArray(seatList)) {
                for (const seat of seatList) {
                    for (let h = fIdx; h < tIdx; h++) {
                        legReactivateStmts.push(
                            env.DB.prepare(
                                `INSERT INTO booking_seat_legs (bus_id, journey_date, seat_number, hop_idx, booking_id, boarding_idx, dropping_idx, boarding, dropping)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                            ).bind(existingBooking.bus_id, existingBooking.journey_date, seat, h, bookingId, fIdx, tIdx, existingBooking.boarding || '', existingBooking.dropping || '')
                        );
                    }
                }
            }
            try {
                await env.DB.batch([statusStmt, ...legReactivateStmts]);
            } catch (reactivateErr) {
                if (/UNIQUE|constraint/i.test(reactivateErr.message || '')) {
                    return jsonError(409, 'এই বুকিংয়ের আসনগুলো ইতিমধ্যেই অন্য যাত্রী বুক করে নিয়েছেন। পুনরায় Approve করা সম্ভব নয়। (One or more seats are already booked by another passenger.)');
                }
                throw reactivateErr;
            }
        } else if (newStatus === 'Approved') {
            await env.DB.prepare("UPDATE bookings SET status = 'Approved', refund_status = 'none' WHERE id = ?").bind(bookingId).run();
        } else {
            await env.DB.prepare('UPDATE bookings SET status = ? WHERE id = ?').bind(newStatus, bookingId).run();
        }

        return jsonResponse({ ok: true, status: newStatus, refundAmount, refundStatus });
    }

    // POST /api/owner/bookings/:id/refund OR /api/admin/bookings/:id/refund
    const refundMatch = path.match(/^\/api\/(owner|admin)\/bookings\/([^/]+)\/refund$/);
    if (refundMatch) {
        const bookingId = decodeURIComponent(refundMatch[2]);
        const targetBooking = await env.DB.prepare(
            `SELECT b.id, b.fare, bs.owner_phone
             FROM bookings b
             LEFT JOIN buses bs ON (b.bus_id = bs.id OR b.bus_id = (bs.id || '_RETURN'))
             WHERE b.id = ?`
        ).bind(bookingId).first();
        if (!targetBooking) return jsonError(404, 'Booking not found.');
        if (auth?.role === 'owner' && targetBooking.owner_phone !== auth.identifier) {
            return jsonError(403, 'You can only update refunds for bookings on your own buses.');
        }

        const body = await readJson(request);
        const refundStatus = String(body?.refundStatus || 'completed').trim();
        let refundAmount = null;
        if (body?.refundAmount !== undefined && body?.refundAmount !== null && body?.refundAmount !== '') {
            const parsedRefund = Number(body.refundAmount);
            if (!Number.isFinite(parsedRefund) || parsedRefund < 0 || parsedRefund > Number(targetBooking.fare || 0)) {
                return jsonError(400, `রিফান্ড অ্যামাউন্ট ০ থেকে ₹${targetBooking.fare} এর মধ্যে হতে হবে।`);
            }
            refundAmount = parsedRefund;
        }
        const nowIso = new Date().toISOString();

        if (refundAmount !== null) {
            await env.DB.prepare(
                `UPDATE bookings SET refund_status = ?, refund_amount = ?, refunded_at = ? WHERE id = ?`
            ).bind(refundStatus, refundAmount, nowIso, bookingId).run();
        } else {
            await env.DB.prepare(
                `UPDATE bookings SET refund_status = ?, refunded_at = ? WHERE id = ?`
            ).bind(refundStatus, nowIso, bookingId).run();
        }
        return jsonResponse({ ok: true, refundStatus, bookingId });
    }

    const serviceDateMatch = path.match(/^\/api\/owner\/buses\/([^/]+)\/service-date$/);
    if (serviceDateMatch) {
        const busId = decodeURIComponent(serviceDateMatch[1]);
        const body = await readJson(request);
        if (!body || !isValidJourneyDate(body.date) || typeof body.enabled !== 'boolean') {
            return jsonError(400, 'A valid date and enabled flag are required.');
        }
        const bus = await env.DB.prepare('SELECT id FROM buses WHERE id = ? AND owner_phone = ?')
            .bind(busId, auth.identifier).first();
        if (!bus) return jsonError(404, 'Bus not found.');
        if (!body.enabled) {
            const booking = await env.DB.prepare(
                "SELECT id FROM bookings WHERE bus_id = ? AND journey_date = ? AND status IN ('Approved', 'Pending Approval') LIMIT 1"
            ).bind(busId, body.date).first();
            if (booking) return jsonError(409, 'Cannot disable this date while it has pending or approved bookings.');
        }
        await env.DB.prepare(
            `INSERT INTO bus_service_dates (bus_id, journey_date, enabled)
             VALUES (?, ?, ?)
             ON CONFLICT (bus_id, journey_date) DO UPDATE SET enabled = excluded.enabled`
        ).bind(busId, body.date, body.enabled ? 1 : 0).run();
        return jsonResponse({ ok: true, enabled: body.enabled });
    }

    if (path === '/api/admin/feature-flags' || path === '/api/admin/expansion-settings') {
        const body = await readJson(request);
        if (!body || typeof body !== 'object') return jsonError(400, 'Feature flags payload required.');
        const currentFlags = await getFeatureFlags(env.DB);
        const currentExp = currentFlags.expansionConfig || {};
        const bodyExp = (body.expansionConfig && typeof body.expansionConfig === 'object') ? body.expansionConfig : {};
        const mergedExp = { ...currentExp };

        for (const [k, v] of Object.entries(bodyExp)) {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                mergedExp[k] = { ...(currentExp[k] || {}), ...v };
            }
        }

        const hasLiveTrackingUpdates = Boolean(
            bodyExp.liveTracking ||
            body.trackingLeadHours !== undefined ||
            body.trackingLeadWindowEnabled !== undefined ||
            body.trackingGraceMinutes !== undefined
        );
        if (hasLiveTrackingUpdates) {
            const baseLive = mergedExp.liveTracking || { ...defaultExpansionConfig.liveTracking };
            if (body.trackingLeadHours !== undefined) {
                const parsedLead = parseFloat(body.trackingLeadHours);
                baseLive.leadHours = (Number.isFinite(parsedLead) && parsedLead >= 0.5 && parsedLead <= 72) ? parsedLead : 5;
            }
            if (body.trackingLeadWindowEnabled !== undefined) {
                baseLive.leadWindowEnabled = Boolean(body.trackingLeadWindowEnabled);
            }
            if (body.trackingGraceMinutes !== undefined) {
                const parsedGrace = parseInt(body.trackingGraceMinutes, 10);
                baseLive.graceMinutes = (Number.isFinite(parsedGrace) && parsedGrace >= 0 && parsedGrace <= 180) ? parsedGrace : 30;
            }
            mergedExp.liveTracking = baseLive;
        }

        const hasSeatHoldUpdates = Boolean(
            bodyExp.seatHold ||
            body.seatHoldMinutes !== undefined ||
            body.seatHoldTimer !== undefined
        );
        if (hasSeatHoldUpdates) {
            const baseHold = mergedExp.seatHold || { ...defaultExpansionConfig.seatHold };
            if (body.seatHoldMinutes !== undefined) {
                const parsedHold = parseInt(body.seatHoldMinutes, 10);
                baseHold.holdMinutes = (Number.isFinite(parsedHold) && parsedHold >= 1 && parsedHold <= 120) ? parsedHold : 15;
            }
            if (body.seatHoldTimer !== undefined) {
                baseHold.enabled = Boolean(body.seatHoldTimer);
            }
            mergedExp.seatHold = baseHold;
        }

        const hasCancellationUpdates = Boolean(
            bodyExp.ticketCancellation ||
            body.ticketCancellation !== undefined ||
            body.cancellationCutoffEnabled !== undefined ||
            body.cancellationCutoffHours !== undefined
        );
        if (hasCancellationUpdates) {
            const baseCancel = mergedExp.ticketCancellation || { ...defaultExpansionConfig.ticketCancellation };
            if (body.ticketCancellation !== undefined) {
                baseCancel.enabled = Boolean(body.ticketCancellation);
            }
            if (body.cancellationCutoffEnabled !== undefined) {
                baseCancel.cutoffEnabled = Boolean(body.cancellationCutoffEnabled);
            }
            if (body.cancellationCutoffHours !== undefined) {
                const parsedCutoff = parseFloat(body.cancellationCutoffHours);
                baseCancel.cutoffHours = (Number.isFinite(parsedCutoff) && parsedCutoff >= 0 && parsedCutoff <= 168) ? parsedCutoff : 8;
            }
            mergedExp.ticketCancellation = baseCancel;
        }

        const allKeys = Object.keys(defaultFeatureFlags);
        const statements = [];
        for (const key of allKeys) {
            const hasFlagInput = typeof body[key] === 'boolean' || (body.flags && typeof body.flags[key] === 'boolean');
            const hasConfigInput = mergedExp[key] && (
                bodyExp[key] ||
                (key === 'liveTracking' && hasLiveTrackingUpdates) ||
                (key === 'seatHold' && hasSeatHoldUpdates) ||
                (key === 'ticketCancellation' && hasCancellationUpdates)
            );
            if (!hasFlagInput && !hasConfigInput) continue;

            const isEnabled = typeof body[key] === 'boolean'
                ? body[key]
                : (body.flags && typeof body.flags[key] === 'boolean')
                    ? body.flags[key]
                    : Boolean(currentFlags[key]);
            const cfg = mergedExp[key] ? JSON.stringify(mergedExp[key]) : null;
            statements.push(env.DB.prepare(
                `INSERT INTO platform_features (feature_key, enabled, config) VALUES (?, ?, ?)
                 ON CONFLICT (feature_key) DO UPDATE SET enabled = excluded.enabled, config = COALESCE(excluded.config, platform_features.config)`
            ).bind(key, isEnabled ? 1 : 0, cfg));
        }
        if (hasSeatHoldUpdates) {
            statements.push(env.DB.prepare(
                `INSERT INTO platform_features (feature_key, enabled, config) VALUES ('seatHold', ?, ?)
                 ON CONFLICT (feature_key) DO UPDATE SET enabled = excluded.enabled, config = excluded.config`
            ).bind(mergedExp.seatHold.enabled ? 1 : 0, JSON.stringify(mergedExp.seatHold)));
        }
        if (hasCancellationUpdates) {
            statements.push(env.DB.prepare(
                `INSERT INTO platform_features (feature_key, enabled, config) VALUES ('cancellationCutoffEnabled', ?, NULL)
                 ON CONFLICT (feature_key) DO UPDATE SET enabled = excluded.enabled`
            ).bind(mergedExp.ticketCancellation.cutoffEnabled ? 1 : 0));
        }
        if (hasLiveTrackingUpdates) {
            statements.push(env.DB.prepare(
                `INSERT INTO platform_features (feature_key, enabled, config) VALUES ('trackingLeadWindowEnabled', ?, NULL)
                 ON CONFLICT (feature_key) DO UPDATE SET enabled = excluded.enabled`
            ).bind(mergedExp.liveTracking.leadWindowEnabled ? 1 : 0));
        }
        if (statements.length > 0) {
            await env.DB.batch(statements);
        }
        return jsonResponse({ ok: true, featureFlags: await getFeatureFlags(env.DB) });
    }

    if (path === '/api/admin/festival-theme') {
        const body = await readJson(request);
        if (!body || typeof body !== 'object') return jsonError(400, 'Festival theme payload required.');
        const enabled = body.enabled === true;
        const festival = enabled && typeof body.festival === 'string' && body.festival !== 'none' ? body.festival : 'none';
        const targets = {
            customer: body.targets ? Boolean(body.targets.customer) : true,
            owner: body.targets ? Boolean(body.targets.owner) : true,
            captain: body.targets ? Boolean(body.targets.captain) : true
        };
        const greeting = typeof body.greeting === 'string' ? body.greeting.trim() : '';

        const themeConfig = {
            enabled,
            festival,
            targets,
            greeting,
            updated_at: new Date().toISOString(),
            updated_by: auth.identifier
        };

        await env.DB.prepare(
            `INSERT INTO platform_features (feature_key, enabled, config)
             VALUES ('festivalTheme', ?, ?)
             ON CONFLICT (feature_key) DO UPDATE SET enabled = excluded.enabled, config = excluded.config`
        ).bind(enabled ? 1 : 0, JSON.stringify(themeConfig)).run();

        await writeFirestoreDocument(env, 'system_config/festivalTheme', {
            enabled,
            festival,
            targets,
            greeting,
            updated_at: themeConfig.updated_at
        });

        const updatedFlags = await getFeatureFlags(env.DB);
        return jsonResponse({ ok: true, featureFlags: updatedFlags, festivalTheme: themeConfig });
    }

    // POST or PUT /api/owner/buses/:id/settings
    const settingsMatch = path.match(/^\/api\/owner\/buses\/([^/]+)\/settings$/);
    if (settingsMatch) {
        const busId = decodeURIComponent(settingsMatch[1]);
        const body = await readJson(request);
        if (!body) return jsonError(400, 'Settings payload required.');
        const ownedBus = await env.DB.prepare('SELECT id, driver_phone FROM buses WHERE id = ? AND owner_phone = ?')
            .bind(busId, auth.identifier).first();
        if (!ownedBus) return jsonError(404, 'Bus not found.');
        const captainPhone = String(body.captainPhone || '').trim();
        const captainPin = String(body.captainPin || '');
        if ((captainPin && !/^[6-9]\d{9}$/.test(captainPhone)) ||
            (captainPhone && captainPhone !== ownedBus.driver_phone && !captainPin) ||
            (captainPin && !/^\d{4}$/.test(captainPin))) {
            return jsonError(400, 'Set both a valid captain mobile number and a 4-digit PIN.');
        }

        let finalImage = null;
        let pendingImagesVal = null;
        let photoApprovalStatusVal = null;

        if (Array.isArray(body.images)) {
            const cleanImages = body.images.filter(img =>
                typeof img === 'string' &&
                img.length <= 600000 &&
                (img.startsWith('data:image/') || /^https?:\/\//i.test(img))
            ).slice(0, 8);
            if (body.images.some(img => typeof img === 'string' && img.length > 600000)) {
                return jsonError(413, 'বাসের প্রতিটি ছবির সাইজ ৫০০ KB এর কম হতে হবে। অনুগ্রহ করে ছোট ছবি আপলোড করুন।');
            }
            if (cleanImages.length <= 3) {
                finalImage = cleanImages.length > 0 ? JSON.stringify(cleanImages) : null;
                pendingImagesVal = '[]';
                photoApprovalStatusVal = 'approved';
            } else {
                // First 3 photos stay live immediately for customers
                finalImage = JSON.stringify(cleanImages.slice(0, 3));
                // All photos (including extra) are placed in pending_images for Admin review
                pendingImagesVal = JSON.stringify(cleanImages);
                photoApprovalStatusVal = 'pending';
            }
        } else if (body.image) {
            if (typeof body.image === 'string' && body.image.length > 600000) {
                return jsonError(413, 'বাসের ছবির সাইজ ৫০০ KB এর কম হতে হবে।');
            }
            finalImage = body.image;
        }

        let totalSeatsVal = null;
        if (body.totalSeats !== undefined && body.totalSeats !== null && body.totalSeats !== '') {
            const parsedSeats = Number(body.totalSeats);
            if (!Number.isInteger(parsedSeats) || parsedSeats < 10 || parsedSeats > 100) {
                return jsonError(400, 'মোট সিট ১০ থেকে ১০০ এর মধ্যে হতে হবে।');
            }
            totalSeatsVal = parsedSeats;
        }
        let fareVal = null;
        if (body.fare !== undefined && body.fare !== null && body.fare !== '') {
            const parsedFare = Number(body.fare);
            if (!Number.isFinite(parsedFare) || parsedFare <= 0 || parsedFare > 50000) {
                return jsonError(400, 'বৈধ ভাড়া (₹1 - ₹50,000) দিন।');
            }
            fareVal = parsedFare;
        }
        const farePerStopVal = (body.farePerStop !== undefined && body.farePerStop !== null && Number.isFinite(Number(body.farePerStop))) ? Number(body.farePerStop) : null;
        const farePerKmVal = (body.farePerKm !== undefined && body.farePerKm !== null && Number.isFinite(Number(body.farePerKm))) ? Number(body.farePerKm) : null;
        const allowOnlineVal = body.allowOnlinePayment !== undefined ? (body.allowOnlinePayment ? 1 : 0) : null;
        const allowCashVal = body.allowCashPayment !== undefined ? (body.allowCashPayment ? 1 : 0) : null;
        const upiIdVal = body.upiId !== undefined ? String(body.upiId).trim() : null;
        const companyNameVal = body.companyName !== undefined ? String(body.companyName).trim() : null;
        const gstNumberVal = body.gstNumber !== undefined ? String(body.gstNumber).trim() : null;
        const ticketTermsVal = body.ticketTerms !== undefined ? String(body.ticketTerms).trim() : null;
        const emergencyPhoneVal = body.emergencyPhone !== undefined ? String(body.emergencyPhone).trim() : null;

        const stoppagesPayload = Array.isArray(body.stoppages) ? JSON.stringify(body.stoppages) : null;
        const stoppageTimingsPayload = (body.stoppageTimings || body.stoppage_timings)
            ? JSON.stringify(body.stoppageTimings || body.stoppage_timings)
            : null;
        const routeVal = body.route ? String(body.route).trim() : null;
        const timeVal = body.time ? String(body.time).trim() : null;
        const returnRouteVal = body.returnRoute !== undefined ? String(body.returnRoute).trim() : null;
        const returnTimeVal = body.returnTime !== undefined ? String(body.returnTime).trim() : null;
        const returnStoppagesPayload = body.returnStoppages !== undefined ? (Array.isArray(body.returnStoppages) ? JSON.stringify(body.returnStoppages) : String(body.returnStoppages)) : null;
        const returnStoppageTimingsPayload = (body.returnStoppageTimings !== undefined || body.return_stoppage_timings !== undefined)
            ? JSON.stringify(body.returnStoppageTimings || body.return_stoppage_timings || {})
            : null;
        let returnFareVal = null;
        if (body.returnFare !== undefined && body.returnFare !== null && body.returnFare !== '') {
            const parsedRetFare = Number(body.returnFare);
            if (!Number.isFinite(parsedRetFare) || parsedRetFare <= 0 || parsedRetFare > 50000) {
                return jsonError(400, 'বৈধ রিটার্ন ভাড়া দিন।');
            }
            returnFareVal = parsedRetFare;
        }
        await ensureEnterpriseSegmentTables(env.DB);
        const returnRouteEnabledVal = body.returnRouteEnabled !== undefined ? (body.returnRouteEnabled ? 1 : 0) : null;
        const stoppageFaresPayload = (body.stoppageFares !== undefined || body.stoppage_fares !== undefined)
            ? sanitizeStoppageFaresInput(body.stoppageFares || body.stoppage_fares)
            : null;
        const returnStoppageFaresPayload = (body.returnStoppageFares !== undefined || body.return_stoppage_fares !== undefined)
            ? sanitizeStoppageFaresInput(body.returnStoppageFares || body.return_stoppage_fares)
            : null;

        const resubmit = body.resubmitApproval === true;
        const approvalClause = resubmit ? ", approval_status = 'pending', rejection_reason = ''" : "";

        await env.DB.prepare(
            `UPDATE buses SET
                total_seats = COALESCE(?, total_seats),
                upi_id = COALESCE(?, upi_id),
                fare = COALESCE(?, fare),
                fare_per_stop = COALESCE(?, fare_per_stop),
                fare_per_km = COALESCE(?, fare_per_km),
                allow_online_payment = COALESCE(?, allow_online_payment),
                allow_cash_payment = COALESCE(?, allow_cash_payment),
                company_name = COALESCE(?, company_name),
                gst_number = COALESCE(?, gst_number),
                ticket_terms = COALESCE(?, ticket_terms),
                emergency_phone = COALESCE(?, emergency_phone),
                driver_phone = COALESCE(?, driver_phone),
                image = COALESCE(?, image),
                pending_images = COALESCE(?, pending_images),
                photo_approval_status = COALESCE(?, photo_approval_status),
                booking_mode = COALESCE(?, booking_mode),
                route = COALESCE(?, route),
                time = COALESCE(?, time),
                stoppages = COALESCE(?, stoppages),
                stoppage_timings = COALESCE(?, stoppage_timings),
                seat_layout = COALESCE(?, seat_layout),
                return_route_enabled = COALESCE(?, return_route_enabled),
                return_time = COALESCE(?, return_time),
                return_route = COALESCE(?, return_route),
                return_stoppages = COALESCE(?, return_stoppages),
                return_stoppage_timings = COALESCE(?, return_stoppage_timings),
                return_fare = COALESCE(?, return_fare),
                stoppage_fares = COALESCE(?, stoppage_fares),
                return_stoppage_fares = COALESCE(?, return_stoppage_fares)
                ${approvalClause}
             WHERE id = ?`
        ).bind(
            totalSeatsVal,
            upiIdVal || null,
            fareVal,
            farePerStopVal,
            farePerKmVal,
            allowOnlineVal,
            allowCashVal,
            companyNameVal,
            gstNumberVal,
            ticketTermsVal,
            emergencyPhoneVal,
            captainPhone || null,
            finalImage,
            pendingImagesVal,
            photoApprovalStatusVal,
            body.bookingMode || null,
            routeVal,
            timeVal,
            stoppagesPayload,
            stoppageTimingsPayload,
            (body.seatLayout || body.seat_layout) ? (typeof (body.seatLayout || body.seat_layout) === 'object' ? JSON.stringify(body.seatLayout || body.seat_layout) : String(body.seatLayout || body.seat_layout)) : null,
            returnRouteEnabledVal,
            returnTimeVal,
            returnRouteVal,
            returnStoppagesPayload,
            returnStoppageTimingsPayload,
            returnFareVal,
            stoppageFaresPayload,
            returnStoppageFaresPayload,
            busId
        ).run();

        if (captainPhone && captainPin) {
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND bus_id = ?")
                .bind(busId).run();
            await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'captain' AND bus_id = ?")
                .bind(busId).run();
            await saveCredential(env.DB, {
                role: 'captain',
                identifier: captainPhone,
                busId,
                pin: captainPin
            });
        }

        return jsonResponse({
            ok: true,
            photoApprovalStatus: photoApprovalStatusVal,
            photoCount: Array.isArray(body.images) ? body.images.length : (body.image ? 1 : 0),
            message: photoApprovalStatusVal === 'pending'
                ? 'প্রথম ৩টি ছবি লাইভ হয়েছে এবং অতিরিক্ত ছবিগুলি অ্যাডমিনের অনুমোদনের জন্য জমা হয়েছে।'
                : 'বাসের রুট, সময়সূচি ও সেটিংস সফলভাবে সেভ হয়েছে।'
        });
    }

    // POST /api/owner/buses/:id/photos/delete
    const ownerPhotoDeleteMatch = path.match(/^\/api\/owner\/buses\/([^/]+)\/photos\/delete$/);
    if (ownerPhotoDeleteMatch) {
        if (auth?.role !== 'owner') return jsonError(403, 'Unauthorized.');
        const busId = decodeURIComponent(ownerPhotoDeleteMatch[1]);
        const body = await readJson(request);
        const indexToDelete = parseInt(body?.photoIndex, 10);
        const urlToDelete = body?.photoUrl;

        const bus = await env.DB.prepare('SELECT id, image, pending_images, photo_approval_status FROM buses WHERE id = ? AND owner_phone = ?')
            .bind(busId, auth.identifier).first();
        if (!bus) return jsonError(404, 'Bus not found.');

        let liveImages = parseJson(bus.image, []);
        if (!Array.isArray(liveImages)) liveImages = bus.image ? [bus.image] : [];
        let pendingImages = parseJson(bus.pending_images, []);
        if (!Array.isArray(pendingImages)) pendingImages = [];

        let activeSet = (pendingImages.length > 0) ? pendingImages : liveImages;

        if (Number.isInteger(indexToDelete) && indexToDelete >= 0 && indexToDelete < activeSet.length) {
            activeSet.splice(indexToDelete, 1);
        } else if (urlToDelete) {
            activeSet = activeSet.filter(u => u !== urlToDelete);
        }

        let newLive = [];
        let newPending = [];
        let newStatus = 'approved';

        if (activeSet.length <= 3) {
            newLive = activeSet;
            newPending = [];
            newStatus = 'approved';
        } else {
            newLive = activeSet.slice(0, 3);
            newPending = activeSet;
            newStatus = 'pending';
        }

        const finalImageStr = newLive.length > 0 ? JSON.stringify(newLive) : JSON.stringify(['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60']);
        const finalPendingStr = JSON.stringify(newPending);

        await env.DB.prepare('UPDATE buses SET image = ?, pending_images = ?, photo_approval_status = ? WHERE id = ?')
            .bind(finalImageStr, finalPendingStr, newStatus, busId).run();

        return jsonResponse({
            ok: true,
            images: activeSet.length > 0 ? activeSet : parseJson(finalImageStr, []),
            photoApprovalStatus: newStatus,
            message: 'ছবিটি সফলভাবে ডিলিট করা হয়েছে।'
        });
    }

    // POST /api/admin/buses/:id/photos/delete
    const adminPhotoDeleteMatch = path.match(/^\/api\/admin\/buses\/([^/]+)\/photos\/delete$/);
    if (adminPhotoDeleteMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const busId = decodeURIComponent(adminPhotoDeleteMatch[1]);
        const body = await readJson(request);
        const indexToDelete = parseInt(body?.photoIndex, 10);
        const urlToDelete = body?.photoUrl;

        const bus = await env.DB.prepare('SELECT id, image, pending_images FROM buses WHERE id = ?').bind(busId).first();
        if (!bus) return jsonError(404, 'Bus not found.');

        let liveImages = parseJson(bus.image, []);
        if (!Array.isArray(liveImages)) liveImages = bus.image ? [bus.image] : [];
        let pendingImages = parseJson(bus.pending_images, []);
        if (!Array.isArray(pendingImages)) pendingImages = [];

        let activeSet = (pendingImages.length > 0) ? pendingImages : liveImages;

        if (Number.isInteger(indexToDelete) && indexToDelete >= 0 && indexToDelete < activeSet.length) {
            activeSet.splice(indexToDelete, 1);
        } else if (urlToDelete) {
            activeSet = activeSet.filter(u => u !== urlToDelete);
        }

        const finalImageStr = activeSet.length > 0 ? JSON.stringify(activeSet) : JSON.stringify(['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60']);
        await env.DB.prepare("UPDATE buses SET image = ?, pending_images = '[]', photo_approval_status = 'approved' WHERE id = ?")
            .bind(finalImageStr, busId).run();

        return jsonResponse({
            ok: true,
            images: parseJson(finalImageStr, []),
            message: 'ছবিটি সফলভাবে ডিলিট করা হয়েছে।'
        });
    }

    // POST /api/admin/buses/:id/photos/approve
    const adminPhotoApproveMatch = path.match(/^\/api\/admin\/buses\/([^/]+)\/photos\/approve$/);
    if (adminPhotoApproveMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const busId = decodeURIComponent(adminPhotoApproveMatch[1]);
        const bus = await env.DB.prepare('SELECT id, name, owner_phone, pending_images FROM buses WHERE id = ?').bind(busId).first();
        if (!bus) return jsonError(404, 'Bus not found.');

        const pendingImages = parseJson(bus.pending_images, []);
        if (!pendingImages || pendingImages.length === 0) {
            return jsonError(400, 'অনুমোদনের জন্য কোনো অতিরিক্ত ছবি পেন্ডিং নেই।');
        }

        await env.DB.prepare("UPDATE buses SET image = ?, pending_images = '[]', photo_approval_status = 'approved', photo_rejection_reason = '' WHERE id = ?")
            .bind(JSON.stringify(pendingImages), busId).run();

        await recordAdminAudit(env.DB, auth, 'approve_bus_photos', busId, { count: pendingImages.length });

        if (bus.owner_phone) {
            try {
                await env.DB.prepare(`
                    INSERT INTO notifications (id, sender_role, target_group, owner_phone, bus_id, title, message, status, created_at)
                    VALUES (?, 'admin', 'owners', ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
                `).bind(
                    'notif_' + Date.now(),
                    bus.owner_phone,
                    busId,
                    '🎉 আপনার বাসের সব ছবি অনুমোদন করা হয়েছে!',
                    `আপনার বাস "${bus.name}"-এর সবকটি ছবি (${pendingImages.length}টি) সেন্ট্রাল অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং এখন কাস্টমার প্যানেলে লাইভ প্রদর্শিত হচ্ছে।`
                ).run();
            } catch (ne) {
                console.warn('Photo approval notif notice:', ne);
            }
        }

        return jsonResponse({
            ok: true,
            busId,
            images: pendingImages,
            photoApprovalStatus: 'approved',
            message: 'বাসের সবকটি ছবি সফলভাবে অনুমোদন করা হয়েছে এবং লাইভ করা হয়েছে!'
        });
    }

    // POST /api/admin/buses/:id/photos/reject
    const adminPhotoRejectMatch = path.match(/^\/api\/admin\/buses\/([^/]+)\/photos\/reject$/);
    if (adminPhotoRejectMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const busId = decodeURIComponent(adminPhotoRejectMatch[1]);
        const body = await readJson(request);
        const reason = String(body?.reason || 'ছবির মান বা সামগ্রী যথাযথ নয় (Inappropriate photo content)').trim();

        const bus = await env.DB.prepare('SELECT id, name, owner_phone FROM buses WHERE id = ?').bind(busId).first();
        if (!bus) return jsonError(404, 'Bus not found.');

        await env.DB.prepare("UPDATE buses SET pending_images = '[]', photo_approval_status = 'rejected', photo_rejection_reason = ? WHERE id = ?")
            .bind(reason, busId).run();

        await recordAdminAudit(env.DB, auth, 'reject_bus_photos', busId, { reason });

        if (bus.owner_phone) {
            try {
                await env.DB.prepare(`
                    INSERT INTO notifications (id, sender_role, target_group, owner_phone, bus_id, title, message, status, created_at)
                    VALUES (?, 'admin', 'owners', ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
                `).bind(
                    'notif_' + Date.now(),
                    bus.owner_phone,
                    busId,
                    '⚠️ বাসের অতিরিক্ত ছবি বাতিল করা হয়েছে',
                    `আপনার বাস "${bus.name}"-এর ৩টির বেশি অতিরিক্ত ছবিগুলো অ্যাডমিন বাতিল করেছেন। কারণ: ${reason}। তবে প্রথম ৩টি ছবি স্বাভাবিকভাবে লাইভ থাকবে।`
                ).run();
            } catch (ne) {
                console.warn('Photo reject notif notice:', ne);
            }
        }

        return jsonResponse({
            ok: true,
            busId,
            photoApprovalStatus: 'rejected',
            message: 'অতিরিক্ত ছবিগুলো বাতিল করা হয়েছে।'
        });
    }

    // POST or PATCH /api/owner/buses/:id/booking-mode
    const ownerBookingModeMatch = path.match(/^\/api\/owner\/buses(?:\/([^/]+))?\/booking-mode$/);
    if (ownerBookingModeMatch || path === '/api/owner/buses/booking-mode') {
        const body = await readJson(request);
        const busId = (ownerBookingModeMatch && ownerBookingModeMatch[1]) ? decodeURIComponent(ownerBookingModeMatch[1]) : body?.busId;
        const mode = String(body?.bookingMode || 'active').toLowerCase();
        if (!['active', 'auto_pilot', 'inactive'].includes(mode)) {
            return jsonError(400, 'Invalid booking mode. Choose active, auto_pilot, or inactive.');
        }
        const ownedBus = await env.DB.prepare('SELECT id FROM buses WHERE id = ? AND owner_phone = ?')
            .bind(busId, auth.identifier).first();
        if (!ownedBus) return jsonError(404, 'Bus not found or unauthorized.');
        await env.DB.prepare('UPDATE buses SET booking_mode = ? WHERE id = ?').bind(mode, busId).run();
        return jsonResponse({ ok: true, busId, bookingMode: mode });
    }

    // POST or PUT /api/owner/buses/:id/seat-layout
    const ownerSeatLayoutMatch = path.match(/^\/api\/owner\/buses(?:\/([^/]+))?\/seat-layout$/);
    if (ownerSeatLayoutMatch || path === '/api/owner/buses/seat-layout') {
        const body = await readJson(request);
        const busId = (ownerSeatLayoutMatch && ownerSeatLayoutMatch[1]) ? decodeURIComponent(ownerSeatLayoutMatch[1]) : body?.busId;
        if (!busId) return jsonError(400, 'Bus ID is required.');
        const ownedBus = await env.DB.prepare('SELECT id FROM buses WHERE id = ? AND owner_phone = ?')
            .bind(busId, auth.identifier).first();
        if (!ownedBus) return jsonError(404, 'Bus not found or unauthorized.');
        const layout = body?.seatLayout || body?.layout;
        const totalSeats = Number(body?.totalSeats || (layout && layout.totalSeats) || 65);
        const layoutStr = layout ? (typeof layout === 'object' ? JSON.stringify(layout) : String(layout)) : null;
        await env.DB.prepare('UPDATE buses SET seat_layout = ?, total_seats = ? WHERE id = ?')
            .bind(layoutStr, totalSeats, busId).run();
        return jsonResponse({ ok: true, busId, totalSeats, seatLayout: layout });
    }

    // POST or PUT /api/admin/buses/:id/seat-layout
    const adminSeatLayoutMatch = path.match(/^\/api\/admin\/buses(?:\/([^/]+))?\/seat-layout$/);
    if (adminSeatLayoutMatch || path === '/api/admin/buses/seat-layout') {
        const body = await readJson(request);
        const busId = (adminSeatLayoutMatch && adminSeatLayoutMatch[1]) ? decodeURIComponent(adminSeatLayoutMatch[1]) : body?.busId;
        if (!busId) return jsonError(400, 'Bus ID is required.');
        const layout = body?.seatLayout || body?.layout;
        const totalSeats = Number(body?.totalSeats || (layout && layout.totalSeats) || 65);
        const layoutStr = layout ? (typeof layout === 'object' ? JSON.stringify(layout) : String(layout)) : null;
        await env.DB.prepare('UPDATE buses SET seat_layout = ?, total_seats = ? WHERE id = ?')
            .bind(layoutStr, totalSeats, busId).run();
        return jsonResponse({ ok: true, busId, totalSeats, seatLayout: layout });
    }

    // POST /api/owner/buses (Owner adding a new bus to their fleet - requires Admin approval)
    if (path === '/api/owner/buses' && auth?.role === 'owner') {
        const body = await readJson(request);
        const name = String(body?.name || '').trim();
        const busNumber = String(body?.busNumber || body?.bus_number || '').trim().toUpperCase();
        const route = String(body?.route || 'Pingla - Kolkata').trim();
        const time = String(body?.time || '07:00 AM').trim();
        const fare = Number(body?.fare) || 399;
        const totalSeats = Number(body?.totalSeats) || 65;
        let stoppages = body?.stoppages;
        if (!stoppages || !Array.isArray(stoppages) || stoppages.length < 2) {
            stoppages = route.split(/[-–➔>,]/).map(s => s.trim()).filter(Boolean);
            if (stoppages.length < 2) stoppages = ['Pingla', 'Debra', 'Kharagpur', 'Kolaghat', 'Kolkata'];
        }
        const stoppageTimings = (body?.stoppageTimings || body?.stoppage_timings) && typeof (body?.stoppageTimings || body?.stoppage_timings) === 'object'
            ? JSON.stringify(body.stoppageTimings || body.stoppage_timings)
            : '{}';

        // Return Trip details
        const returnRouteEnabled = body?.returnRouteEnabled ? 1 : 0;
        const returnTime = String(body?.returnTime || '').trim();
        const returnRoute = String(body?.returnRoute || (stoppages.slice().reverse().join(' - '))).trim();
        let returnStoppages = body?.returnStoppages;
        if (!returnStoppages || !Array.isArray(returnStoppages) || returnStoppages.length < 2) {
            returnStoppages = stoppages.slice().reverse();
        }
        const returnStoppageTimings = (body?.returnStoppageTimings || body?.return_stoppage_timings) && typeof (body?.returnStoppageTimings || body?.return_stoppage_timings) === 'object'
            ? JSON.stringify(body.returnStoppageTimings || body.return_stoppage_timings)
            : '{}';
        const returnFare = Number(body?.returnFare) || fare;

        if (!name || name.length < 2) return jsonError(400, 'Enter a valid bus name.');
        if (busNumber.length < 3) return jsonError(400, 'Enter a valid bus registration number.');

        await ensureEnterpriseSegmentTables(env.DB);
        const owner = await env.DB.prepare('SELECT * FROM owners WHERE phone = ?').bind(auth.identifier).first();
        const busId = `BUS_${Date.now()}_${secureRandomHex(4)}`;
        const stoppageFaresPayload = sanitizeStoppageFaresInput(body?.stoppageFares || body?.stoppage_fares);
        const returnStoppageFaresPayload = sanitizeStoppageFaresInput(body?.returnStoppageFares || body?.return_stoppage_fares);
        const ownerFarePerStop = Number(body?.farePerStop) > 0 ? Number(body.farePerStop) : 45;

        // New bus created by owner has 'pending' approval status until admin approves
        await env.DB.prepare(
            `INSERT INTO buses (
                id, name, bus_number, owner_name, owner_phone, owner_email, route,
                active_routes, stoppages, stoppage_timings, fare_per_stop, fare_per_km, window_seat_extra, time, fare, total_seats, image, driver_phone,
                company_name, ticket_terms, emergency_phone, allow_online_payment, allow_cash_payment,
                approval_status, rejection_reason, return_route_enabled, return_time, return_route, return_stoppages, return_stoppage_timings, return_fare,
                stoppage_fares, return_stoppage_fares
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3.5, 30, ?, ?, ?, '', '',
                       ?, 'Please arrive 15 minutes before scheduled departure.', ?, 1, 1,
                       'pending', '', ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            busId,
            name,
            busNumber,
            (owner && owner.name) || 'Bus Owner',
            auth.identifier,
            (owner && owner.email) || '',
            route,
            JSON.stringify([route]),
            JSON.stringify(stoppages),
            stoppageTimings,
            ownerFarePerStop,
            time,
            fare,
            totalSeats,
            (owner && owner.company_name) || name,
            auth.identifier,
            returnRouteEnabled,
            returnTime,
            returnRoute,
            JSON.stringify(returnStoppages),
            returnStoppageTimings,
            returnFare,
            stoppageFaresPayload,
            returnStoppageFaresPayload
        ).run();

        return jsonResponse({
            ok: true,
            approvalPending: true,
            message: 'বাসটি সফলভাবে যোগ করা হয়েছে। অ্যাডমিনের চূড়ান্ত অনুমোদনের পর এটি লাইভ হবে। (Bus added successfully. It will be live after Admin approval.)',
            bus: {
                id: busId,
                name,
                busNumber,
                route,
                time,
                fare,
                totalSeats,
                stoppages,
                stoppageTimings: parseJson(stoppageTimings, {}),
                approvalStatus: 'pending',
                returnRouteEnabled: Boolean(returnRouteEnabled),
                returnTime,
                returnRoute,
                returnStoppages,
                returnFare
            }
        });
    }

    // POST /api/captain/bookings/:id/board (Passenger Boarding confirmation)
    const captainBoardMatch = path.match(/^\/api\/captain\/bookings\/([^/]+)\/board$/);
    if (captainBoardMatch) {
        const bookingId = decodeURIComponent(captainBoardMatch[1]);
        const result = await env.DB.prepare(
            "UPDATE bookings SET boarded = 1 WHERE id = ? AND (bus_id = ? OR bus_id = ?) AND status = 'Approved'"
        ).bind(bookingId, auth.busId, (auth.busId || '') + '_RETURN').run();
        if (!result.meta?.changes) return jsonError(404, 'Approved booking not found for this bus.');
        return jsonResponse({ ok: true, boarded: true });
    }

    // POST /api/captain/location
    if (path === '/api/captain/location') {
        const body = await readJson(request);
        if (!body || !Number.isFinite(body.lat) || !Number.isFinite(body.lng) ||
            body.lat < -90 || body.lat > 90 || body.lng < -180 || body.lng > 180) {
            return jsonError(400, 'Valid lat and lng required.');
        }
        let targetBusId = auth.busId ? String(auth.busId).replace('_RETURN', '') : '';
        if (!targetBusId && auth.identifier) {
            const captainRow = await env.DB.prepare("SELECT bus_id FROM captains WHERE phone = ?").bind(auth.identifier).first();
            if (captainRow && captainRow.bus_id) targetBusId = String(captainRow.bus_id).replace('_RETURN', '');
            if (!targetBusId) {
                const bRow = await env.DB.prepare("SELECT id FROM buses WHERE driver_phone = ?").bind(auth.identifier).first();
                if (bRow && bRow.id) targetBusId = bRow.id;
            }
        }
        if (!targetBusId) {
            return jsonError(403, 'No assigned bus found for this captain account.');
        }
        if (body.busId && String(body.busId).replace('_RETURN', '') !== targetBusId) {
            return jsonError(403, 'You can only update GPS location for your own assigned bus.');
        }
        const flags = await getFeatureFlags(env.DB);
        if (flags.captainPortal === false || flags.liveTracking === false) {
            return jsonError(403, 'Captain GPS sharing is currently disabled.');
        }

        const busRecord = await env.DB.prepare('SELECT id, name, bus_number, owner_phone FROM buses WHERE id = ?').bind(targetBusId).first();
        if (!busRecord) return jsonError(404, 'Bus not found.');
        if (busRecord.owner_phone) {
            try {
                const ownerAcl = await env.DB.prepare('SELECT status FROM access_control_list WHERE phone = ?').bind(busRecord.owner_phone).first();
                if (ownerAcl && (ownerAcl.status === 'suspended' || ownerAcl.status === 'blocked' || ownerAcl.status === 'permanently_banned')) {
                    return jsonError(403, 'Bus owner account is suspended. GPS broadcast halted.');
                }
            } catch (oe) {}
        }
        await ensureEnterpriseSegmentTables(env.DB);
        const nowIso = new Date().toISOString();
        const rawStopName = body.stopName ?? body.stoppage ?? body.currentStoppage;
        const stopNameClean = (typeof rawStopName === 'string' && rawStopName.trim()) ? rawStopName.trim().slice(0, 80) : null;
        const result = stopNameClean
            ? await env.DB.prepare(
                'UPDATE buses SET lat = ?, lng = ?, location_updated_at = ?, current_stoppage = ?, current_stoppage_updated_at = ? WHERE id = ?'
            ).bind(body.lat, body.lng, nowIso, stopNameClean, nowIso, targetBusId).run()
            : await env.DB.prepare(
                'UPDATE buses SET lat = ?, lng = ?, location_updated_at = ? WHERE id = ?'
            ).bind(body.lat, body.lng, nowIso, targetBusId).run();
        if (!result.meta?.changes) return jsonError(404, 'Bus not found.');

        await writeFirestoreDocument(env, `bus_locations/${targetBusId}`, {
            busId: targetBusId,
            busName: busRecord.name || 'Bus Yatra Express',
            busNumber: busRecord.bus_number || '',
            lat: Number(body.lat),
            lng: Number(body.lng),
            speed: Number.isFinite(Number(body.speed)) ? Number(body.speed) : 0,
            accuracy: Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : 10,
            heading: body.heading !== null && body.heading !== undefined && Number.isFinite(Number(body.heading)) ? Number(body.heading) : null,
            stopName: typeof body.stopName === 'string' && body.stopName.trim() ? body.stopName.trim().slice(0, 80) : null,
            updated_at: nowIso
        });

        return jsonResponse({ ok: true, busId: targetBusId, lat: body.lat, lng: body.lng, updatedAt: nowIso });
    }

    // POST or PUT /api/owner/buses/:id/location
    const locMatch = path.match(/^\/api\/owner\/buses\/([^/]+)\/location$/);
    if (locMatch) {
        const busId = decodeURIComponent(locMatch[1]).replace('_RETURN', '');
        const body = await readJson(request);
        if (!body || !Number.isFinite(body.lat) || !Number.isFinite(body.lng) ||
            body.lat < -90 || body.lat > 90 || body.lng < -180 || body.lng > 180) {
            return jsonError(400, 'lat and lng required.');
        }
        const ownedBus = await env.DB.prepare('SELECT id, name, bus_number FROM buses WHERE id = ? AND owner_phone = ?')
            .bind(busId, auth.identifier).first();
        if (!ownedBus) return jsonError(404, 'Bus not found.');
        const nowIso = new Date().toISOString();
        await env.DB.prepare(
            'UPDATE buses SET lat = ?, lng = ?, location_updated_at = ? WHERE id = ?'
        ).bind(body.lat, body.lng, nowIso, busId).run();

        await writeFirestoreDocument(env, `bus_locations/${busId}`, {
            busId,
            busName: ownedBus.name || 'Bus Yatra Express',
            busNumber: ownedBus.bus_number || '',
            lat: Number(body.lat),
            lng: Number(body.lng),
            speed: Number.isFinite(Number(body.speed)) ? Number(body.speed) : 0,
            accuracy: Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : 10,
            heading: null,
            stopName: typeof body.stopName === 'string' && body.stopName.trim() ? body.stopName.trim().slice(0, 80) : null,
            updated_at: nowIso
        });

        return jsonResponse({ ok: true });
    }

    // POST /api/admin/buses/rating or PATCH /api/admin/buses/:id/rating
    const adminRatingMatch = path.match(/^\/api\/admin\/buses(?:\/([^/]+))?\/rating$/);
    if (adminRatingMatch || path === '/api/admin/buses/rating') {
        const body = await readJson(request);
        const busId = (adminRatingMatch && adminRatingMatch[1]) ? decodeURIComponent(adminRatingMatch[1]) : body?.busId;
        if (!busId) return jsonError(400, 'Bus ID is required.');
        const rawRating = parseFloat(body?.rating);
        const rating = Math.min(5.0, Math.max(1.0, Number.isFinite(rawRating) ? Math.round(rawRating * 10) / 10 : 4.8));
        await env.DB.prepare('UPDATE buses SET rating = ? WHERE id = ?').bind(rating, busId).run();
        return jsonResponse({ ok: true, busId, rating });
    }

    // POST /api/admin/buses/:id/approve
    const adminBusApproveMatch = path.match(/^\/api\/admin\/buses\/([^/]+)\/approve$/);
    if (adminBusApproveMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const busId = decodeURIComponent(adminBusApproveMatch[1]);
        const bus = await env.DB.prepare('SELECT id, name, owner_phone FROM buses WHERE id = ?').bind(busId).first();
        if (!bus) return jsonError(404, 'Bus not found.');
        await env.DB.prepare("UPDATE buses SET approval_status = 'approved', rejection_reason = '' WHERE id = ?").bind(busId).run();
        await recordAdminAudit(env.DB, auth, 'approve_bus', busId, { busName: bus.name, ownerPhone: bus.owner_phone });
        if (bus.owner_phone) {
            try {
                await env.DB.prepare(`
                    INSERT INTO notifications (id, sender_role, target_group, owner_phone, bus_id, title, message, status, created_at)
                    VALUES (?, 'admin', 'owners', ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
                `).bind(
                    'notif_' + Date.now(),
                    bus.owner_phone,
                    busId,
                    '🎉 আপনার বাস অনুমোদন করা হয়েছে! (Bus Approved)',
                    `আপনার বাস "${bus.name}" অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং এটি এখন বুকিংয়ের জন্য লাইভ রয়েছে।`
                ).run();
            } catch (ne) {
                console.warn('Bus approval notification notice:', ne);
            }
        }
        return jsonResponse({ ok: true, busId, approvalStatus: 'approved', message: 'বাসটি সফলভাবে অনুমোদন করা হয়েছে এবং লাইভ করা হয়েছে।' });
    }

    // POST /api/admin/buses/:id/reject
    const adminBusRejectMatch = path.match(/^\/api\/admin\/buses\/([^/]+)\/reject$/);
    if (adminBusRejectMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const busId = decodeURIComponent(adminBusRejectMatch[1]);
        const body = await readJson(request);
        const reason = String(body?.reason || 'তথ্য বা নথিপত্র অসম্পূর্ণ (Incomplete or invalid details)').trim();
        const bus = await env.DB.prepare('SELECT id, name, owner_phone FROM buses WHERE id = ?').bind(busId).first();
        if (!bus) return jsonError(404, 'Bus not found.');
        await env.DB.prepare("UPDATE buses SET approval_status = 'rejected', rejection_reason = ? WHERE id = ?").bind(reason, busId).run();
        await recordAdminAudit(env.DB, auth, 'reject_bus', busId, { busName: bus.name, ownerPhone: bus.owner_phone, reason });
        if (bus.owner_phone) {
            try {
                await env.DB.prepare(`
                    INSERT INTO notifications (id, sender_role, target_group, owner_phone, bus_id, title, message, status, created_at)
                    VALUES (?, 'admin', 'owners', ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
                `).bind(
                    'notif_' + Date.now(),
                    bus.owner_phone,
                    busId,
                    '⚠️ আপনার বাসের অনুমোদন বাতিল করা হয়েছে (Bus Rejected)',
                    `আপনার বাস "${bus.name}" অ্যাডমিন বাতিল করেছে। কারণ: ${reason}। তথ্য সংশোধন করে আবার অনুরোধ পাঠাতে পারেন।`
                ).run();
            } catch (ne) {
                console.warn('Bus rejection notification notice:', ne);
            }
        }
        return jsonResponse({ ok: true, busId, approvalStatus: 'rejected', rejectionReason: reason, message: 'বাসটি বাতিল করা হয়েছে।' });
    }

    // POST /api/admin/buses/:id/payment-rules (Admin toggle payment rules per bus)
    const adminBusPayRulesMatch = path.match(/^\/api\/admin\/buses\/([^/]+)\/payment-rules$/);
    if (adminBusPayRulesMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const busId = decodeURIComponent(adminBusPayRulesMatch[1]);
        const body = await readJson(request);
        const requireScreenshot = body.requirePaymentScreenshot !== undefined ? (body.requirePaymentScreenshot ? 1 : 0) : 1;
        const enableUtr = body.enableUtr !== undefined ? (body.enableUtr ? 1 : 0) : 0;
        await env.DB.prepare(
            'UPDATE buses SET require_payment_screenshot = ?, enable_utr = ? WHERE id = ?'
        ).bind(requireScreenshot, enableUtr, busId).run();
        return jsonResponse({ ok: true, busId, requirePaymentScreenshot: Boolean(requireScreenshot), enableUtr: Boolean(enableUtr) });
    }

    // POST /api/admin/owners/:phone/payment-rules (Admin toggle payment rules owner-wise for all their buses)
    const adminOwnerPayRulesMatch = path.match(/^\/api\/admin\/owners\/([^/]+)\/payment-rules$/);
    if (adminOwnerPayRulesMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const ownerPhone = decodeURIComponent(adminOwnerPayRulesMatch[1]);
        const body = await readJson(request);
        const requireScreenshot = body.requirePaymentScreenshot !== undefined ? (body.requirePaymentScreenshot ? 1 : 0) : 1;
        const enableUtr = body.enableUtr !== undefined ? (body.enableUtr ? 1 : 0) : 0;
        const updateRes = await env.DB.prepare(
            'UPDATE buses SET require_payment_screenshot = ?, enable_utr = ? WHERE owner_phone = ?'
        ).bind(requireScreenshot, enableUtr, ownerPhone).run();
        return jsonResponse({ ok: true, ownerPhone, updatedBuses: updateRes.changes || 0, requirePaymentScreenshot: Boolean(requireScreenshot), enableUtr: Boolean(enableUtr) });
    }

    // POST or PUT /api/admin/buses or /api/admin/buses/:id
    const adminBusMatch = path.match(/^\/api\/admin\/buses(?:\/([^/]+))?$/);
    if (adminBusMatch) {
        const targetBusId = adminBusMatch[1] ? decodeURIComponent(adminBusMatch[1]) : null;
        const body = await readJson(request);
        if (!body || !body.name || !body.busNumber || !body.ownerName) {
            return jsonError(400, 'Bus name, number, and owner details required.');
        }
        const id = targetBusId || body.id || ('bus_' + Date.now());
        const imagePayload = (Array.isArray(body.images) && body.images.length > 0)
            ? JSON.stringify(body.images)
            : (body.image || '');
        const busRating = Math.min(5.0, Math.max(1.0, parseFloat(body.rating !== undefined && body.rating !== null ? body.rating : 4.8) || 4.8));
        const bookingMode = body.bookingMode || 'active';
        const stoppageTimings = (body.stoppageTimings || body.stoppage_timings) && typeof (body.stoppageTimings || body.stoppage_timings) === 'object'
            ? JSON.stringify(body.stoppageTimings || body.stoppage_timings)
            : '{}';
        await ensureEnterpriseSegmentTables(env.DB);
        const existingBus = await env.DB.prepare('SELECT seat_layout, approval_status, return_route_enabled, return_time, return_route, return_stoppages, return_stoppage_timings, return_fare, require_payment_screenshot, enable_utr, stoppage_fares, return_stoppage_fares FROM buses WHERE id = ?').bind(id).first();
        const seatLayoutPayload = (body.seatLayout || body.seat_layout)
            ? (typeof (body.seatLayout || body.seat_layout) === 'object' ? JSON.stringify(body.seatLayout || body.seat_layout) : String(body.seatLayout || body.seat_layout))
            : (existingBus?.seat_layout || null);
        const approvalStatus = body.approvalStatus || existingBus?.approval_status || 'approved';
        const rejectionReason = body.rejectionReason || '';
        const returnRouteEnabled = body.returnRouteEnabled !== undefined ? (body.returnRouteEnabled ? 1 : 0) : (existingBus?.return_route_enabled || 0);
        const returnTime = body.returnTime !== undefined ? String(body.returnTime).trim() : (existingBus?.return_time || '');
        const returnRoute = body.returnRoute !== undefined ? String(body.returnRoute).trim() : (existingBus?.return_route || '');
        const returnStoppagesPayload = body.returnStoppages !== undefined ? (Array.isArray(body.returnStoppages) ? JSON.stringify(body.returnStoppages) : String(body.returnStoppages)) : (existingBus?.return_stoppages || '[]');
        const returnStoppageTimings = (body.returnStoppageTimings || body.return_stoppage_timings) !== undefined
            ? JSON.stringify(body.returnStoppageTimings || body.return_stoppage_timings || {})
            : (existingBus?.return_stoppage_timings || '{}');
        const returnFare = body.returnFare !== undefined ? Number(body.returnFare) : (existingBus?.return_fare || body.fare || 399);
        const stoppageFares = (body.stoppageFares !== undefined || body.stoppage_fares !== undefined)
            ? sanitizeStoppageFaresInput(body.stoppageFares || body.stoppage_fares)
            : (existingBus?.stoppage_fares || '{}');
        const returnStoppageFares = (body.returnStoppageFares !== undefined || body.return_stoppage_fares !== undefined)
            ? sanitizeStoppageFaresInput(body.returnStoppageFares || body.return_stoppage_fares)
            : (existingBus?.return_stoppage_fares || '{}');

        const requireScreenshot = body.requirePaymentScreenshot !== undefined ? (body.requirePaymentScreenshot ? 1 : 0) : (existingBus?.require_payment_screenshot !== undefined ? existingBus.require_payment_screenshot : 1);
        const enableUtr = body.enableUtr !== undefined ? (body.enableUtr ? 1 : 0) : (existingBus?.enable_utr !== undefined ? existingBus.enable_utr : 0);

        await env.DB.prepare(
            `INSERT INTO buses (
                id, name, bus_number, owner_name, owner_phone, owner_email, route, active_routes,
                stoppages, stoppage_timings, fare_per_stop, fare_per_km, window_seat_extra, time, fare, total_seats, image, upi_id,
                qr_image, allow_online_payment, allow_cash_payment, driver_phone, company_name,
                gst_number, ticket_terms, emergency_phone, rating, booking_mode, seat_layout,
                approval_status, rejection_reason, return_route_enabled, return_time, return_route, return_stoppages, return_stoppage_timings, return_fare,
                require_payment_screenshot, enable_utr, stoppage_fares, return_stoppage_fares,
                pending_images, photo_approval_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'approved')
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name,
                bus_number = excluded.bus_number,
                owner_name = excluded.owner_name,
                owner_phone = excluded.owner_phone,
                owner_email = excluded.owner_email,
                route = excluded.route,
                active_routes = excluded.active_routes,
                stoppages = excluded.stoppages,
                stoppage_timings = excluded.stoppage_timings,
                fare_per_stop = excluded.fare_per_stop,
                fare_per_km = excluded.fare_per_km,
                window_seat_extra = excluded.window_seat_extra,
                time = excluded.time,
                fare = excluded.fare,
                total_seats = excluded.total_seats,
                image = excluded.image,
                upi_id = excluded.upi_id,
                qr_image = excluded.qr_image,
                allow_online_payment = excluded.allow_online_payment,
                allow_cash_payment = excluded.allow_cash_payment,
                driver_phone = excluded.driver_phone,
                company_name = excluded.company_name,
                gst_number = excluded.gst_number,
                ticket_terms = excluded.ticket_terms,
                emergency_phone = excluded.emergency_phone,
                rating = excluded.rating,
                booking_mode = excluded.booking_mode,
                seat_layout = excluded.seat_layout,
                approval_status = excluded.approval_status,
                rejection_reason = excluded.rejection_reason,
                return_route_enabled = excluded.return_route_enabled,
                return_time = excluded.return_time,
                return_route = excluded.return_route,
                return_stoppages = excluded.return_stoppages,
                return_stoppage_timings = excluded.return_stoppage_timings,
                return_fare = excluded.return_fare,
                require_payment_screenshot = excluded.require_payment_screenshot,
                enable_utr = excluded.enable_utr,
                stoppage_fares = excluded.stoppage_fares,
                return_stoppage_fares = excluded.return_stoppage_fares`
        ).bind(
            id, body.name, body.busNumber, body.ownerName, body.ownerPhone || '', body.ownerEmail || '',
            body.route || 'Pingla to Kolkata', JSON.stringify(body.activeRoutes || [body.route]),
            JSON.stringify(body.stoppages || ['Pingla', 'Kolkata']), stoppageTimings, body.farePerStop || 45,
            body.farePerKm || 3.5, body.windowSeatExtra !== undefined ? Number(body.windowSeatExtra) || 0 : 30, body.time || '08:00 AM', body.fare || 399, body.totalSeats || 65,
            imagePayload, body.upiId || 'busyatra@oksbi', body.qrImage || '',
            body.allowOnlinePayment !== false ? 1 : 0, body.allowCashPayment !== false ? 1 : 0,
            body.driverPhone || body.ownerPhone || '', body.companyName || `${body.ownerName} Travels`,
            body.gstNumber || '', body.ticketTerms || '', body.emergencyPhone || body.ownerPhone || '',
            busRating, bookingMode, seatLayoutPayload,
            approvalStatus, rejectionReason, returnRouteEnabled, returnTime, returnRoute, returnStoppagesPayload, returnStoppageTimings, returnFare,
            requireScreenshot, enableUtr, stoppageFares, returnStoppageFares
        ).run();
        return jsonResponse({ ok: true, id }, 201);
    }

    // POST /api/coupons or /api/admin/coupons
    if (path === '/api/coupons' || path === '/api/admin/coupons') {
        if (auth?.role !== 'admin') return jsonError(403, 'Administrator access required.');
        const body = await readJson(request);
        if (!body || !body.code || body.discount === undefined) return jsonError(400, 'code and discount required.');
        const cleanCode = String(body.code).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const discountVal = Number(body.discount);
        if (!cleanCode || cleanCode.length > 32 || !Number.isFinite(discountVal) || discountVal <= 0 || discountVal > 10000) {
            return jsonError(400, 'Valid coupon code and discount (₹1 - ₹10,000) required.');
        }
        const minFareVal = (body.minFare !== undefined && Number.isFinite(Number(body.minFare))) ? Math.max(0, Number(body.minFare)) : 0;
        const maxUsesVal = (body.maxUses !== undefined && body.maxUses !== null && body.maxUses !== '' && Number.isInteger(Number(body.maxUses)) && Number(body.maxUses) > 0)
            ? Number(body.maxUses)
            : null;
        const expiresAtVal = (typeof body.expiresAt === 'string' && body.expiresAt.trim()) ? body.expiresAt.trim() : null;
        await env.DB.prepare(
            `INSERT INTO coupons (code, discount, active, min_fare, max_uses, used_count, expires_at)
             VALUES (?, ?, ?, ?, ?, 0, ?)
             ON CONFLICT (code) DO UPDATE SET
                discount = excluded.discount,
                active = excluded.active,
                min_fare = excluded.min_fare,
                max_uses = excluded.max_uses,
                expires_at = excluded.expires_at`
        ).bind(cleanCode, discountVal, body.active !== false ? 1 : 0, minFareVal, maxUsesVal, expiresAtVal).run();
        return jsonResponse({ ok: true }, 201);
    }

    // POST /api/admin/promotions
    if (path === '/api/admin/promotions') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensurePromotionExtensionColumns(env.DB);
        const body = await readJson(request);
        if (!body || !body.image_url) {
            return jsonError(400, 'বিজ্ঞাপনের ছবি বা ভিডিও আবশ্যক (Ad image or video is required).');
        }
        const mediaCheck = sanitizePromoMediaInput(body.image_url, body.media_type);
        if (!mediaCheck.ok) {
            return jsonError(400, mediaCheck.error);
        }
        const linkCheck = sanitizePromoLinkInput(body.link_url);
        if (!linkCheck.ok) {
            return jsonError(400, linkCheck.error);
        }
        const title = String(body.title || 'Promotional Offer').trim();
        const imageUrl = mediaCheck.value;
        const mediaType = mediaCheck.mediaType;
        const target = ['customer', 'owner', 'all'].includes(body.target) ? body.target : 'customer';
        const placement = ['search_banner', 'popup', 'both'].includes(body.placement) ? body.placement : 'search_banner';
        const linkUrl = linkCheck.value;
        const active = (body.active !== false && body.active !== 0 && body.active !== '0') ? 1 : 0;
        const id = String(body.id || ('promo_' + Date.now() + '_' + secureRandomHex(3))).trim();
        const now = new Date().toISOString();

        await env.DB.prepare(
            `INSERT INTO promotions (id, title, image_url, target, link_url, media_type, placement, active, views_count, clicks_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
             ON CONFLICT (id) DO UPDATE SET
                title = excluded.title,
                image_url = excluded.image_url,
                target = excluded.target,
                link_url = excluded.link_url,
                media_type = excluded.media_type,
                placement = excluded.placement,
                active = excluded.active,
                updated_at = excluded.updated_at`
        ).bind(id, title, imageUrl, target, linkUrl, mediaType, placement, active, now, now).run();

        return jsonResponse({ ok: true, id, media_type: mediaType, placement, message: 'বিজ্ঞাপন সফলভাবে সেভ করা হয়েছে!' });
    }

    // POST /api/admin/promotions/:id/toggle
    const promoToggleMatch = path.match(/^\/api\/admin\/promotions\/([^/]+)\/toggle$/);
    if (promoToggleMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const id = decodeURIComponent(promoToggleMatch[1]);
        const promo = await env.DB.prepare('SELECT active FROM promotions WHERE id = ?').bind(id).first();
        if (!promo) return jsonError(404, 'Promotion not found.');
        const newStatus = promo.active ? 0 : 1;
        await env.DB.prepare('UPDATE promotions SET active = ?, updated_at = ? WHERE id = ?')
            .bind(newStatus, new Date().toISOString(), id).run();
        return jsonResponse({
            ok: true,
            active: newStatus,
            message: newStatus ? 'বিজ্ঞাপন চালু করা হয়েছে (Ad is Active)' : 'বিজ্ঞাপন সাময়িক বন্ধ (Paused) করা হয়েছে'
        });
    }

    // POST /api/reviews or /api/feedback
    if (path === '/api/reviews' || path === '/api/feedback') {
        const flags = await getFeatureFlags(env.DB);
        if (flags && flags.customerFeedback === false) {
            return jsonError(403, 'Customer feedback is currently disabled.');
        }
        const body = await readJson(request);
        if (!body) return jsonError(400, 'Feedback payload required.');
        const passengerName = String(body.passengerName || body.name || '').trim().slice(0, 80);
        const passengerPhone = String(body.passengerPhone || body.phone || '').trim();
        const busId = String(body.busId || '').trim().slice(0, 100);
        const busName = String(body.busName || '').trim().slice(0, 120);
        const rating = Math.min(5, Math.max(1, parseInt(body.rating, 10) || 5));
        const comment = String(body.comment || body.note || '').trim().slice(0, 1000);
        const bookingId = String(body.bookingId || ('FB_' + Date.now())).trim().slice(0, 100);

        if (!passengerName || passengerName.length < 2) {
            return jsonError(400, 'অনুগ্রহ করে আপনার নাম লিখুন (Please enter your name).');
        }
        if (!/^[6-9]\d{9}$/.test(passengerPhone)) {
            return jsonError(400, 'সঠিক ১০ ডিজিটের ভারতীয় মোবাইল নম্বর দিন (Enter a valid 10-digit mobile number).');
        }
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const recentRev = await env.DB.prepare(
            'SELECT COUNT(*) AS cnt FROM reviews WHERE passenger_phone = ? AND created_at > ?'
        ).bind(passengerPhone, tenMinsAgo).first();
        if (recentRev && Number(recentRev.cnt) >= 3) {
            return jsonError(429, 'অল্প সময়ে একাধিক রিভিউ জমা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।');
        }

        const reviewId = 'rev_' + Date.now() + '_' + secureRandomHex(3);
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO reviews (
                id, booking_id, rating, comment, passenger_name, passenger_phone, bus_id, bus_name, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            reviewId, bookingId, rating, comment, passengerName, passengerPhone,
            busId || null, busName || null, now
        ).run();
        return jsonResponse({
            ok: true,
            id: reviewId,
            message: 'ধন্যবাদ! আপনার মূল্যবান মতামত সফলভাবে জমা হয়েছে। (Thank you! Your feedback has been received.)'
        }, 201);
    }

    // POST /api/admin/notifications
    if (path === '/api/admin/notifications') {
        const body = await readJson(request);
        const title = String(body?.title || '').trim();
        const message = String(body?.message || '').trim();
        const targetGroup = String(body?.targetGroup || 'all').trim(); // 'all', 'customers', 'owners'
        const type = String(body?.type || 'info').trim(); // 'info', 'alert', 'announcement', 'offer'
        if (!title || !message) return jsonError(400, 'Title and message are required.');
        const notifId = 'notif_' + Date.now() + '_' + secureRandomHex(3);
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO notifications (id, sender_role, sender_identifier, target_group, bus_id, owner_phone, title, message, type, status, created_at, updated_at)
             VALUES (?, 'admin', ?, ?, NULL, NULL, ?, ?, ?, 'active', ?, ?)`
        ).bind(notifId, auth?.identifier || 'admin', targetGroup, title, message, type, now, now).run();
        return jsonResponse({ ok: true, id: notifId });
    }

    // POST /api/admin/notifications/toggle
    if (path === '/api/admin/notifications/toggle') {
        const body = await readJson(request);
        const id = String(body?.id || '').trim();
        const status = body?.status === 'paused' ? 'paused' : 'active';
        await env.DB.prepare(
            "UPDATE notifications SET status = ?, updated_at = ? WHERE id = ? AND sender_role = 'admin'"
        ).bind(status, new Date().toISOString(), id).run();
        return jsonResponse({ ok: true, status });
    }

    // POST /api/admin/notifications/delete
    if (path === '/api/admin/notifications/delete') {
        const body = await readJson(request);
        const id = String(body?.id || '').trim();
        await env.DB.prepare(
            "DELETE FROM notifications WHERE id = ? AND sender_role = 'admin'"
        ).bind(id).run();
        return jsonResponse({ ok: true });
    }

    // POST /api/owner/notifications
    if (path === '/api/owner/notifications') {
        const body = await readJson(request);
        const title = String(body?.title || '').trim();
        const message = String(body?.message || '').trim();
        const targetGroup = String(body?.targetGroup || 'captains').trim(); // 'captains', 'booked_customers', 'both'
        const busId = String(body?.busId || '').trim() || null;
        const type = String(body?.type || 'info').trim();
        if (!title || !message) return jsonError(400, 'Title and message are required.');
        const notifId = 'notif_' + Date.now() + '_' + secureRandomHex(3);
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO notifications (id, sender_role, sender_identifier, target_group, bus_id, owner_phone, title, message, type, status, created_at, updated_at)
             VALUES (?, 'owner', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
        ).bind(notifId, auth.identifier, targetGroup, busId, auth.identifier, title, message, type, now, now).run();
        return jsonResponse({ ok: true, id: notifId });
    }

    // POST /api/owner/notifications/toggle
    if (path === '/api/owner/notifications/toggle') {
        const body = await readJson(request);
        const id = String(body?.id || '').trim();
        const status = body?.status === 'paused' ? 'paused' : 'active';
        await env.DB.prepare(
            "UPDATE notifications SET status = ?, updated_at = ? WHERE id = ? AND sender_role = 'owner' AND owner_phone = ?"
        ).bind(status, new Date().toISOString(), id, auth.identifier).run();
        return jsonResponse({ ok: true, status });
    }

    // POST /api/owner/notifications/delete
    if (path === '/api/owner/notifications/delete') {
        const body = await readJson(request);
        const id = String(body?.id || '').trim();
        await env.DB.prepare(
            "DELETE FROM notifications WHERE id = ? AND sender_role = 'owner' AND owner_phone = ?"
        ).bind(id, auth.identifier).run();
        return jsonResponse({ ok: true });
    }

    // POST /api/owner/expenses
    if (path === '/api/owner/expenses') {
        if (auth?.role !== 'owner') return jsonError(403, 'Unauthorized.');
        const ownerPhone = auth.identifier;
        const body = await readJson(request);
        if (!body) return jsonError(400, 'Invalid JSON.');
        const rawBusId = String(body.busId || '').trim();
        const busId = rawBusId.replace('_RETURN', '');
        const journeyDate = String(body.journeyDate || '').trim();
        const category = String(body.category || 'misc').trim().slice(0, 50);
        const amount = Number(body.amount);
        const note = String(body.note || '').trim().slice(0, 500);

        if (!busId || !journeyDate || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
            return jsonError(400, 'Bus ID, Journey Date, and a valid amount are required.');
        }
        const ownedBus = await env.DB.prepare('SELECT id FROM buses WHERE id = ? AND owner_phone = ?')
            .bind(busId, ownerPhone).first();
        if (!ownedBus) {
            return jsonError(403, 'You can only add expenses for your own buses.');
        }

        const id = `exp_${Date.now()}_${secureRandomHex(3)}`;
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO trip_expenses (id, owner_phone, bus_id, journey_date, category, amount, note, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, ownerPhone, busId, journeyDate, category, amount, note, now, now).run();

        return jsonResponse({
            success: true,
            expense: {
                id,
                owner_phone: ownerPhone,
                bus_id: busId,
                journey_date: journeyDate,
                category,
                amount,
                note,
                created_at: now,
                updated_at: now
            }
        });
    }

    // POST /api/admin/bookings/bulk-delete
    if (path === '/api/admin/bookings/bulk-delete') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const body = await readJson(request) || {};
        let ids = Array.isArray(body.bookingIds) ? body.bookingIds : [];
        if (!ids.length && body.date) {
            const rows = await env.DB.prepare('SELECT id FROM bookings WHERE journey_date = ?').bind(body.date).all();
            ids = (rows.results || []).map(r => r.id);
        }
        if (!ids.length) return jsonError(400, 'No bookings specified to delete.');
        const deletedCount = await deleteBookingsHelper(env.DB, ids);
        await recordAdminAudit(env.DB, auth, 'BULK_DELETE_BOOKINGS', 'bulk', { count: deletedCount, ids });
        return jsonResponse({ ok: true, deleted: deletedCount, message: `${deletedCount} booking(s) deleted successfully.` });
    }

    // POST /api/owner/bookings/bulk-delete (Soft-hide in Owner view; preserves Admin ledger & blocks upcoming active bookings)
    if (path === '/api/owner/bookings/bulk-delete') {
        if (auth?.role !== 'owner') return jsonError(403, 'Unauthorized.');
        const body = await readJson(request) || {};
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        let ids = Array.isArray(body.bookingIds) ? body.bookingIds.filter(Boolean) : [];
        let rows = [];
        if (!ids.length && body.date) {
            const res = await env.DB.prepare(
                `SELECT b.id, b.status, b.journey_date FROM bookings b
                 JOIN buses bus ON (b.bus_id = bus.id OR b.bus_id = (bus.id || '_RETURN'))
                 WHERE bus.owner_phone = ? AND b.journey_date = ? AND COALESCE(b.hidden_for_owner, 0) = 0`
            ).bind(auth.identifier, body.date).all();
            rows = res.results || [];
        } else if (ids.length) {
            const placeholders = ids.map(() => '?').join(',');
            const res = await env.DB.prepare(
                `SELECT b.id, b.status, b.journey_date FROM bookings b
                 JOIN buses bus ON (b.bus_id = bus.id OR b.bus_id = (bus.id || '_RETURN'))
                 WHERE bus.owner_phone = ? AND b.id IN (${placeholders})`
            ).bind(auth.identifier, ...ids).all();
            rows = res.results || [];
        }
        const safeIds = rows
            .filter(r => !['Approved', 'Pending Approval', 'Cancellation Requested'].includes(r.status) || r.journey_date < todayIST)
            .map(r => r.id);
        if (!safeIds.length) {
            return jsonError(409, rows.length
                ? 'সক্রিয় বা আসন্ন বুকিং ডিলিট করা যাবে না। অনুগ্রহ করে প্রথমে বুকিংগুলো Cancel বা Reject করুন।'
                : 'No matching bookings found to delete.');
        }
        const placeholders = safeIds.map(() => '?').join(',');
        const upd = await env.DB.prepare(`UPDATE bookings SET hidden_for_owner = 1 WHERE id IN (${placeholders})`).bind(...safeIds).run();
        const deletedCount = upd.meta?.changes || safeIds.length;
        return jsonResponse({ ok: true, deleted: deletedCount, message: `${deletedCount} booking(s) deleted.` });
    }

    // POST /api/captain/bookings/bulk-delete (Soft-hide for Captain UI; strict bus ownership & _RETURN match)
    if (path === '/api/captain/bookings/bulk-delete') {
        if (auth?.role !== 'captain') return jsonError(403, 'Unauthorized.');
        const body = await readJson(request) || {};
        let targetBusId = auth.busId ? String(auth.busId).replace('_RETURN', '') : '';
        if (!targetBusId && auth.identifier) {
            const captainRow = await env.DB.prepare("SELECT bus_id FROM captains WHERE phone = ?").bind(auth.identifier).first();
            if (captainRow && captainRow.bus_id) targetBusId = String(captainRow.bus_id).replace('_RETURN', '');
            if (!targetBusId) {
                const bRow = await env.DB.prepare("SELECT id FROM buses WHERE driver_phone = ?").bind(auth.identifier).first();
                if (bRow && bRow.id) targetBusId = bRow.id;
            }
        }
        if (!targetBusId) return jsonError(403, 'No bus assigned to this captain account.');
        const returnBusId = targetBusId + '_RETURN';
        let ids = Array.isArray(body.bookingIds) ? body.bookingIds.filter(Boolean) : [];
        if (!ids.length && body.date) {
            const rows = await env.DB.prepare(
                `SELECT id FROM bookings WHERE (bus_id = ? OR bus_id = ?) AND journey_date = ? AND COALESCE(hidden_for_captain, 0) = 0`
            ).bind(targetBusId, returnBusId, body.date).all();
            ids = (rows.results || []).map(r => r.id);
        } else if (ids.length) {
            const placeholders = ids.map(() => '?').join(',');
            const rows = await env.DB.prepare(
                `SELECT id FROM bookings WHERE (bus_id = ? OR bus_id = ?) AND id IN (${placeholders})`
            ).bind(targetBusId, returnBusId, ...ids).all();
            ids = (rows.results || []).map(r => r.id);
        }
        if (!ids.length) return jsonError(400, 'No matching bookings found for your bus.');
        const placeholders = ids.map(() => '?').join(',');
        const upd = await env.DB.prepare(`UPDATE bookings SET hidden_for_captain = 1 WHERE id IN (${placeholders})`).bind(...ids).run();
        const deletedCount = upd.meta?.changes || ids.length;
        return jsonResponse({ ok: true, deleted: deletedCount, message: `${deletedCount} booking(s) deleted.` });
    }

    // POST /api/customer/bookings/bulk-delete (Soft-hide from customer history; preserves financials & active seats)
    if (path === '/api/customer/bookings/bulk-delete') {
        if (auth?.role !== 'customer') return jsonError(403, 'Unauthorized.');
        const body = await readJson(request) || {};
        let ids = Array.isArray(body.bookingIds) ? body.bookingIds.filter(Boolean) : [];
        if (ids.length) {
            const placeholders = ids.map(() => '?').join(',');
            const rows = await env.DB.prepare(
                `SELECT id FROM bookings WHERE passenger_phone = ? AND id IN (${placeholders})`
            ).bind(auth.identifier, ...ids).all();
            ids = (rows.results || []).map(r => r.id);
        } else if (body.clearAll) {
            const rows = await env.DB.prepare(
                `SELECT id FROM bookings WHERE passenger_phone = ?`
            ).bind(auth.identifier).all();
            ids = (rows.results || []).map(r => r.id);
        }
        if (!ids.length) return jsonError(400, 'No bookings found to delete.');
        const placeholders = ids.map(() => '?').join(',');
        const upd = await env.DB.prepare(`UPDATE bookings SET hidden_for_customer = 1 WHERE passenger_phone = ? AND id IN (${placeholders})`).bind(auth.identifier, ...ids).run();
        const deletedCount = upd.meta?.changes || ids.length;
        return jsonResponse({ ok: true, deleted: deletedCount, message: `${deletedCount} booking(s) deleted from history.` });
    }

    // POST /api/admin/subscriptions - Create / issue subscription charge
    if (path === '/api/admin/subscriptions') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const body = await readJson(request);
        const ownerPhone = String(body?.owner_phone || '').trim();
        const dueAmount = Number(body?.due_amount || 0);
        const dueDate = String(body?.due_date || '').trim();
        const planType = String(body?.plan_type || 'monthly').trim();
        const note = String(body?.note || '').trim();
        const paymentUpi = String(body?.payment_upi || 'support.busyatra@gmail.com').trim();
        const ownerName = String(body?.owner_name || '').trim();

        if (!ownerPhone || !/^[6-9]\d{9}$/.test(ownerPhone)) {
            return jsonError(400, 'সঠিক ১০-সংখ্যার বাস মালিক মোবাইল নম্বর আবশ্যক।');
        }
        if (dueAmount <= 0) {
            return jsonError(400, 'সঠিক বকেয়া টাকার পরিমাণ (Due Amount) দিন।');
        }
        if (!dueDate) {
            return jsonError(400, 'ডিউ শেষ হওয়ার তারিখ ও সময় (Due Date) আবশ্যক।');
        }

        const subId = 'sub_' + Date.now() + '_' + secureRandomHex(3);
        await env.DB.prepare(`
            INSERT INTO owner_subscriptions (id, owner_phone, owner_name, plan_type, due_amount, due_date, note, payment_upi, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(subId, ownerPhone, ownerName, planType, dueAmount, dueDate, note, paymentUpi).run();

        // Push notification targeted to owners
        try {
            const notifId = 'notif_' + Date.now();
            await env.DB.prepare(`
                INSERT INTO notifications (id, sender_role, target_group, title, message, status, created_at)
                VALUES (?, 'admin', 'owners', ?, ?, 'active', CURRENT_TIMESTAMP)
            `).bind(
                notifId,
                `💳 প্ল্যাটফর্ম সাবস্ক্রিপশন চার্জ: ₹${dueAmount}`,
                `মালিক: ${ownerName || ownerPhone}। ${note ? note + '। ' : ''}পরিশোধের শেষ সময়: ${dueDate}। UPI: ${paymentUpi}`
            ).run();
        } catch (ne) {
            console.warn('Subscription notification notice:', ne);
        }

        return jsonResponse({ ok: true, subId, message: 'বাস মালিকের কাছে সাবস্ক্রিপশন বিল সফলভাবে পাঠানো হয়েছে।' });
    }

    // POST /api/admin/subscriptions/clear - Clear due
    if (path === '/api/admin/subscriptions/clear') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const body = await readJson(request);
        const subId = body?.id;
        const ownerPhone = body?.owner_phone;
        const clearSuspension = body?.clear_suspension !== false;

        if (subId) {
            await env.DB.prepare(`
                UPDATE owner_subscriptions 
                SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).bind(subId).run();
        } else if (ownerPhone) {
            await env.DB.prepare(`
                UPDATE owner_subscriptions 
                SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                WHERE owner_phone = ? AND status = 'pending'
            `).bind(ownerPhone).run();
        } else {
            return jsonError(400, 'Subscription ID or Owner Phone required.');
        }

        // If clearSuspension is true, unblock owner and their captains from access_control_list
        if (clearSuspension && ownerPhone) {
            await env.DB.prepare(`
                DELETE FROM access_control_list WHERE phone = ? OR linked_owner_phone = ?
            `).bind(ownerPhone, ownerPhone).run();
        }

        return jsonResponse({ ok: true, message: 'বকেয়া সফলভাবে ক্লিয়ার করা হয়েছে এবং ওনার প্যানেল সচল হয়েছে।' });
    }

    // POST /api/admin/access/toggle - Suspend / Block / Unblock / Permanent Ban / Reactivate
    if (path === '/api/admin/access/toggle') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const body = await readJson(request);
        const phone = String(body?.phone || '').trim();
        const role = String(body?.role || 'owner').trim();
        const action = String(body?.action || '').trim(); // 'suspend', 'unblock', 'ban', 'reactivate'
        const reason = String(body?.reason || 'বকেয়া সাবস্ক্রিপশন ফি পরিশোধ না করায় স্থগিত।').trim();

        if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
            return jsonError(400, 'সঠিক ১০-সংখ্যার মোবাইল নম্বর দিন।');
        }

        // Find linked captains if owner
        let linkedCaptains = [];
        if (role === 'owner') {
            const capRes = await env.DB.prepare(`
                SELECT c.phone FROM captains c 
                JOIN buses b ON c.bus_id = b.id 
                WHERE b.owner_phone = ?
            `).bind(phone).all();
            linkedCaptains = (capRes.results || []).map(r => r.phone);
        }

        if (action === 'suspend' || action === 'block') {
            await env.DB.prepare(`
                INSERT INTO access_control_list (phone, role, status, reason, blocked_by, blocked_at, updated_at)
                VALUES (?, ?, 'suspended', ?, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(phone) DO UPDATE SET status = 'suspended', reason = excluded.reason, updated_at = CURRENT_TIMESTAMP
            `).bind(phone, role, reason).run();

            if (role === 'customer') {
                await env.DB.prepare("UPDATE customers SET status = 'suspended' WHERE phone = ?").bind(phone).run();
                await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'customer' AND identifier = ?").bind(phone).run();
            } else if (role === 'owner') {
                await env.DB.prepare("UPDATE owners SET status = 'suspended' WHERE phone = ?").bind(phone).run();
                await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'owner' AND identifier = ?").bind(phone).run();
                for (const capPhone of linkedCaptains) {
                    await env.DB.prepare(`
                        INSERT INTO access_control_list (phone, role, status, reason, linked_owner_phone, blocked_by, blocked_at, updated_at)
                        VALUES (?, 'captain', 'suspended', 'বাস মালিকের অ্যাকাউন্ট স্থগিত রয়েছে', ?, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT(phone) DO UPDATE SET status = 'suspended', linked_owner_phone = excluded.linked_owner_phone, updated_at = CURRENT_TIMESTAMP
                    `).bind(capPhone, phone).run();
                    await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?").bind(capPhone).run();
                }
            } else if (role === 'captain') {
                await env.DB.prepare("UPDATE captains SET active = 0 WHERE phone = ?").bind(phone).run();
                await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?").bind(phone).run();
            }

            return jsonResponse({ ok: true, message: `${role.toUpperCase()} মোবাইল নম্বর ${phone} সার্ভিস সাময়িকভাবে স্থগিত (Suspended) করা হয়েছে।` });
        } else if (action === 'unblock' || action === 'activate' || action === 'reactivate') {
            await env.DB.prepare(`
                DELETE FROM access_control_list WHERE phone = ? OR linked_owner_phone = ?
            `).bind(phone, phone).run();

            if (role === 'customer') {
                await env.DB.prepare("UPDATE customers SET status = 'active' WHERE phone = ?").bind(phone).run();
            } else if (role === 'owner') {
                await env.DB.prepare("UPDATE owners SET status = 'active' WHERE phone = ?").bind(phone).run();
            } else if (role === 'captain') {
                await env.DB.prepare("UPDATE captains SET active = 1 WHERE phone = ?").bind(phone).run();
            }

            return jsonResponse({ ok: true, message: `${role.toUpperCase()} মোবাইল নম্বর ${phone} সফলভাবে আনব্লক ও রি-অ্যাক্টিভেট করা হয়েছে।` });
        } else if (action === 'ban' || action === 'permanent_delete') {
            await env.DB.prepare(`
                INSERT INTO access_control_list (phone, role, status, reason, blocked_by, blocked_at, updated_at)
                VALUES (?, ?, 'permanently_banned', ?, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(phone) DO UPDATE SET status = 'permanently_banned', reason = excluded.reason, updated_at = CURRENT_TIMESTAMP
            `).bind(phone, role, reason || 'অ্যাডমিন কর্তৃক স্থায়ীভাবে নিষিদ্ধ').run();

            if (role === 'customer') {
                await env.DB.prepare("UPDATE customers SET status = 'banned' WHERE phone = ?").bind(phone).run();
                await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'customer' AND identifier = ?").bind(phone).run();
            } else if (role === 'owner') {
                await env.DB.prepare("UPDATE owners SET status = 'banned' WHERE phone = ?").bind(phone).run();
                await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'owner' AND identifier = ?").bind(phone).run();
                for (const capPhone of linkedCaptains) {
                    await env.DB.prepare(`
                        INSERT INTO access_control_list (phone, role, status, reason, linked_owner_phone, blocked_by, blocked_at, updated_at)
                        VALUES (?, 'captain', 'permanently_banned', 'মালিকের সাথে স্থায়ী নিষিদ্ধ', ?, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT(phone) DO UPDATE SET status = 'permanently_banned', linked_owner_phone = excluded.linked_owner_phone, updated_at = CURRENT_TIMESTAMP
                    `).bind(capPhone, phone).run();
                    await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?").bind(capPhone).run();
                }
            } else if (role === 'captain') {
                await env.DB.prepare("UPDATE captains SET active = 0 WHERE phone = ?").bind(phone).run();
                await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?").bind(phone).run();
            }

            return jsonResponse({ ok: true, message: `${role.toUpperCase()} মোবাইল নম্বর ${phone} স্থায়ীভাবে নিষিদ্ধ (Permanently Banned) করা হয়েছে।` });
        } else {
            return jsonError(400, 'Invalid action specified.');
        }
    }

        // Fallback POST deletion endpoints
    if (path === '/api/admin/devices/delete' || (path === '/api/admin/devices' && url.searchParams.get('_method') === 'DELETE')) {
        const devId = url.searchParams.get('id');
        const clearAll = url.searchParams.get('all') === 'true';
        if (clearAll) {
            await env.DB.prepare('DELETE FROM user_login_devices').run();
            await env.DB.prepare('DELETE FROM user_login_logs').run();
            return jsonResponse({ ok: true, message: 'সমস্ত ডিভাইস ও লগ হিস্টোরি মুছে ফেলা হয়েছে।' });
        }
        if (devId) {
            const dev = await env.DB.prepare('SELECT role, identifier FROM user_login_devices WHERE id = ?').bind(devId).first();
            await env.DB.prepare('DELETE FROM user_login_devices WHERE id = ?').bind(devId).run();
            if (dev) {
                await env.DB.prepare('DELETE FROM user_login_logs WHERE role = ? AND identifier = ?').bind(dev.role, dev.identifier).run();
            }
            return jsonResponse({ ok: true, message: 'ডিভাইস রেকর্ড মুছে ফেলা হয়েছে।' });
        }
        return jsonError(400, 'Device ID or all=true required.');
    }

    if (path === '/api/admin/devices/logs/delete' || (path === '/api/admin/devices/logs' && url.searchParams.get('_method') === 'DELETE')) {
        const logId = url.searchParams.get('id');
        const clearAll = url.searchParams.get('all') === 'true';
        if (clearAll) {
            await env.DB.prepare('DELETE FROM user_login_logs').run();
            return jsonResponse({ ok: true, message: 'সমস্ত লগ মুছে ফেলা হয়েছে।' });
        }
        if (logId) {
            await env.DB.prepare('DELETE FROM user_login_logs WHERE id = ?').bind(logId).run();
            return jsonResponse({ ok: true, message: 'লগ মুছে ফেলা হয়েছে।' });
        }
        return jsonError(400, 'Log ID required.');
    }

    if (path === '/api/admin/devices/analytics/delete' || (path === '/api/admin/devices/analytics' && url.searchParams.get('_method') === 'DELETE')) {
        return await deleteClientAnalyticsRecords(env.DB, url);
    }

    // POST /api/admin/broadcast-email (Brevo Broadcast Email with support.busyatra@gmail.com Fallback)
    if (path === '/api/admin/broadcast-email') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized. Super Admin only.');
        const body = await readJson(request);
        const target = (body?.target || 'both').toLowerCase();
        const customEmails = Array.isArray(body?.customEmails) ? body.customEmails : [];
        const subject = String(body?.subject || '').trim();
        const message = String(body?.message || '').trim();

        if (!subject) return jsonError(400, 'ইমেইল শিরোনাম (Subject) আবশ্যক।');
        if (!message) return jsonError(400, 'ইমেইলের বার্তা (Message Body) আবশ্যক।');

        let recipientList = [];

        if (target === 'customers' || target === 'both') {
            const { results: custs } = await env.DB.prepare(`
                SELECT DISTINCT email, name, phone FROM customers WHERE email IS NOT NULL AND email LIKE '%@%'
            `).all();
            (custs || []).forEach(c => {
                if (c.email && c.email.includes('@')) {
                    recipientList.push({ email: c.email.trim().toLowerCase(), name: c.name || 'Valued Passenger', role: 'Customer', phone: c.phone || '' });
                }
            });
        }

        if (target === 'owners' || target === 'both') {
            const { results: owns } = await env.DB.prepare(`
                SELECT DISTINCT email, owner_name AS name, owner_phone AS phone, company_name FROM owners WHERE email IS NOT NULL AND email LIKE '%@%'
            `).all();
            (owns || []).forEach(o => {
                if (o.email && o.email.includes('@')) {
                    recipientList.push({ email: o.email.trim().toLowerCase(), name: o.name || o.company_name || 'Bus Operator', role: 'Owner', phone: o.phone || '' });
                }
            });
        }

        if (target === 'custom' && customEmails.length > 0) {
            customEmails.forEach(em => {
                const clean = String(em || '').trim().toLowerCase();
                if (clean.includes('@')) {
                    recipientList.push({ email: clean, name: clean.split('@')[0], role: 'User', phone: '' });
                }
            });
        }

        const emailMap = new Map();
        recipientList.forEach(r => {
            if (!emailMap.has(r.email)) {
                emailMap.set(r.email, r);
            }
        });
        recipientList = Array.from(emailMap.values());

        if (recipientList.length === 0) {
            return jsonError(400, 'নির্বাচিত টার্গেটে কোনো বৈধ ইমেইল ঠিকানা পাওয়া যায়নি (No valid recipients found).');
        }

        const formattedBody = message.split('\n').filter(p => p.trim()).map(p => `<p style="margin: 0 0 14px 0; line-height: 1.6; color: #374151; font-size: 15px;">${escapeHtml(p)}</p>`).join('');

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); padding: 30px 25px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: 0.5px;">🚌 Bus Yatra</h1>
                            <p style="margin: 6px 0 0 0; color: #fecaca; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Official Announcement &amp; Notification</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 35px 30px;">
                            <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px; font-weight: 800; border-bottom: 2px solid #fee2e2; padding-bottom: 12px;">
                                ${escapeHtml(subject)}
                            </h2>
                            <div style="color: #374151;">
                                ${formattedBody}
                            </div>
                            <div style="margin-top: 30px; padding: 18px; background-color: #fef2f2; border-radius: 12px; border-left: 4px solid #ef4444;">
                                <p style="margin: 0; font-size: 13px; color: #991b1b; font-weight: 600;">
                                    প্রয়োজনে যেকোনো সময় যোগাযোগ করুন: <a href="mailto:support.busyatra@gmail.com" style="color: #b91c1c; text-decoration: underline;">support.busyatra@gmail.com</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 25px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 500;">
                                © ${new Date().getFullYear()} Bus Yatra Platform. All rights reserved.
                            </p>
                            <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 11px;">
                                Smart &amp; Transparent Bus Booking Network • West Bengal, India
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        // If client requested direct Gmail fallback / client dispatch
        if (body?.mode === 'gmail_mailto') {
            const bccList = recipientList.map(r => r.email).join(',');
            return jsonResponse({
                ok: true,
                mode: 'gmail_mailto',
                totalRecipients: recipientList.length,
                recipients: recipientList,
                bccList,
                subject,
                message
            });
        }

        // Send via Brevo API
        let sentCount = 0;
        let failedCount = 0;
        let dailyLimitReached = false;
        let lastError = '';
        const failedRecipients = [];

        for (const rec of recipientList) {
            try {
                await sendBrevoEmail(env, {
                    toEmail: rec.email,
                    toName: rec.name,
                    subject,
                    htmlContent
                });
                sentCount++;
            } catch (err) {
                failedCount++;
                lastError = err.message || '';
                failedRecipients.push(rec.email);
                if (/quota|daily\s*limit|reseller|credit|limit\s*exceeded|402|429/i.test(lastError)) {
                    dailyLimitReached = true;
                    break;
                }
            }
        }

        try {
            await recordAdminAudit(env.DB, auth, 'BROADCAST_EMAIL', target, {
                subject,
                totalRecipients: recipientList.length,
                sentCount,
                failedCount,
                dailyLimitReached
            });
        } catch (e) {}

        const bccList = recipientList.map(r => r.email).join(',');

        return jsonResponse({
            ok: !dailyLimitReached && failedCount === 0,
            partial: sentCount > 0 && (failedCount > 0 || dailyLimitReached),
            dailyLimitReached,
            totalRecipients: recipientList.length,
            sentCount,
            failedCount,
            failedRecipients,
            bccList,
            error: lastError,
            message: dailyLimitReached
                ? `⚠️ Brevo-র দৈনিক ফ্রি লিমিট (Daily Limit) শেষ হয়েছে (${sentCount}টি সফল)। বাকিদের পাঠাতে নিচের 'Open in Gmail (support.busyatra@gmail.com)' বাটন চাপুন।`
                : `✅ সফলভাবে ${sentCount} জন ব্যবহারকারীকে ইমেইল পাঠানো হয়েছে!`
        });
    }

    // POST /api/support/tickets (Customer create or append support message - token/session protected)
    if (path === '/api/support/tickets') {
        const body = await readJson(request);
        let { ticketNumber, ticketToken, customerPhone, customerName, subject, message, isVoice, attachmentUrl, category, aiResponse } = body || {};

        customerPhone = String(customerPhone || '').trim();
        customerName = String(customerName || 'Passenger').trim().slice(0, 80);
        subject = String(subject || 'General Inquiry').trim().slice(0, 120);
        message = String(message || '').trim().slice(0, 2000);
        category = String(category || 'general').trim().slice(0, 50);
        ticketToken = String(ticketToken || request.headers.get('x-ticket-token') || '').trim();

        if (!message && !attachmentUrl) {
            return jsonError(400, 'Message text or attachment is required.');
        }
        if (attachmentUrl && (typeof attachmentUrl !== 'string' || attachmentUrl.length > 750000)) {
            return jsonError(413, 'সংযুক্ত ছবির সাইজ অনেক বড়। অনুগ্রহ করে ছোট ছবি আপলোড করুন।');
        }

        const now = new Date().toISOString();
        let ticket = null;
        const isAdminSender = auth?.role === 'admin';
        const authCustPhone = auth?.role === 'customer' ? auth.identifier : '';

        // 1. Check if client provided a ticket number and it exists in database
        if (ticketNumber) {
            ticket = await env.DB.prepare('SELECT * FROM support_tickets WHERE ticket_number = ?').bind(ticketNumber).first();
            if (ticket) {
                const ownerMatch = Boolean(ticket.customer_phone && authCustPhone && authCustPhone === ticket.customer_phone);
                const tokenMatch = Boolean(ticket.ticket_secret && ticketToken && constantTimeEqual(ticketToken, ticket.ticket_secret));
                const legacyAnonymous = Boolean(!ticket.ticket_secret && !ticket.customer_phone);
                if (!isAdminSender && !ownerMatch && !tokenMatch && !legacyAnonymous) {
                    return jsonError(403, 'আপনি এই সাপোর্ট টিকিটে মেসেজ পাঠানোর অনুমতিপ্রাপ্ত নন।');
                }
            }
        }

        // 2. If not found by ticketNumber, only resume an active ticket for authenticated customer or matching phone session
        if (!ticket && authCustPhone) {
            ticket = await env.DB.prepare(
                "SELECT * FROM support_tickets WHERE customer_phone = ? AND status IN ('Open', 'In Progress') ORDER BY updated_at DESC LIMIT 1"
            ).bind(authCustPhone).first();
        }

        // 3. User rule: If the ticket is already Resolved by admin, customer's new inquiry must start a fresh new ticket
        if (ticket && ticket.status === 'Resolved') {
            ticket = null; // Forces creation of a brand new ticket token
        }

        const newMsg = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            sender: 'customer',
            text: message,
            isVoice: Boolean(isVoice),
            attachmentUrl: attachmentUrl || null,
            timestamp: now
        };

        if (ticket) {
            const msgs = parseJson(ticket.messages, []);
            msgs.push(newMsg);
            if (aiResponse) {
                msgs.push({
                    id: 'msg_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    sender: 'ai',
                    text: String(aiResponse).trim().slice(0, 2000),
                    timestamp: new Date().toISOString()
                });
            }

            const currentStatus = ticket.status || 'Open';

            await env.DB.prepare(`
                UPDATE support_tickets 
                SET messages = ?, last_message = ?, last_sender = 'customer', status = ?, updated_at = ?
                WHERE id = ?
            `).bind(JSON.stringify(msgs), message || (attachmentUrl ? '[Photo Attached]' : ''), currentStatus, now, ticket.id).run();

            const { ticket_secret: secretVal, ...safeTicket } = ticket;
            return jsonResponse({
                ok: true,
                ticketToken: secretVal || undefined,
                ticket: {
                    ...safeTicket,
                    status: currentStatus,
                    last_message: message || (attachmentUrl ? '[Photo Attached]' : ''),
                    last_sender: 'customer',
                    updated_at: now,
                    messages: msgs
                }
            });
        } else {
            // Rate limit: max 5 new tickets in 10 minutes per customerPhone
            if (customerPhone) {
                const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
                const recent = await env.DB.prepare(
                    'SELECT COUNT(*) AS cnt FROM support_tickets WHERE customer_phone = ? AND created_at > ?'
                ).bind(customerPhone, tenMinsAgo).first();
                if (recent && Number(recent.cnt) >= 5) {
                    return jsonError(429, 'অল্প সময়ে অনেকগুলো সাপোর্ট টিকিট তৈরি করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।');
                }
            }

            // Create new ticket token: preserve client's ticketNumber if available and unique
            let genTicketNumber = (ticketNumber && /^#BY-TKT-\d{4,6}$/.test(ticketNumber)) ? ticketNumber : null;
            if (genTicketNumber) {
                const existing = await env.DB.prepare('SELECT id FROM support_tickets WHERE ticket_number = ?').bind(genTicketNumber).first();
                if (existing) genTicketNumber = null;
            }
            if (!genTicketNumber) {
                const randomCode = Math.floor(10000 + Math.random() * 90000);
                genTicketNumber = '#BY-TKT-' + randomCode;
            }

            const ticketId = 'tkt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const ticketSecret = secureRandomHex(16);
            const msgs = [newMsg];
            if (aiResponse) {
                msgs.push({
                    id: 'msg_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    sender: 'ai',
                    text: String(aiResponse).trim().slice(0, 2000),
                    timestamp: new Date().toISOString()
                });
            }

            await env.DB.prepare(`
                INSERT INTO support_tickets (
                    id, ticket_number, customer_phone, customer_name, subject, category,
                    status, priority, messages, last_message, last_sender, ticket_secret, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'Open', 'Medium', ?, ?, 'customer', ?, ?, ?)
            `).bind(
                ticketId, genTicketNumber, (authCustPhone || customerPhone) || null, customerName, subject, category,
                JSON.stringify(msgs), message || (attachmentUrl ? '[Photo Attached]' : ''), ticketSecret, now, now
            ).run();

            return jsonResponse({
                ok: true,
                ticketToken: ticketSecret,
                ticket: {
                    id: ticketId,
                    ticket_number: genTicketNumber,
                    customer_phone: authCustPhone || customerPhone,
                    customer_name: customerName,
                    subject,
                    category,
                    status: 'Open',
                    messages: msgs,
                    created_at: now,
                    updated_at: now
                }
            });
        }
    }

    // POST /api/admin/support/tickets/:id/reply
    const adminReplyMatch = path.match(/^\/api\/admin\/support\/tickets\/([^/]+)\/reply$/);
    if (adminReplyMatch) {
        const ticketId = decodeURIComponent(adminReplyMatch[1]);
        const body = await readJson(request);
        const { text, attachmentUrl, status } = body || {};

        if (!text && !attachmentUrl) return jsonError(400, 'Reply text or attachment is required.');

        const ticket = await env.DB.prepare('SELECT * FROM support_tickets WHERE id = ? OR ticket_number = ?').bind(ticketId, ticketId).first();
        if (!ticket) return jsonError(404, 'Ticket not found.');

        const msgs = parseJson(ticket.messages, []);
        const now = new Date().toISOString();
        const replyMsg = {
            id: 'msg_adm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            sender: 'admin',
            text: String(text || '').trim(),
            attachmentUrl: attachmentUrl || null,
            timestamp: now
        };
        msgs.push(replyMsg);

        const newStatus = status || (ticket.status === 'Open' ? 'In Progress' : ticket.status);

        await env.DB.prepare(`
            UPDATE support_tickets
            SET messages = ?, last_message = ?, last_sender = 'admin', status = ?, updated_at = ?
            WHERE id = ?
        `).bind(JSON.stringify(msgs), text || '[Photo Attachment]', newStatus, now, ticket.id).run();

        return jsonResponse({
            ok: true,
            ticket: {
                ...ticket,
                status: newStatus,
                messages: msgs,
                last_message: text || '[Photo Attachment]',
                last_sender: 'admin',
                updated_at: now
            }
        });
    }

    // POST /api/admin/support/tickets/:id/status
    const adminStatusMatch = path.match(/^\/api\/admin\/support\/tickets\/([^/]+)\/status$/);
    if (adminStatusMatch) {
        const ticketId = decodeURIComponent(adminStatusMatch[1]);
        const body = await readJson(request);
        const { status, resolutionNotes } = body || {};

        if (!status) return jsonError(400, 'Status is required.');

        const ticket = await env.DB.prepare('SELECT * FROM support_tickets WHERE id = ? OR ticket_number = ?').bind(ticketId, ticketId).first();
        if (!ticket) return jsonError(404, 'Ticket not found.');

        const now = new Date().toISOString();
        const resolvedAt = status === 'Resolved' ? now : null;

        await env.DB.prepare(`
            UPDATE support_tickets
            SET status = ?, resolution_notes = COALESCE(?, resolution_notes), resolved_at = COALESCE(?, resolved_at), updated_at = ?
            WHERE id = ?
        `).bind(status, resolutionNotes || null, resolvedAt, now, ticket.id).run();

        return jsonResponse({
            ok: true,
            ticket: {
                ...ticket,
                status,
                resolution_notes: resolutionNotes || ticket.resolution_notes,
                resolved_at: resolvedAt || ticket.resolved_at,
                updated_at: now
            }
        });
    }

    // POST /api/emergency/sos (Passenger sends emergency SOS alert)
    if (path === '/api/emergency/sos') {
        await ensureSosTable(env.DB);
        const body = await readJson(request);
        if (!body || typeof body !== 'object') return jsonError(400, 'Invalid request payload.');

        const customerName = String(body.customer_name || 'Passenger').trim().slice(0, 100);
        const customerPhone = String(auth?.role === 'customer' ? auth.identifier : (body.customer_phone || '')).trim().replace(/[^\d+]/g, '').slice(0, 20);

        if (customerPhone) {
            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const recentSos = await env.DB.prepare(
                'SELECT COUNT(*) AS cnt FROM emergency_sos_alerts WHERE customer_phone = ? AND created_at > ?'
            ).bind(customerPhone, fiveMinsAgo).first();
            if (recentSos && Number(recentSos.cnt) >= 3) {
                return jsonError(429, 'আপনার জরুরি এসওএস সতর্কতা ইতিমধ্যেই পাঠানো হয়েছে। অনুগ্রহ করে শান্ত থাকুন। (SOS alert already received.)');
            }
        }
        const emergencyType = String(body.emergency_type || '🚑 চিকিৎসা জরুরি (Medical)').trim().slice(0, 100);
        const description = String(body.description || '').trim().slice(0, 1000);
        const locationText = String(body.current_location_text || '').trim().slice(0, 300);
        const busId = String(body.bus_id || '').trim().slice(0, 100);
        const busName = String(body.bus_name || '').trim().slice(0, 100);

        const lat = (body.latitude !== null && body.latitude !== undefined && !isNaN(body.latitude)) ? Number(body.latitude) : null;
        const lng = (body.longitude !== null && body.longitude !== undefined && !isNaN(body.longitude)) ? Number(body.longitude) : null;
        let mapsUrl = '';
        if (lat && lng) {
            mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        }

        const alertId = 'sos_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        const alertNumber = '#SOS-' + Math.floor(100000 + Math.random() * 900000);
        const now = new Date().toISOString();

        const cameraConsent = body.camera_consent === true ? 1 : 0;
        let cameraActive = 0;
        let cameraFrame = '';
        let cameraUpdatedAt = null;
        let cameraExpiresAt = null;
        let cameraSessionToken = '';
        if (cameraConsent === 1) {
            cameraActive = 1;
            cameraSessionToken = 'sosc_' + secureRandomHex(16);
            cameraExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            if (body.initial_frame) {
                const fc = sanitizeSosCameraFrame(body.initial_frame);
                if (fc.ok) {
                    cameraFrame = fc.value;
                    cameraUpdatedAt = now;
                }
            }
        }

        await env.DB.prepare(`
            INSERT INTO emergency_sos_alerts (
                id, alert_number, customer_phone, customer_name,
                emergency_type, description, latitude, longitude,
                maps_url, current_location_text, bus_id, bus_name,
                camera_consent, camera_active, camera_frame,
                camera_updated_at, camera_expires_at, camera_session_token,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
        `).bind(
            alertId, alertNumber, customerPhone, customerName,
            emergencyType, description, lat, lng,
            mapsUrl, locationText, busId, busName,
            cameraConsent, cameraActive, cameraFrame,
            cameraUpdatedAt, cameraExpiresAt, cameraSessionToken,
            now, now
        ).run();

        // Save any pre-snapped HD photos attached at SOS submit time
        if (cameraConsent === 1 && Array.isArray(body.initial_photos)) {
            const initPhotos = body.initial_photos.slice(0, 5);
            for (const rawP of initPhotos) {
                const pCheck = sanitizeSosCameraFrame(rawP, 850000);
                if (pCheck.ok) {
                    const pid = 'sosp_' + Date.now() + '_' + secureRandomHex(4);
                    await env.DB.prepare(
                        'INSERT INTO sos_captured_photos (id, sos_id, captured_by, photo_data, created_at) VALUES (?, ?, ?, ?, ?)'
                    ).bind(pid, alertId, 'customer', pCheck.value, now).run();
                }
            }
        }

        return jsonResponse({
            ok: true,
            alertId,
            alertNumber,
            mapsUrl,
            cameraConsent: Boolean(cameraConsent),
            cameraActive: Boolean(cameraActive),
            cameraSessionToken: cameraSessionToken || null,
            cameraExpiresAt,
            message: 'আপনার জরুরি এসওএস সিগন্যাল বাস কন্ট্রোল রুমে সফলভাবে পৌঁছেছে।'
        }, 201);
    }

    // POST /api/emergency/sos/:id/webrtc-offer (Customer pushes live 30fps WebRTC SDP Offer + ICE)
    const sosWebrtcOfferMatch = path.match(/^\/api\/emergency\/sos\/([^/]+)\/webrtc-offer$/);
    if (sosWebrtcOfferMatch) {
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(sosWebrtcOfferMatch[1]);
        const body = await readJson(request);
        const token = String(body?.token || request.headers.get('X-Sos-Camera-Token') || '').trim();
        if (!token) return jsonError(403, 'Camera session token required.');

        const sos = await env.DB.prepare(
            'SELECT id, status, camera_consent, camera_active, camera_expires_at, camera_session_token FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?'
        ).bind(alertId, alertId).first();
        if (!sos || !sos.camera_session_token || sos.camera_session_token !== token) {
            return jsonError(403, 'Invalid or expired SOS camera session token.');
        }

        const now = new Date().toISOString();
        const isExpired = Boolean(sos.camera_expires_at && sos.camera_expires_at <= now);
        if (sos.status !== 'Active' || !sos.camera_consent || !sos.camera_active || isExpired) {
            return jsonResponse({ ok: false, stopped: true });
        }

        const offerStr = String(body?.offer || '').trim();
        const iceStr = JSON.stringify(Array.isArray(body?.ice) ? body.ice.slice(0, 40) : []);
        const nonce = String(body?.nonce || ('n_' + Date.now())).trim().slice(0, 64);
        if (!offerStr || offerStr.length > 40000) return jsonError(400, 'Invalid WebRTC offer.');

        await env.DB.prepare(
            "UPDATE emergency_sos_alerts SET webrtc_offer = ?, webrtc_offer_ice = ?, webrtc_answer = '', webrtc_answer_ice = '[]', webrtc_session_nonce = ?, webrtc_renegotiate = 0, updated_at = ? WHERE id = ?"
        ).bind(offerStr, iceStr, nonce, now, sos.id).run();
        return jsonResponse({ ok: true, nonce });
    }

    // POST /api/admin/emergency/sos/:id/webrtc-answer (Admin responds with WebRTC SDP Answer + ICE)
    const adminWebrtcAnsMatch = path.match(/^\/api\/admin\/emergency\/sos\/([^/]+)\/webrtc-answer$/);
    if (adminWebrtcAnsMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(adminWebrtcAnsMatch[1]);
        const body = await readJson(request);
        const answerStr = String(body?.answer || '').trim();
        const iceStr = JSON.stringify(Array.isArray(body?.ice) ? body.ice.slice(0, 40) : []);
        const nonce = String(body?.nonce || '').trim().slice(0, 64);
        if (!answerStr || answerStr.length > 40000) return jsonError(400, 'Invalid WebRTC answer.');

        const now = new Date().toISOString();
        await env.DB.prepare(
            "UPDATE emergency_sos_alerts SET webrtc_answer = ?, webrtc_answer_ice = ?, webrtc_renegotiate = 0, updated_at = ? WHERE (id = ? OR alert_number = ?) AND (? = '' OR webrtc_session_nonce = ?)"
        ).bind(answerStr, iceStr, now, alertId, alertId, nonce, nonce).run();
        return jsonResponse({ ok: true });
    }

    // POST /api/admin/emergency/sos/:id/webrtc-reset (Admin triggers clean WebRTC renegotiation when opening viewer)
    const adminWebrtcResetMatch = path.match(/^\/api\/admin\/emergency\/sos\/([^/]+)\/webrtc-reset$/);
    if (adminWebrtcResetMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(adminWebrtcResetMatch[1]);
        const now = new Date().toISOString();
        await env.DB.prepare(
            "UPDATE emergency_sos_alerts SET webrtc_answer = '', webrtc_answer_ice = '[]', webrtc_renegotiate = 1, updated_at = ? WHERE id = ? OR alert_number = ?"
        ).bind(now, alertId, alertId).run();
        return jsonResponse({ ok: true });
    }

    // POST /api/emergency/sos/:id/photos (Customer snaps HD photo while live)
    const sosCustPhotoMatch = path.match(/^\/api\/emergency\/sos\/([^/]+)\/photos$/);
    if (sosCustPhotoMatch) {
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(sosCustPhotoMatch[1]);
        const body = await readJson(request);
        const token = String(body?.token || request.headers.get('X-Sos-Camera-Token') || '').trim();
        if (!token) return jsonError(403, 'Camera session token required.');

        const sos = await env.DB.prepare(
            'SELECT id, status, camera_consent, camera_session_token FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?'
        ).bind(alertId, alertId).first();
        if (!sos || !sos.camera_session_token || sos.camera_session_token !== token) {
            return jsonError(403, 'Invalid or expired SOS camera session token.');
        }
        const photoCheck = sanitizeSosCameraFrame(body?.photo, 850000);
        if (!photoCheck.ok) return jsonError(400, photoCheck.error);

        const cntRow = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM sos_captured_photos WHERE sos_id = ?').bind(sos.id).first();
        if (cntRow && Number(cntRow.cnt) >= 25) return jsonError(400, 'Maximum 25 photos reached for this SOS alert.');

        const pid = 'sosp_' + Date.now() + '_' + secureRandomHex(4);
        const now = new Date().toISOString();
        await env.DB.prepare(
            'INSERT INTO sos_captured_photos (id, sos_id, captured_by, photo_data, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(pid, sos.id, 'customer', photoCheck.value, now).run();
        return jsonResponse({ ok: true, id: pid, captured_by: 'customer', created_at: now });
    }

    // POST /api/admin/emergency/sos/:id/photos (Admin snaps HD photo from live SOS video)
    const adminSosPhotoPostMatch = path.match(/^\/api\/admin\/emergency\/sos\/([^/]+)\/photos$/);
    if (adminSosPhotoPostMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(adminSosPhotoPostMatch[1]);
        const body = await readJson(request);
        const sos = await env.DB.prepare('SELECT id FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?').bind(alertId, alertId).first();
        if (!sos) return jsonError(404, 'SOS Alert not found.');

        const photoCheck = sanitizeSosCameraFrame(body?.photo, 850000);
        if (!photoCheck.ok) return jsonError(400, photoCheck.error);

        const cntRow = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM sos_captured_photos WHERE sos_id = ?').bind(sos.id).first();
        if (cntRow && Number(cntRow.cnt) >= 25) return jsonError(400, 'Maximum 25 photos reached for this SOS alert.');

        const pid = 'sosp_' + Date.now() + '_' + secureRandomHex(4);
        const now = new Date().toISOString();
        await env.DB.prepare(
            'INSERT INTO sos_captured_photos (id, sos_id, captured_by, photo_data, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(pid, sos.id, 'admin', photoCheck.value, now).run();
        return jsonResponse({ ok: true, id: pid, captured_by: 'admin', created_at: now });
    }

    // POST /api/emergency/sos/:id/camera-frame (Opt-in customer live camera frame relay or stop)
    const sosCamFrameMatch = path.match(/^\/api\/emergency\/sos\/([^/]+)\/camera-frame$/);
    if (sosCamFrameMatch) {
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(sosCamFrameMatch[1]);
        const body = await readJson(request);
        const token = String(body?.token || request.headers.get('X-Sos-Camera-Token') || '').trim();
        if (!token) return jsonError(403, 'Camera session token required.');

        const sos = await env.DB.prepare(
            'SELECT id, status, camera_consent, camera_active, camera_expires_at, camera_session_token FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?'
        ).bind(alertId, alertId).first();
        if (!sos || !sos.camera_session_token || sos.camera_session_token !== token) {
            return jsonError(403, 'Invalid or expired SOS camera session token.');
        }

        const now = new Date().toISOString();
        if (body?.action === 'stop') {
            await env.DB.prepare(
                "UPDATE emergency_sos_alerts SET camera_active = 0, camera_frame = '', camera_session_token = '', webrtc_offer = '', webrtc_answer = '', webrtc_renegotiate = 0, updated_at = ? WHERE id = ?"
            ).bind(now, sos.id).run();
            return jsonResponse({ ok: true, stopped: true, message: 'লাইভ ক্যামেরা শেয়ারিং নিরাপদে বন্ধ করা হয়েছে।' });
        }

        const isExpired = Boolean(sos.camera_expires_at && sos.camera_expires_at <= now);
        if (sos.status !== 'Active' || !sos.camera_consent || !sos.camera_active || isExpired) {
            await env.DB.prepare(
                "UPDATE emergency_sos_alerts SET camera_active = 0, camera_frame = '', camera_session_token = '', webrtc_offer = '', webrtc_answer = '', webrtc_renegotiate = 0, updated_at = ? WHERE id = ?"
            ).bind(now, sos.id).run();
            return jsonResponse({
                ok: false,
                stopped: true,
                reason: sos.status !== 'Active' ? 'resolved' : 'expired_or_stopped'
            });
        }

        const frameCheck = sanitizeSosCameraFrame(body?.frame, 240000);
        if (!frameCheck.ok) {
            return jsonError(400, frameCheck.error);
        }

        await env.DB.prepare(
            'UPDATE emergency_sos_alerts SET camera_frame = ?, camera_updated_at = ?, updated_at = ? WHERE id = ?'
        ).bind(frameCheck.value, now, now, sos.id).run();

        return jsonResponse({ ok: true, stopped: false, updatedAt: now, expiresAt: sos.camera_expires_at });
    }

    // POST /api/admin/emergency/sos/:id/stop-camera (Admin stops live camera feed anytime)
    const adminSosStopCamMatch = path.match(/^\/api\/admin\/emergency\/sos\/([^/]+)\/stop-camera$/);
    if (adminSosStopCamMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(adminSosStopCamMatch[1]);
        const now = new Date().toISOString();
        await env.DB.prepare(
            "UPDATE emergency_sos_alerts SET camera_active = 0, camera_frame = '', camera_session_token = '', webrtc_offer = '', webrtc_answer = '', webrtc_renegotiate = 0, updated_at = ? WHERE id = ? OR alert_number = ?"
        ).bind(now, alertId, alertId).run();
        return jsonResponse({ ok: true, message: 'কাস্টমারের লাইভ ক্যামেরা সেশন বন্ধ করা হয়েছে।' });
    }

    // POST /api/admin/emergency/sos/:id/resolve (Admin marks SOS as solved / resolved)
    const adminSosResolveMatch = path.match(/^\/api\/admin\/emergency\/sos\/([^/]+)\/resolve$/);
    if (adminSosResolveMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const alertId = decodeURIComponent(adminSosResolveMatch[1]);
        const body = await readJson(request);
        const notes = typeof body?.notes === 'string'
            ? body.notes.trim()
            : (typeof body?.resolution_notes === 'string' ? body.resolution_notes.trim() : 'সমস্যা সমাধান সম্পন্ন');
        const now = new Date().toISOString();

        await env.DB.prepare(`
            UPDATE emergency_sos_alerts
            SET status = 'Resolved', resolved_at = ?, resolved_by = ?, resolution_notes = ?,
                camera_active = 0, camera_frame = '', camera_session_token = '',
                webrtc_offer = '', webrtc_answer = '', webrtc_renegotiate = 0, updated_at = ?
            WHERE id = ? OR alert_number = ?
        `).bind(now, auth.identifier || 'admin', notes || 'সমস্যা সমাধান সম্পন্ন', now, alertId, alertId).run();

        return jsonResponse({
            ok: true,
            message: 'এসওএস এলার্ট সফলভাবে সমাধান হিসেবে চিহ্নিত করা হলো।'
        });
    }

    return jsonError(404, 'API endpoint not found.');
}

// Helper: Safe cascade across reviews, financials, booked_seats, bookings
async function deleteBookingsHelper(db, bookingIds) {
    if (!Array.isArray(bookingIds) || !bookingIds.length) return 0;
    const safeIds = Array.from(new Set(bookingIds.filter(Boolean))).slice(0, 500);
    if (!safeIds.length) return 0;
    const placeholders = safeIds.map(() => '?').join(',');

    try {
        await db.prepare(`DELETE FROM reviews WHERE booking_id IN (${placeholders})`).bind(...safeIds).run();
    } catch (e) {
        console.warn('Reviews cleanup notice:', e);
    }
    try {
        await db.prepare(`DELETE FROM booking_financials WHERE booking_id IN (${placeholders})`).bind(...safeIds).run();
    } catch (e) {
        console.warn('Booking financials cleanup notice:', e);
    }
    try {
        await db.prepare(`DELETE FROM booking_seats WHERE booking_id IN (${placeholders})`).bind(...safeIds).run();
    } catch (e) {
        console.warn('Booking seats cleanup notice:', e);
    }
    try {
        await db.prepare(`DELETE FROM booking_seat_legs WHERE booking_id IN (${placeholders})`).bind(...safeIds).run();
    } catch (e) {
        console.warn('Booking seat legs cleanup notice:', e);
    }
    const result = await db.prepare(`DELETE FROM bookings WHERE id IN (${placeholders})`).bind(...safeIds).run();
    return result.meta?.changes || 0;
}

async function handleDelete(context) {
    const { request, env, auth } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // DELETE /api/admin/emergency/sos/:id
    const adminDeleteSosMatch = path.match(/^\/api\/admin\/emergency\/sos\/([^/]+)$/);
    if (adminDeleteSosMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const sosId = decodeURIComponent(adminDeleteSosMatch[1]);
        const sos = await env.DB.prepare('SELECT id, alert_number FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?').bind(sosId, sosId).first();
        if (!sos) return jsonError(404, 'SOS Alert not found.');

        await env.DB.prepare('DELETE FROM sos_captured_photos WHERE sos_id = ?').bind(sos.id).run();
        await env.DB.prepare('DELETE FROM emergency_sos_alerts WHERE id = ?').bind(sos.id).run();
        return jsonResponse({
            ok: true,
            message: `জরুরি SOS অ্যালার্ট ${sos.alert_number} সফলভাবে মুছে ফেলা হয়েছে।`,
            deletedId: sos.id
        });
    }

    // DELETE /api/admin/emergency/sos (Bulk delete or by query parameter)
    if (path === '/api/admin/emergency/sos') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        await ensureSosTable(env.DB);
        const deleteStatus = (url.searchParams.get('status') || '').trim();
        const clearAll = url.searchParams.get('all') === 'true';
        const sosId = (url.searchParams.get('id') || '').trim();

        if (sosId) {
            const target = await env.DB.prepare('SELECT id FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?').bind(sosId, sosId).first();
            if (target) {
                await env.DB.prepare('DELETE FROM sos_captured_photos WHERE sos_id = ?').bind(target.id).run();
            }
            await env.DB.prepare('DELETE FROM emergency_sos_alerts WHERE id = ? OR alert_number = ?').bind(sosId, sosId).run();
            return jsonResponse({ ok: true, message: 'SOS অ্যালার্ট সফলভাবে মুছে ফেলা হয়েছে।' });
        }

        if (deleteStatus === 'Resolved') {
            const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM emergency_sos_alerts WHERE status = 'Resolved'").first();
            const total = (countRow && countRow.total) || 0;
            await env.DB.prepare("DELETE FROM sos_captured_photos WHERE sos_id IN (SELECT id FROM emergency_sos_alerts WHERE status = 'Resolved')").run();
            await env.DB.prepare("DELETE FROM emergency_sos_alerts WHERE status = 'Resolved'").run();
            return jsonResponse({
                ok: true,
                message: `সমাধান হওয়া সমস্ত (${total} টি) SOS অ্যালার্ট স্থায়ীভাবে মুছে ফেলা হয়েছে।`,
                deletedCount: total
            });
        }

        if (clearAll) {
            await env.DB.prepare('DELETE FROM sos_captured_photos').run();
            await env.DB.prepare('DELETE FROM emergency_sos_alerts').run();
            return jsonResponse({ ok: true, message: 'সমস্ত SOS অ্যালার্ট স্থায়ীভাবে মুছে ফেলা হয়েছে।' });
        }

        return jsonError(400, 'Invalid delete request. status=Resolved or id or all=true required.');
    }

    // DELETE /api/admin/support/tickets/:id (Delete single support ticket)
    const adminDeleteTicketMatch = path.match(/^\/api\/admin\/support\/tickets\/([^/]+)$/);
    if (adminDeleteTicketMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const ticketId = decodeURIComponent(adminDeleteTicketMatch[1]);
        const ticket = await env.DB.prepare('SELECT id, ticket_number FROM support_tickets WHERE id = ? OR ticket_number = ?').bind(ticketId, ticketId).first();
        if (!ticket) return jsonError(404, 'Ticket not found.');

        await env.DB.prepare('DELETE FROM support_tickets WHERE id = ?').bind(ticket.id).run();
        return jsonResponse({
            ok: true,
            message: `টিকেট ${ticket.ticket_number} সফলভাবে মুছে ফেলা হয়েছে (Ticket deleted).`,
            deletedId: ticket.id
        });
    }

    // DELETE /api/admin/support/tickets (Bulk or query-based delete)
    if (path === '/api/admin/support/tickets') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const deleteStatus = (url.searchParams.get('status') || '').trim();
        const clearAll = url.searchParams.get('all') === 'true';
        const ticketId = (url.searchParams.get('id') || '').trim();

        if (ticketId) {
            await env.DB.prepare('DELETE FROM support_tickets WHERE id = ? OR ticket_number = ?').bind(ticketId, ticketId).run();
            return jsonResponse({ ok: true, message: 'টিকেট সফলভাবে মুছে ফেলা হয়েছে।' });
        }

        if (deleteStatus === 'Resolved') {
            const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE status = 'Resolved'").first();
            const total = (countRow && countRow.total) || 0;
            await env.DB.prepare("DELETE FROM support_tickets WHERE status = 'Resolved'").run();
            return jsonResponse({
                ok: true,
                message: `সমস্ত সমাধান হওয়া (${total} টি) টিকেট Cloudflare ডাটাবেস থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে।`,
                deletedCount: total
            });
        }

        if (clearAll) {
            await env.DB.prepare('DELETE FROM support_tickets').run();
            return jsonResponse({ ok: true, message: 'সমস্ত সাপোর্ট টিকেট Cloudflare ডাটাবেস থেকে মুছে ফেলা হয়েছে।' });
        }

        return jsonError(400, 'Invalid delete request. status=Resolved or id or all=true required.');
    }

    // DELETE /api/owner/expenses/:id or /api/owner/expenses?id=...
    const ownerExpenseMatch = path.match(/^\/api\/owner\/expenses\/([^/]+)$/);
    if (ownerExpenseMatch || path === '/api/owner/expenses') {
        if (auth?.role !== 'owner') return jsonError(403, 'Unauthorized.');
        const expenseId = ownerExpenseMatch ? decodeURIComponent(ownerExpenseMatch[1]) : url.searchParams.get('id');
        if (!expenseId) return jsonError(400, 'Expense ID required.');

        await env.DB.prepare('DELETE FROM trip_expenses WHERE id = ? AND owner_phone = ?')
            .bind(expenseId, auth.identifier).run();
        return jsonResponse({ ok: true, message: 'Expense deleted successfully.' });
    }

    // DELETE /api/admin/subscriptions/:id or /api/admin/subscriptions?id=...
    const subMatch = path.match(/^\/api\/admin\/subscriptions\/([^/]+)$/);
    if (subMatch || path === '/api/admin/subscriptions') {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const subId = subMatch ? decodeURIComponent(subMatch[1]) : url.searchParams.get('id');
        if (!subId) return jsonError(400, 'Subscription ID required.');
        await env.DB.prepare('DELETE FROM owner_subscriptions WHERE id = ?').bind(subId).run();
        return jsonResponse({ ok: true, message: 'Subscription record deleted successfully.' });
    }

    // DELETE /api/admin/bookings/:id
    const bookingMatch = path.match(/^\/api\/admin\/bookings\/([^/]+)$/);
    if (bookingMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const bookingId = decodeURIComponent(bookingMatch[1]);
        const deletedCount = await deleteBookingsHelper(env.DB, [bookingId]);
        await recordAdminAudit(env.DB, auth, 'DELETE_BOOKING', bookingId, { deletedCount });
        return jsonResponse({ ok: true, deleted: deletedCount, message: `Booking transaction #${bookingId} deleted successfully.` });
    }

    // DELETE /api/owner/bookings/:id (Soft-hide in Owner view; preserves Admin ledger & protects upcoming live bookings)
    const ownerBookingMatch = path.match(/^\/api\/owner\/bookings\/([^/]+)$/);
    if (ownerBookingMatch) {
        if (auth?.role !== 'owner') return jsonError(403, 'Unauthorized.');
        const bookingId = decodeURIComponent(ownerBookingMatch[1]);
        const valid = await env.DB.prepare(
            `SELECT b.id, b.status, b.journey_date FROM bookings b
             JOIN buses bus ON (b.bus_id = bus.id OR b.bus_id = (bus.id || '_RETURN'))
             WHERE b.id = ? AND bus.owner_phone = ?`
        ).bind(bookingId, auth.identifier).first();
        if (!valid) return jsonError(404, 'Booking not found or not owned by your company.');
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        if (['Approved', 'Pending Approval', 'Cancellation Requested'].includes(valid.status) && valid.journey_date >= todayIST) {
            return jsonError(409, 'সক্রিয় বা আসন্ন বুকিং ডিলিট করা যাবে না। অনুগ্রহ করে প্রথমে বুকিংটি Cancel বা Reject করুন।');
        }
        await env.DB.prepare('UPDATE bookings SET hidden_for_owner = 1 WHERE id = ?').bind(bookingId).run();
        return jsonResponse({ ok: true, deleted: 1, message: `Booking #${bookingId} deleted.` });
    }

    // DELETE /api/captain/bookings/:id (Soft-hide for Captain UI; strict bus ownership & _RETURN match)
    const cptBookingMatch = path.match(/^\/api\/captain\/bookings\/([^/]+)$/);
    if (cptBookingMatch) {
        if (auth?.role !== 'captain') return jsonError(403, 'Unauthorized.');
        const bookingId = decodeURIComponent(cptBookingMatch[1]);
        let targetBusId = auth.busId ? String(auth.busId).replace('_RETURN', '') : '';
        if (!targetBusId && auth.identifier) {
            const captainRow = await env.DB.prepare("SELECT bus_id FROM captains WHERE phone = ?").bind(auth.identifier).first();
            if (captainRow && captainRow.bus_id) targetBusId = String(captainRow.bus_id).replace('_RETURN', '');
            if (!targetBusId) {
                const bRow = await env.DB.prepare("SELECT id FROM buses WHERE driver_phone = ?").bind(auth.identifier).first();
                if (bRow && bRow.id) targetBusId = bRow.id;
            }
        }
        if (!targetBusId) return jsonError(403, 'No bus assigned to this captain account.');
        const valid = await env.DB.prepare(
            `SELECT id FROM bookings WHERE id = ? AND (bus_id = ? OR bus_id = ?)`
        ).bind(bookingId, targetBusId, targetBusId + '_RETURN').first();
        if (!valid) return jsonError(404, 'Booking not found for your assigned bus.');
        await env.DB.prepare('UPDATE bookings SET hidden_for_captain = 1 WHERE id = ?').bind(bookingId).run();
        return jsonResponse({ ok: true, deleted: 1, message: `Booking #${bookingId} deleted.` });
    }

    // DELETE /api/customer/bookings/:id (Soft-hide in customer history; preserves financials & seats)
    const custBookingMatch = path.match(/^\/api\/customer\/bookings\/([^/]+)$/);
    if (custBookingMatch) {
        if (auth?.role !== 'customer') return jsonError(403, 'Unauthorized.');
        const bookingId = decodeURIComponent(custBookingMatch[1]);
        const valid = await env.DB.prepare(
            `SELECT id FROM bookings WHERE id = ? AND passenger_phone = ?`
        ).bind(bookingId, auth.identifier).first();
        if (!valid) return jsonError(404, 'Booking not found for your account.');
        await env.DB.prepare('UPDATE bookings SET hidden_for_customer = 1 WHERE id = ? AND passenger_phone = ?')
            .bind(bookingId, auth.identifier).run();
        return jsonResponse({ ok: true, deleted: 1, message: `Booking #${bookingId} deleted from history.` });
    }

    // DELETE /api/admin/reviews/:id
    const reviewMatch = path.match(/^\/api\/admin\/reviews\/([^/]+)$/);
    if (reviewMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const reviewId = decodeURIComponent(reviewMatch[1]);
        await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(reviewId).run();
        await recordAdminAudit(env.DB, auth, 'DELETE_REVIEW', reviewId, {});
        return jsonResponse({ ok: true, message: 'Review deleted successfully.' });
    }

    // DELETE /api/admin/buses/:id (Cascading delete: bus + assigned captain)
    const busMatch = path.match(/^\/api\/admin\/buses\/([^/]+)$/);
    if (busMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const busId = decodeURIComponent(busMatch[1]);
        
        // 1. Find bus and any linked captains before deletion
        const bus = await env.DB.prepare('SELECT id, name, driver_phone, owner_phone FROM buses WHERE id = ?').bind(busId).first();
        
        let capPhones = [];
        if (bus?.driver_phone) capPhones.push(bus.driver_phone);
        
        const linkedCaptains = await env.DB.prepare('SELECT phone FROM captains WHERE bus_id = ?').bind(busId).all();
        (linkedCaptains.results || []).forEach(r => {
            if (r.phone && !capPhones.includes(r.phone)) capPhones.push(r.phone);
        });

        // 2. Delete all captains associated with this bus
        await env.DB.prepare('DELETE FROM captains WHERE bus_id = ?').bind(busId).run();
        await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'captain' AND bus_id = ?").bind(busId).run();

        for (const cp of capPhones) {
            await env.DB.prepare('DELETE FROM captains WHERE phone = ?').bind(cp).run();
            await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'captain' AND identifier = ?").bind(cp).run();
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?").bind(cp).run();
            await env.DB.prepare("DELETE FROM user_login_devices WHERE role = 'captain' AND identifier = ?").bind(cp).run();
            // Block captain from login since their bus was deleted
            await env.DB.prepare(`
                INSERT INTO access_control_list (phone, role, status, reason, blocked_by, blocked_at, updated_at)
                VALUES (?, 'captain', 'permanently_banned', 'নিবন্ধিত বাস ডিলিট হওয়ায় সংশ্লিষ্ট ক্যাপ্টেন অ্যাকাউন্ট ডিলিট করা হয়েছে', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(phone) DO UPDATE SET status = 'permanently_banned', reason = excluded.reason, updated_at = CURRENT_TIMESTAMP
            `).bind(cp).run();
        }

        // 3. Delete bus
        await env.DB.prepare('DELETE FROM buses WHERE id = ?').bind(busId).run();

        return jsonResponse({ ok: true, message: 'বাস এবং সংশ্লিষ্ট ক্যাপ্টেন অ্যাকাউন্ট সফলভাবে ডিলিট করা হয়েছে।' });
    }

    // DELETE /api/admin/owners/:phone (Cascading delete: owner + all buses + all captains + login permanent block)
    const ownerDeleteMatch = path.match(/^\/api\/admin\/owners\/([^/]+)$/);
    if (ownerDeleteMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const ownerPhone = decodeURIComponent(ownerDeleteMatch[1]).trim();
        if (!/^[6-9]\d{9}$/.test(ownerPhone)) {
            return jsonError(400, 'সঠিক ১০-সংখ্যার মোবাইল নম্বর দিন।');
        }

        // 1. Find all buses belonging to this owner
        const ownerBuses = await env.DB.prepare('SELECT id, driver_phone FROM buses WHERE owner_phone = ?').bind(ownerPhone).all();
        const busIds = (ownerBuses.results || []).map(b => b.id);
        
        // 2. Find all captains belonging to this owner's buses
        let capPhones = (ownerBuses.results || []).map(b => b.driver_phone).filter(Boolean);
        if (busIds.length > 0) {
            const placeholders = busIds.map(() => '?').join(',');
            const capRes = await env.DB.prepare(`SELECT phone FROM captains WHERE bus_id IN (${placeholders})`).bind(...busIds).all();
            (capRes.results || []).forEach(r => {
                if (r.phone && !capPhones.includes(r.phone)) capPhones.push(r.phone);
            });
        }

        // 3. Permanently wipe all captains of this owner & block them
        for (const cp of capPhones) {
            await env.DB.prepare('DELETE FROM captains WHERE phone = ?').bind(cp).run();
            await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'captain' AND identifier = ?").bind(cp).run();
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?").bind(cp).run();
            await env.DB.prepare("DELETE FROM user_login_devices WHERE role = 'captain' AND identifier = ?").bind(cp).run();
            await env.DB.prepare(`
                INSERT INTO access_control_list (phone, role, status, reason, blocked_by, blocked_at, updated_at)
                VALUES (?, 'captain', 'permanently_banned', 'বাস মালিকের অ্যাকাউন্ট সম্পূর্ণ ডিলিট হওয়ায় ক্যাপ্টেন ডিলিট করা হয়েছে', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(phone) DO UPDATE SET status = 'permanently_banned', reason = excluded.reason, updated_at = CURRENT_TIMESTAMP
            `).bind(cp).run();
        }

        // 4. Delete all buses of this owner
        await env.DB.prepare('DELETE FROM buses WHERE owner_phone = ?').bind(ownerPhone).run();

        // 5. Delete owner profile & credentials
        await env.DB.prepare('DELETE FROM owners WHERE phone = ?').bind(ownerPhone).run();
        await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'owner' AND identifier = ?").bind(ownerPhone).run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'owner' AND identifier = ?").bind(ownerPhone).run();
        await env.DB.prepare("DELETE FROM user_login_devices WHERE role = 'owner' AND identifier = ?").bind(ownerPhone).run();
        await env.DB.prepare('DELETE FROM owner_requests WHERE owner_phone = ?').bind(ownerPhone).run();
        await env.DB.prepare('DELETE FROM owner_subscriptions WHERE owner_phone = ?').bind(ownerPhone).run();

        // 6. Permanently ban this phone number in access_control_list so neither owner nor captain can ever log in!
        await env.DB.prepare(`
            INSERT INTO access_control_list (phone, role, status, reason, blocked_by, blocked_at, updated_at)
            VALUES (?, 'owner', 'permanently_banned', 'অ্যাডমিন কর্তৃক বাস মালিক অ্যাকাউন্ট চিরতরে ডিলিট ও নিষিদ্ধ করা হয়েছে', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(phone) DO UPDATE SET status = 'permanently_banned', reason = excluded.reason, updated_at = CURRENT_TIMESTAMP
        `).bind(ownerPhone).run();

        return jsonResponse({
            ok: true,
            message: `বাস মালিক (${ownerPhone}), সংশ্লিষ্ট সমস্ত বাস ও ক্যাপ্টেন অ্যাকাউন্ট সম্পূর্ণ ডিলিট করা হয়েছে এবং লগইন চিরতরে বন্ধ করা হয়েছে।`
        });
    }

    // DELETE /api/coupons/:code OR /api/admin/coupons/:code
    const couponMatch = path.match(/^\/api\/(?:admin\/)?coupons\/([^/]+)$/);
    if (couponMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Administrator access required.');
        const code = decodeURIComponent(couponMatch[1]).toUpperCase();
        await env.DB.prepare('DELETE FROM coupons WHERE code = ?').bind(code).run();
        return jsonResponse({ ok: true });
    }

    // DELETE /api/admin/promotions/:id
    const promoDeleteMatch = path.match(/^\/api\/admin\/promotions\/([^/]+)$/);
    if (promoDeleteMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const promoId = decodeURIComponent(promoDeleteMatch[1]);
        await env.DB.prepare('DELETE FROM promotions WHERE id = ?').bind(promoId).run();
        return jsonResponse({ ok: true, message: 'বিজ্ঞাপন সম্পূর্ণ মুছে ফেলা হয়েছে (Promotion deleted).' });
    }

    // DELETE /api/owner/captains/:id OR /api/admin/captains/:id (Delete captain by ID, phone, or bus_id)
    const cptMatch = path.match(/^\/api\/(?:owner|admin)\/captains\/([^/]+)$/);
    if (cptMatch) {
        const rawParam = decodeURIComponent(cptMatch[1]).trim();
        const isOwner = auth?.role === 'owner';
        const ownerPhone = isOwner ? auth.identifier : null;

        // Try finding captain by phone, id, or bus_id
        let captainRow = await env.DB.prepare(
            `SELECT id, phone, name, bus_id FROM captains WHERE id = ? OR phone = ? OR bus_id = ?`
        ).bind(rawParam, rawParam, rawParam).first();

        // Try finding bus by id, or driver_phone
        let bus = await env.DB.prepare(
            `SELECT id, name, driver_phone, driver_name, owner_phone FROM buses WHERE id = ? OR driver_phone = ?`
        ).bind(rawParam, rawParam).first();

        // If owner, ensure this captain or bus belongs to them
        if (isOwner) {
            if (bus && bus.owner_phone !== ownerPhone) {
                return jsonError(403, 'Unauthorized.');
            }
            if (!bus && captainRow) {
                const linkedBus = await env.DB.prepare('SELECT id, owner_phone FROM buses WHERE id = ?').bind(captainRow.bus_id).first();
                if (linkedBus && linkedBus.owner_phone !== ownerPhone) {
                    return jsonError(403, 'Unauthorized.');
                }
            }
        }

        const capPhone = captainRow?.phone || bus?.driver_phone || (rawParam.match(/^[6-9]\d{9}$/) ? rawParam : null);
        const busId = captainRow?.bus_id || bus?.id;

        if (!capPhone && !busId) {
            return jsonError(404, 'ক্যাপ্টেন অ্যাকাউন্ট খুঁজে পাওয়া যায়নি (Captain account not found).');
        }

        // 1. Delete from captains table
        if (capPhone) {
            await env.DB.prepare('DELETE FROM captains WHERE phone = ?').bind(capPhone).run();
        }
        if (busId) {
            await env.DB.prepare('DELETE FROM captains WHERE bus_id = ?').bind(busId).run();
        }

        // 2. Clear driver info from buses
        if (busId) {
            await env.DB.prepare("UPDATE buses SET driver_phone = '', driver_name = '' WHERE id = ?").bind(busId).run();
        } else if (capPhone) {
            await env.DB.prepare("UPDATE buses SET driver_phone = '', driver_name = '' WHERE driver_phone = ?").bind(capPhone).run();
        }

        // 3. Delete from portal_credentials & sessions & devices (do not permanently blacklist phone so owner can re-assign staff later)
        if (capPhone) {
            await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'captain' AND identifier = ?").bind(capPhone).run();
            await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'captain' AND identifier = ?").bind(capPhone).run();
            await env.DB.prepare("DELETE FROM user_login_devices WHERE role = 'captain' AND identifier = ?").bind(capPhone).run();
        }
        if (busId) {
            await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'captain' AND bus_id = ?").bind(busId).run();
        }

        return jsonResponse({ ok: true, message: 'ক্যাপ্টেন অ্যাকাউন্ট সফলভাবে ডিলিট করা হয়েছে।' });
    }

    // DELETE /api/admin/customers/:phone
    const custMatch = path.match(/^\/api\/admin\/customers\/([^/]+)$/);
    if (custMatch) {
        if (auth?.role !== 'admin') return jsonError(403, 'Unauthorized.');
        const phone = decodeURIComponent(custMatch[1]);
        await env.DB.prepare('DELETE FROM customers WHERE phone = ?').bind(phone).run();
        await env.DB.prepare("DELETE FROM portal_sessions WHERE role = 'customer' AND identifier = ?").bind(phone).run();
        await env.DB.prepare("DELETE FROM portal_credentials WHERE role = 'customer' AND identifier = ?").bind(phone).run();
        await env.DB.prepare("DELETE FROM user_login_devices WHERE role = 'customer' AND identifier = ?").bind(phone).run();
        return jsonResponse({ ok: true });
    }

    // DELETE /api/admin/devices/analytics
    if (path === '/api/admin/devices/analytics') {
        return await deleteClientAnalyticsRecords(env.DB, url);
    }

    // DELETE /api/admin/devices/logs
    if (path === '/api/admin/devices/logs') {
        const logId = url.searchParams.get('id');
        const clearAll = url.searchParams.get('all') === 'true';

        if (clearAll) {
            await env.DB.prepare('DELETE FROM user_login_logs').run();
            return jsonResponse({ ok: true, message: 'সমস্ত লগইন হিস্টোরি অডিট লগ মুছে ফেলা হয়েছে (All login logs cleared).' });
        }

        if (logId) {
            await env.DB.prepare('DELETE FROM user_login_logs WHERE id = ?').bind(logId).run();
            return jsonResponse({ ok: true, message: 'লগ রেকর্ড মুছে ফেলা হয়েছে (Log deleted).' });
        }

        return jsonError(400, 'Log ID or all=true required.');
    }

    // DELETE /api/admin/devices
    if (path === '/api/admin/devices') {
        const devId = url.searchParams.get('id');
        const clearAll = url.searchParams.get('all') === 'true';
        const role = url.searchParams.get('role');
        const identifier = url.searchParams.get('identifier');
        const deleteLogs = url.searchParams.get('deleteLogs') !== 'false';

        if (clearAll) {
            await env.DB.prepare('DELETE FROM user_login_devices').run();
            await env.DB.prepare('DELETE FROM user_login_logs').run();
            return jsonResponse({ ok: true, message: 'সমস্ত ডিভাইস ও লগ হিস্টোরি সফলভাবে মুছে ফেলা হয়েছে (All devices & logs cleared).' });
        }

        if (devId) {
            const dev = await env.DB.prepare('SELECT role, identifier FROM user_login_devices WHERE id = ?').bind(devId).first();
            await env.DB.prepare('DELETE FROM user_login_devices WHERE id = ?').bind(devId).run();
            if (dev && deleteLogs) {
                await env.DB.prepare('DELETE FROM user_login_logs WHERE role = ? AND identifier = ?').bind(dev.role, dev.identifier).run();
            }
            return jsonResponse({ ok: true, message: 'ডিভাইস রেকর্ড ও লগইন হিস্টোরি সফলভাবে মুছে ফেলা হয়েছে (Device record deleted).' });
        }

        if (role && identifier) {
            await env.DB.prepare('DELETE FROM user_login_devices WHERE role = ? AND identifier = ?').bind(role, identifier).run();
            if (deleteLogs) {
                await env.DB.prepare('DELETE FROM user_login_logs WHERE role = ? AND identifier = ?').bind(role, identifier).run();
            }
            return jsonResponse({ ok: true, message: 'ডিভাইস রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।' });
        }

        return jsonError(400, 'Device ID or all=true required.');
    }

    return jsonError(404, 'API endpoint not found.');
}
