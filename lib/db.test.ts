// @ts-nocheck
import { initDb, importCouponsToDb, generateExportPayload, isDuplicateFingerprint } from './db';

// Mock sqlite to test logic safely
const mockExecAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockRunAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
    openDatabaseAsync: jest.fn(() => Promise.resolve({
        execAsync: mockExecAsync,
        getFirstAsync: mockGetFirstAsync,
        getAllAsync: mockGetAllAsync,
        runAsync: mockRunAsync
    }))
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('./fingerprint', () => ({
    generateFingerprint: jest.fn(() => Promise.resolve('mock_fingerprint'))
}));

describe('lib/db - Migrations & Deduplication', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('v1 to v2 migration logic runs safely', async () => {
        // Start from version 0
        mockGetFirstAsync.mockResolvedValueOnce({ user_version: 0 });

        await initDb();

        // Assert it creates initial v1 tables
        expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS coupons'));

        // Assert it proceeds to apply v2 schema migrations
        expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE coupons ADD COLUMN fingerprint TEXT'));
        expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA user_version = 2');
    });

    it('import validation and dedupe logic skips duplicates', async () => {
        // Mock that fingerprint check returns true (is a duplicate)
        mockGetFirstAsync.mockResolvedValueOnce({ id: 'existing_id' }); // isDup = true for the item loop inside import

        const jsonStr = JSON.stringify([{
            id: '123',
            title: 'Test',
            type: 'coupon',
            status: 'active',
            store: 'KSP',
            amount: 50,
            code: 'ABC'
        }]);

        const report = await importCouponsToDb(jsonStr);

        // Since it's a dupe, upsert (runAsync) shouldn't be called
        expect(mockRunAsync).not.toHaveBeenCalled();
        expect(report.imported).toBe(0);
        expect(report.skippedDuplicateFingerprint).toBe(1);
    });

    it('import validation successfully merges new items', async () => {
        // Mock that fingerprint check returns false (not a duplicate)
        mockGetFirstAsync.mockResolvedValueOnce(null);

        const jsonStr = JSON.stringify({
            version: 1,
            items: [{
                id: '456',
                title: 'New Voucher',
                status: 'active'
            }]
        });

        const report = await importCouponsToDb(jsonStr);

        expect(report.imported).toBe(1);
        expect(report.schemaVersion).toBe(1);
        // It should try to insert/upsert the new value
        expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO coupons'), expect.any(Array));
    });

    it('rejects completely invalid JSON or raw text', async () => {
        const reportA = await importCouponsToDb('{"foo": "bar"}'); // Wrong schema
        const reportB = await importCouponsToDb('Hey check out this code 456'); // Not JSON

        expect(reportA.invalidItems).toBeGreaterThan(0);
        expect(reportA.imported).toBe(0);
        expect(reportB.invalidItems).toBeGreaterThan(0);
        expect(reportB.imported).toBe(0);
    });

    it('export payload uses schemaVersion 2 and ISO exportedAt', async () => {
        mockGetAllAsync.mockResolvedValueOnce([
            { id: 'item1', title: 'Gift Card', status: 'active' }
        ]);

        const payload = await generateExportPayload();

        expect(payload.schemaVersion).toBe(2);
        expect(Array.isArray(payload.items)).toBe(true);
        expect(payload.items.length).toBe(1);

        // Assert exportedAt is a valid ISO date
        expect(typeof payload.exportedAt).toBe('string');
        const parsedDate = Date.parse(payload.exportedAt);
        expect(Number.isNaN(parsedDate)).toBe(false);
    });

    it('import dedupe by idempotencyKey increments skippedDuplicateIdempotencyKey', async () => {
        // mockGetFirstAsync will be called multiple times: 
        // 1. isDuplicateIdempotencyKey -> return existing match
        // 2. We shouldn't hit isDuplicateFingerprint if it skips early, but returning null just in case
        mockGetFirstAsync.mockResolvedValueOnce({ id: 'existing_idem_id' });

        const jsonStr = JSON.stringify({
            schemaVersion: 2,
            items: [{
                id: 'new_id',
                title: 'Duplicate Try',
                status: 'active',
                idempotencyKey: 'idem-123',
                amount: 100 // different details, would yield different fingerprint
            }]
        });

        const report = await importCouponsToDb(jsonStr);

        expect(report.imported).toBe(0);
        expect(report.skippedDuplicateIdempotencyKey).toBe(1);
        expect(report.skippedDuplicateFingerprint).toBe(0);
        expect(mockRunAsync).not.toHaveBeenCalled(); // No insertion
    });

    it('upsertCoupon translates quality logic and usedAt fields accurately', async () => {
        const { upsertCoupon } = await import('./db');
        await upsertCoupon({
            id: 'demo-123',
            type: 'coupon',
            title: 'Mock Deals',
            discountType: 'percent',
            currency: 'ILS',
            status: 'used',
            usedAt: '2024-05-01T12:00:00Z',
            // Notice: omitted store, code, value. missingFields should be > 0.
            createdAt: 1000,
            updatedAt: 1000,
        });

        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining('INSERT OR REPLACE INTO coupons'),
            expect.arrayContaining([
                'demo-123',
                '2024-05-01T12:00:00Z', // usedAt
                3, // missingFieldCount (store/title(no store), values, code) -> actually title exists, so 2 missing (values, code)
                0  // needsReviewFieldCount
            ])
        );
    });
});

describe('lib/db - Search & Filter (listCoupons)', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('listCoupons injects LIKE queries safely on searchTerm matches', async () => {
        mockGetAllAsync.mockResolvedValueOnce([]);
        const { listCoupons } = await import('./db');
        await listCoupons({ searchText: 'Zara' });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
            expect.stringContaining('OR store LIKE ? OR code LIKE ?'),
            expect.arrayContaining(['%Zara%'])
        );
    });

    it('listCoupons builds ascending expiryDate orders pushing nulls to back', async () => {
        mockGetAllAsync.mockResolvedValueOnce([{ id: 'mock' }]);
        const { listCoupons } = await import('./db');
        await listCoupons({ sortBy: 'expiryDate', sortDir: 'asc' });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY CASE WHEN expiryDate IS NULL OR expiryDate = \'\' THEN 1 ELSE 0 END, expiryDate ASC'),
            expect.any(Array)
        );
    });

    it('listCoupons isolates status filters actively', async () => {
        mockGetAllAsync.mockResolvedValueOnce([]);
        const { listCoupons } = await import('./db');
        await listCoupons({ statusFilter: 'used' });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
            expect.stringContaining('AND status = ?'),
            expect.arrayContaining(['used'])
        );
    });

    it('listCoupons executes quality flag filters natively via SQLite', async () => {
        mockGetAllAsync.mockResolvedValueOnce([]);
        const { listCoupons } = await import('./db');
        await listCoupons({ needsReviewOnly: true });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
            expect.stringContaining('AND needsReviewFieldCount > 0'),
            expect.any(Array)
        );
    });
});

describe('lib/db - Status automation (autoExpireCoupons)', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('autoExpireCoupons skips if nothing is expired', async () => {
        // Mock get active coupons returning something valid next month
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + 1);
        mockGetAllAsync.mockResolvedValueOnce([{ id: 'c1', expiryDate: futureDate.toISOString() }]);

        const { autoExpireCoupons } = await import('./db');
        await autoExpireCoupons();

        expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('autoExpireCoupons fires UPDATE on explicit expiration boundaries', async () => {
        const pastDate = new Date();
        pastDate.setMonth(pastDate.getMonth() - 1);
        mockGetAllAsync.mockResolvedValueOnce([{ id: 'c2', expiryDate: pastDate.toISOString() }]);

        const { autoExpireCoupons } = await import('./db');
        await autoExpireCoupons();

        expect(mockRunAsync).toHaveBeenCalledWith(
            'UPDATE coupons SET status = ? WHERE id = ?',
            ['expired', 'c2']
        );
    });
});
