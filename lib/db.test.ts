// @ts-nocheck
import { initDb, importCouponsToDb, isDuplicateFingerprint } from './db';

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
});
