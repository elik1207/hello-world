import * as SQLite from 'expo-sqlite';
import { Coupon, ItemType, DiscountType, CouponStatus } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateFingerprint } from './fingerprint';
import { z } from 'zod';

export interface ImportReport {
    schemaVersion: number;
    imported: number;
    skippedDuplicateFingerprint: number;
    skippedDuplicateIdempotencyKey: number;
    invalidItems: number;
}

const DB_NAME = 'wallet.db';

export async function getDb() {
    return SQLite.openDatabaseAsync(DB_NAME);
}

export async function initDb(): Promise<void> {
    const db = await getDb();

    // SQLite uses PRAGMA user_version to track schema version
    const { user_version } = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version') || { user_version: 0 };
    let currentVersion = user_version;

    if (currentVersion === 0) {
        // v1: basic fields
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS coupons (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                discountType TEXT NOT NULL,
                discountValue REAL,
                initialValue REAL,
                remainingValue REAL,
                currency TEXT NOT NULL,
                expiryDate TEXT,
                store TEXT,
                category TEXT,
                code TEXT,
                status TEXT NOT NULL,
                sender TEXT,
                event TEXT,
                imageUrl TEXT,
                barcodeData TEXT
            );
        `);
        currentVersion = 1;
        await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
    }

    if (currentVersion === 1) {
        // v2: adding idempotencyKey, createdAt, updatedAt, and fingerprint
        await db.execAsync(`
            ALTER TABLE coupons ADD COLUMN idempotencyKey TEXT;
            ALTER TABLE coupons ADD COLUMN createdAt INTEGER DEFAULT 0;
            ALTER TABLE coupons ADD COLUMN updatedAt INTEGER DEFAULT 0;
            ALTER TABLE coupons ADD COLUMN fingerprint TEXT;
            
            CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_fingerprint ON coupons(fingerprint) WHERE fingerprint IS NOT NULL;
        `);
        currentVersion = 2;
        await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
    }

    // Attempt migration from AsyncStorage ONE TIME
    await migrateFromAsyncStorage(db);
}

async function migrateFromAsyncStorage(db: SQLite.SQLiteDatabase) {
    const MIGRATED_FLAG = '@legacy_storage_migrated';
    const hasMigrated = await AsyncStorage.getItem(MIGRATED_FLAG);
    if (hasMigrated === 'true') return;

    try {
        const json = await AsyncStorage.getItem('coupon_wallet_v1');
        if (json) {
            const parsed = JSON.parse(json);
            let items: Coupon[] = [];
            if (Array.isArray(parsed)) items = parsed;
            else if (parsed?.version === 1 && Array.isArray(parsed.items)) items = parsed.items;

            for (const item of items) {
                // Generate a fingerprint for the legacy item
                const fingerprint = await generateFingerprint(item.store, item.discountValue || item.initialValue, item.code, item.expiryDate);
                await upsertCoupon(item, fingerprint);
            }
        }
        await AsyncStorage.setItem(MIGRATED_FLAG, 'true');
    } catch (e) {
        console.error('Migration failed:', e);
    }
}

export async function getCoupons(): Promise<Coupon[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM coupons ORDER BY createdAt DESC');
    return rows.map(row => ({
        ...row,
        // The DB stores numeric representations, but types uses actual types.
        // Mostly strings except numbers:
        discountValue: row.discountValue !== null ? row.discountValue : undefined,
        initialValue: row.initialValue !== null ? row.initialValue : undefined,
        remainingValue: row.remainingValue !== null ? row.remainingValue : undefined,
    } as Coupon));
}

export async function generateExportPayload() {
    const coupons = await getCoupons();
    return {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        items: coupons
    };
}

export async function isDuplicateFingerprint(fingerprint: string): Promise<boolean> {
    const db = await getDb();
    const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM coupons WHERE fingerprint = ?', [fingerprint]);
    return !!existing;
}

export async function isDuplicateIdempotencyKey(key: string): Promise<boolean> {
    const db = await getDb();
    const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM coupons WHERE idempotencyKey = ?', [key]);
    return !!existing;
}

export async function upsertCoupon(coupon: Coupon, fingerprint?: string): Promise<void> {
    const db = await getDb();
    // Use INSERT OR REPLACE
    await db.runAsync(`
        INSERT OR REPLACE INTO coupons (
            id, type, title, description, discountType, discountValue,
            initialValue, remainingValue, currency, expiryDate, store,
            category, code, status, sender, event, imageUrl, barcodeData,
            idempotencyKey, createdAt, updatedAt, fingerprint
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    `, [
        coupon.id, coupon.type, coupon.title, coupon.description || null, coupon.discountType,
        coupon.discountValue || null, coupon.initialValue || null, coupon.remainingValue || null,
        coupon.currency, coupon.expiryDate || null, coupon.store || null, coupon.category || null,
        coupon.code || null, coupon.status, coupon.sender || null, coupon.event || null,
        coupon.imageUrl || null, coupon.barcodeData || null, coupon.idempotencyKey || null,
        coupon.createdAt || Date.now(), coupon.updatedAt || Date.now(), fingerprint || null
    ]);
}

export async function deleteCoupon(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM coupons WHERE id = ?', [id]);
}

export async function clearDb(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM coupons');
}

export async function importCouponsToDb(jsonStr: string): Promise<ImportReport> {
    const report: ImportReport = {
        schemaVersion: 1, // Default assumption for legacy arrays
        imported: 0,
        skippedDuplicateFingerprint: 0,
        skippedDuplicateIdempotencyKey: 0,
        invalidItems: 0
    };

    try {
        const parsed = JSON.parse(jsonStr);
        let rawItems: any[] = [];

        // Support schema V2, V1, and legacy plain arrays
        if (Array.isArray(parsed)) {
            rawItems = parsed;
        } else if (parsed && typeof parsed === 'object') {
            if (parsed.schemaVersion === 2 || parsed.version === 1) {
                report.schemaVersion = parsed.schemaVersion || parsed.version;
                rawItems = Array.isArray(parsed.items) ? parsed.items : [];
            } else {
                throw new Error("Unknown export schema");
            }
        } else {
            throw new Error("Invalid export structure");
        }

        const CouponSchema = z.object({
            id: z.string(),
            title: z.string(),
            type: z.enum(['coupon', 'gift_card', 'store_credit']).catch('coupon' as any),
            status: z.enum(['active', 'used', 'expired']).catch('active' as any),
            discountType: z.enum(['percent', 'fixed', 'item']).catch('percent' as any),
            currency: z.string().catch('ILS'),
            discountValue: z.number().optional().nullable(),
            initialValue: z.number().optional().nullable(),
            remainingValue: z.number().optional().nullable(),
            expiryDate: z.string().optional().nullable(),
            expirationDate: z.string().optional().nullable(),
            store: z.string().optional().nullable(),
            code: z.string().optional().nullable(),
            idempotencyKey: z.string().optional().nullable(),
            createdAt: z.number().optional().nullable(),
            updatedAt: z.number().optional().nullable(),
        }).passthrough(); // Accept other fields

        for (const item of rawItems) {
            const validation = CouponSchema.safeParse(item);
            if (!validation.success) {
                report.invalidItems++;
                continue;
            }

            const validItem = validation.data as unknown as Coupon;

            // Set defaults if missing
            validItem.createdAt = validItem.createdAt || Date.now();
            validItem.updatedAt = validItem.updatedAt || Date.now();

            // 1. Check Idempotency Key deduplication
            if (validItem.idempotencyKey) {
                const isIdempotentDup = await isDuplicateIdempotencyKey(validItem.idempotencyKey);
                if (isIdempotentDup) {
                    report.skippedDuplicateIdempotencyKey++;
                    continue;
                }
            }

            // 2. Check Fingerprint deduplication
            const expiryKey = 'expirationDate' in validItem ? (validItem as any).expirationDate : validItem.expiryDate;
            const fp = await generateFingerprint(validItem.store, validItem.discountValue || validItem.initialValue, validItem.code, expiryKey);

            const isFpDup = await isDuplicateFingerprint(fp);
            if (isFpDup) {
                report.skippedDuplicateFingerprint++;
                continue;
            }

            // 3. Insert and increment
            await upsertCoupon(validItem, fp);
            report.imported++;
        }
    } catch (e) {
        console.error('Import failed', e);
        report.invalidItems++;
    }

    return report;
}
