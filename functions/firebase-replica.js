const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const BATCH_SIZE = 5;
const BACKFILL_PAGE_SIZE = 50;
const BACKFILL_TABLES = [
    { name: 'buses', column: 'id' },
    { name: 'bookings', column: 'id' },
    { name: 'booking_seats', column: 'booking_id' },
    { name: 'reviews', column: 'id' },
    { name: 'coupons', column: 'code' },
    { name: 'bus_service_dates', column: 'bus_id' },
    { name: 'platform_features', column: 'feature_key' },
    { name: 'portal_credentials', column: 'role' },
    { name: 'customers', column: 'phone' },
    { name: 'operator_financial_settings', column: 'owner_phone' },
    { name: 'booking_financials', column: 'booking_id' },
    { name: 'admin_users', column: 'phone' },
    { name: 'admin_audit_log', column: 'id' }
];

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;
let cachedSigningKey = null;

function base64UrlEncode(value) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToBytes(pem) {
    const encoded = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');
    const binary = atob(encoded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function getSigningKey(privateKey) {
    if (!cachedSigningKey) {
        cachedSigningKey = crypto.subtle.importKey(
            'pkcs8',
            pemToBytes(privateKey.replace(/\\n/g, '\n')),
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['sign']
        );
    }
    return cachedSigningKey;
}

async function getAccessToken(env) {
    if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 60_000) {
        return cachedAccessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64UrlEncode(JSON.stringify({
        iss: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
        scope: FIRESTORE_SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600
    }));
    const unsignedToken = `${header}.${claims}`;
    const signingKey = await getSigningKey(env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY);
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        signingKey,
        new TextEncoder().encode(unsignedToken)
    );
    const assertion = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion
        })
    });
    const result = await response.json();
    if (!response.ok || !result.access_token) {
        throw new Error(`Firebase service-account token request failed (${response.status}).`);
    }

    cachedAccessToken = result.access_token;
    cachedAccessTokenExpiresAt = Date.now() + Number(result.expires_in || 3600) * 1000;
    return cachedAccessToken;
}

async function sendReplicaEvent(env, accessToken, event) {
    const projectId = encodeURIComponent(env.FIREBASE_PROJECT_ID);
    const documentId = base64UrlEncode(`${event.collection}:${event.document_key}`);
    const documentUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/busyatra_replica/${encodeURIComponent(event.collection)}/records/${documentId}`;
    const response = await fetch(documentUrl, {
        method: event.operation === 'delete' ? 'DELETE' : 'PATCH',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(event.operation === 'delete' ? {} : { 'Content-Type': 'application/json' })
        },
        ...(event.operation === 'delete' ? {} : {
            body: JSON.stringify({
                fields: {
                    payload: { stringValue: event.payload || '{}' },
                    source: { stringValue: 'cloudflare-d1' },
                    outboxId: { integerValue: String(event.id) },
                    updatedAt: { timestampValue: event.created_at }
                }
            })
        })
    });

    if (event.operation === 'delete' && response.status === 404) return;
    if (!response.ok) {
        throw new Error(`Firestore document write failed (${response.status}).`);
    }
}

export async function drainFirebaseReplica(db, env) {
    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_SERVICE_ACCOUNT_EMAIL ||
        !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const leaseToken = crypto.randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + 120_000).toISOString();
    const lease = await db.prepare(
        `UPDATE firebase_replica_state SET lease_token = ?, lease_expires_at = ?
         WHERE id = 1 AND (lease_token IS NULL OR lease_expires_at <= ?)`
    ).bind(leaseToken, leaseExpiresAt, nowIso).run();
    if (!lease.meta?.changes) return;

    try {
        const { results } = await db.prepare(
            `SELECT id, collection, document_key, operation, payload, created_at, attempt_count
             FROM firebase_replica_outbox WHERE next_attempt_at <= ? ORDER BY id LIMIT ?`
        ).bind(nowIso, BATCH_SIZE).all();

        for (const event of results) {
            try {
                const accessToken = await getAccessToken(env);
                await sendReplicaEvent(env, accessToken, event);
                await db.prepare(
                    'DELETE FROM firebase_replica_outbox WHERE id = ?'
                ).bind(event.id).run();
                await db.prepare(
                    'UPDATE firebase_replica_state SET last_success_at = ?, last_error = NULL WHERE id = 1'
                ).bind(new Date().toISOString()).run();
            } catch (error) {
                const attemptCount = event.attempt_count + 1;
                const retryDelaySeconds = Math.min(60 * (2 ** Math.min(attemptCount - 1, 6)), 3600);
                const nextAttemptAt = new Date(Date.now() + retryDelaySeconds * 1000).toISOString();
                const message = String(error.message || 'Firebase replica write failed.').slice(0, 500);
                await db.prepare(
                    `UPDATE firebase_replica_outbox
                     SET attempt_count = ?, next_attempt_at = ?, last_error = ?
                     WHERE id = ?`
                ).bind(attemptCount, nextAttemptAt, message, event.id).run();
                await db.prepare(
                    'UPDATE firebase_replica_state SET last_error = ? WHERE id = 1'
                ).bind(message).run();
                console.error('Firebase replica event failed; it will be retried.', {
                    eventId: event.id,
                    collection: event.collection,
                    attemptCount,
                    error: message
                });
                break;
            }
        }

    } finally {
        await db.prepare(
            'UPDATE firebase_replica_state SET lease_token = NULL, lease_expires_at = NULL WHERE id = ? AND lease_token = ?'
        ).bind(1, leaseToken).run();
    }
}

export async function enqueueFirebaseBackfillBatch(db) {
    const state = await db.prepare(
        'SELECT table_index, row_cursor, complete FROM firebase_replica_backfill WHERE id = 1'
    ).first();
    if (!state) throw new Error('Firebase replica backfill state is missing; apply the latest D1 migration.');
    if (state.complete) return { complete: true, table: null, queued: 0 };

    const table = BACKFILL_TABLES[state.table_index];
    if (!table) throw new Error('Firebase replica backfill table index is invalid.');
    const updateRows = db.prepare(
        `UPDATE ${table.name} SET ${table.column} = ${table.column}
         WHERE rowid IN (
             SELECT rowid FROM ${table.name} WHERE rowid > ?
             ORDER BY rowid LIMIT ?
         )`
    ).bind(state.row_cursor, BACKFILL_PAGE_SIZE);
    const updateCursor = db.prepare(
        `UPDATE firebase_replica_backfill
         SET row_cursor = COALESCE((
             SELECT MAX(rowid) FROM (
                 SELECT rowid FROM ${table.name} WHERE rowid > ? ORDER BY rowid LIMIT ?
             )
         ), row_cursor)
         WHERE id = 1 AND table_index = ? AND complete = 0`
    ).bind(state.row_cursor, BACKFILL_PAGE_SIZE, state.table_index);
    const advanceTable = db.prepare(
        `UPDATE firebase_replica_backfill
         SET table_index = table_index + 1, row_cursor = 0,
             complete = CASE WHEN table_index + 1 >= ? THEN 1 ELSE 0 END
         WHERE id = 1 AND table_index = ?
           AND NOT EXISTS (
               SELECT 1 FROM ${table.name} WHERE rowid > row_cursor
           )`
    ).bind(BACKFILL_TABLES.length, state.table_index);
    const results = await db.batch([updateRows, updateCursor, advanceTable]);
    const updatedState = await db.prepare(
        'SELECT table_index, row_cursor, complete FROM firebase_replica_backfill WHERE id = 1'
    ).first();

    return {
        complete: Boolean(updatedState.complete),
        table: table.name,
        tableIndex: updatedState.table_index,
        tableCount: BACKFILL_TABLES.length,
        rowCursor: updatedState.row_cursor,
        queued: Number(results[0].meta?.changes || 0)
    };
}

function toFirestoreValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
        return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    }
    if (typeof value === 'string') return { stringValue: value };
    if (Array.isArray(value)) {
        return { arrayValue: { values: value.map(toFirestoreValue) } };
    }
    if (typeof value === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(value)) {
            if (v !== undefined) fields[k] = toFirestoreValue(v);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(value) };
}

export async function writeFirestoreDocument(env, documentPath, data) {
    if (!env || !env.FIREBASE_PROJECT_ID || !env.FIREBASE_SERVICE_ACCOUNT_EMAIL ||
        !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        return false;
    }
    try {
        const accessToken = await getAccessToken(env);
        const projectId = encodeURIComponent(env.FIREBASE_PROJECT_ID);
        const cleanPath = String(documentPath || '')
            .split('/')
            .filter(Boolean)
            .map(seg => encodeURIComponent(seg))
            .join('/');
        if (!cleanPath) return false;
        const fields = {};
        for (const [key, val] of Object.entries(data || {})) {
            if (val !== undefined) fields[key] = toFirestoreValue(val);
        }
        const documentUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${cleanPath}`;
        const response = await fetch(documentUrl, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });
        return response.ok;
    } catch (err) {
        console.warn('writeFirestoreDocument warning:', err?.message || err);
        return false;
    }
}
