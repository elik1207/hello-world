// @ts-nocheck
/**
 * Phase 9.5 Tests: Tag filtering, Saved Views CRUD, Bulk Actions + Reminders integration
 */

// --- Mock setup ---
const mockExecAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockWithTransactionAsync = jest.fn(async (fn: Function) => await fn());

jest.mock('expo-sqlite', () => ({
    openDatabaseAsync: jest.fn(() => Promise.resolve({
        execAsync: mockExecAsync,
        getFirstAsync: mockGetFirstAsync,
        getAllAsync: mockGetAllAsync,
        runAsync: mockRunAsync,
        withTransactionAsync: mockWithTransactionAsync
    }))
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('./fingerprint', () => ({
    generateFingerprint: jest.fn(() => Promise.resolve('mock_fp'))
}));

// Mock reminders module
const mockScheduleCouponReminder = jest.fn(() => Promise.resolve());
const mockCancelCouponReminder = jest.fn(() => Promise.resolve());
const mockGetReminderSettings = jest.fn(() => Promise.resolve({ enabled: true, daysBefore: 3 }));

jest.mock('./reminders', () => ({
    scheduleCouponReminder: (...args: any[]) => mockScheduleCouponReminder(...args),
    cancelCouponReminder: (...args: any[]) => mockCancelCouponReminder(...args),
    getReminderSettings: () => mockGetReminderSettings(),
}));

// Mock analytics
const mockTrackEvent = jest.fn();
jest.mock('./analytics', () => ({
    trackEvent: (...args: any[]) => mockTrackEvent(...args),
}));

import type { Coupon } from './types';

// --- 5.1: listCoupons tag filtering ---
describe('listCoupons - tag filtering', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('tagFilter generates LIKE clauses for each tag', async () => {
        mockGetAllAsync.mockResolvedValueOnce([]);
        const { listCoupons } = await import('./db');
        await listCoupons({ tagFilter: ['gift'] });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
            expect.stringContaining('tags LIKE ?'),
            expect.arrayContaining(['%"gift"%'])
        );
    });

    it('tagFilter with multiple tags generates AND clauses (ALL match)', async () => {
        mockGetAllAsync.mockResolvedValueOnce([]);
        const { listCoupons } = await import('./db');
        await listCoupons({ tagFilter: ['gift', 'food'] });

        const call = mockGetAllAsync.mock.calls[0];
        const sql = call[0] as string;
        const params = call[1] as any[];

        // Should have two separate LIKE clauses
        const likeCount = (sql.match(/tags LIKE \?/g) || []).length;
        expect(likeCount).toBe(2);
        expect(params).toEqual(expect.arrayContaining(['%"gift"%', '%"food"%']));
    });

    it('untaggedOnly returns rows with empty or NULL tags', async () => {
        mockGetAllAsync.mockResolvedValueOnce([]);
        const { listCoupons } = await import('./db');
        await listCoupons({ untaggedOnly: true });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
            expect.stringContaining('tags IS NULL OR tags ='),
            expect.any(Array)
        );
    });

    it('tagFilter + untaggedOnly: untaggedOnly takes precedence (no results for both)', async () => {
        mockGetAllAsync.mockResolvedValueOnce([]);
        const { listCoupons } = await import('./db');
        // When untaggedOnly is true, tagFilter should be ignored or produce empty
        await listCoupons({ tagFilter: ['gift'], untaggedOnly: true });

        const sql = mockGetAllAsync.mock.calls[0][0] as string;
        // Should contain the untaggedOnly clause
        expect(sql).toContain('tags IS NULL OR tags =');
    });
});

// --- 5.2: Saved Views CRUD ---
describe('Saved Views CRUD', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('createSavedView inserts a row with JSON payload', async () => {
        const { createSavedView } = await import('./db');
        await createSavedView('My View', { searchText: 'test', statusTab: 'active', missingOnly: true });

        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO saved_views'),
            expect.arrayContaining([
                'My View',
                expect.stringContaining('"searchText":"test"')
            ])
        );
    });

    it('listSavedViews returns parsed rows', async () => {
        mockGetAllAsync.mockResolvedValueOnce([
            { id: 'v1', name: 'Test View', payload: '{"statusTab":"used"}', createdAt: 1000, updatedAt: 1000 }
        ]);
        const { listSavedViews } = await import('./db');
        const views = await listSavedViews();

        expect(views).toHaveLength(1);
        expect(views[0].name).toBe('Test View');
        expect(views[0].payload.statusTab).toBe('used');
    });

    it('updateSavedView merges name and payload correctly', async () => {
        mockGetFirstAsync.mockResolvedValueOnce({ name: 'Old', payload: '{"statusTab":"all"}' });
        const { updateSavedView } = await import('./db');
        await updateSavedView('v1', 'New Name');

        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE saved_views SET name = ?'),
            expect.arrayContaining(['New Name'])
        );
    });

    it('deleteSavedView removes by id', async () => {
        const { deleteSavedView } = await import('./db');
        await deleteSavedView('v1');

        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM saved_views WHERE id = ?'),
            ['v1']
        );
    });
});

// --- 5.3: Bulk Actions + Reminders orchestration ---
describe('Bulk Actions orchestrator (lib/bulkActions.ts)', () => {
    const makeCoupon = (overrides: Partial<Coupon> = {}): Coupon => ({
        id: 'c1',
        type: 'coupon',
        title: 'Test',
        status: 'active',
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    } as Coupon);

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetReminderSettings.mockResolvedValue({ enabled: true, daysBefore: 3 });
    });

    it('bulkMarkUsed: updates status, cancels reminders, emits analytics', async () => {
        const { bulkMarkUsed } = await import('./bulkActions');
        const coupons = [makeCoupon({ id: 'c1' }), makeCoupon({ id: 'c2' })];

        await bulkMarkUsed(coupons);

        // DB: batchUpdateStatus called with 'used'
        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining('SET status = ?'),
            expect.arrayContaining(['used'])
        );

        // Reminders: cancel called for each id
        expect(mockCancelCouponReminder).toHaveBeenCalledTimes(2);
        expect(mockCancelCouponReminder).toHaveBeenCalledWith('c1');
        expect(mockCancelCouponReminder).toHaveBeenCalledWith('c2');

        // Analytics
        expect(mockTrackEvent).toHaveBeenCalledWith('bulk_action_applied', { action: 'mark_used', count: 2 });
    });

    it('bulkMarkActive: updates status (clears usedAt), reschedules reminders when enabled+expiryDate', async () => {
        const { bulkMarkActive } = await import('./bulkActions');
        const coupons = [
            makeCoupon({ id: 'c1', expiryDate: '2027-01-01' }),
            makeCoupon({ id: 'c2' }), // no expiryDate
        ];

        await bulkMarkActive(coupons);

        // DB: usedAt=NULL
        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining('usedAt = NULL'),
            expect.arrayContaining(['active'])
        );

        // Reminders: schedule for c1 (has expiryDate), cancel for c2 (no expiryDate)
        expect(mockScheduleCouponReminder).toHaveBeenCalledTimes(1);
        expect(mockScheduleCouponReminder).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', status: 'active' }));
        expect(mockCancelCouponReminder).toHaveBeenCalledWith('c2');

        // Analytics
        expect(mockTrackEvent).toHaveBeenCalledWith('bulk_action_applied', { action: 'mark_active', count: 2 });
    });

    it('bulkMarkActive: skips scheduling when reminders disabled', async () => {
        mockGetReminderSettings.mockResolvedValue({ enabled: false, daysBefore: 3 });
        const { bulkMarkActive } = await import('./bulkActions');
        const coupons = [makeCoupon({ id: 'c1', expiryDate: '2027-01-01' })];

        await bulkMarkActive(coupons);

        // Should cancel, not schedule
        expect(mockScheduleCouponReminder).not.toHaveBeenCalled();
        expect(mockCancelCouponReminder).toHaveBeenCalledWith('c1');
    });

    it('bulkDeleteCoupons: cancels reminders then deletes rows', async () => {
        const { bulkDeleteCoupons } = await import('./bulkActions');
        const coupons = [makeCoupon({ id: 'c1' }), makeCoupon({ id: 'c2' })];

        await bulkDeleteCoupons(coupons);

        // Reminders cancelled
        expect(mockCancelCouponReminder).toHaveBeenCalledTimes(2);

        // DB delete
        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM coupons WHERE id IN'),
            ['c1', 'c2']
        );

        // Analytics
        expect(mockTrackEvent).toHaveBeenCalledWith('bulk_action_applied', { action: 'delete', count: 2 });
    });

    it('bulkAddTags emits analytics with hasTags:true', async () => {
        mockGetAllAsync.mockResolvedValueOnce([{ id: 'c1', tags: '["old"]' }]);
        const { bulkAddTags } = await import('./bulkActions');
        await bulkAddTags([{ id: 'c1' }], 'new');

        expect(mockTrackEvent).toHaveBeenCalledWith('bulk_action_applied', { action: 'add_tag', count: 1, hasTags: true });
    });

    it('bulkRemoveTags emits analytics with hasTags:true', async () => {
        mockGetAllAsync.mockResolvedValueOnce([{ id: 'c1', tags: '["old"]' }]);
        const { bulkRemoveTags } = await import('./bulkActions');
        await bulkRemoveTags([{ id: 'c1' }], 'old');

        expect(mockTrackEvent).toHaveBeenCalledWith('bulk_action_applied', { action: 'remove_tag', count: 1, hasTags: true });
    });

    it('empty arrays are no-ops', async () => {
        const { bulkMarkUsed, bulkMarkActive, bulkDeleteCoupons, bulkAddTags, bulkRemoveTags } = await import('./bulkActions');

        await bulkMarkUsed([]);
        await bulkMarkActive([]);
        await bulkDeleteCoupons([]);
        await bulkAddTags([], 'tag');
        await bulkRemoveTags([], 'tag');

        expect(mockRunAsync).not.toHaveBeenCalled();
        expect(mockCancelCouponReminder).not.toHaveBeenCalled();
        expect(mockTrackEvent).not.toHaveBeenCalled();
    });
});
