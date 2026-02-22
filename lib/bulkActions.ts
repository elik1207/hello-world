import { batchUpdateStatus, batchAddTag, batchRemoveTag, batchDelete } from './db';
import { cancelCouponReminder, scheduleCouponReminder, getReminderSettings } from './reminders';
import { trackEvent } from './analytics';
import type { Coupon } from './types';

export async function bulkMarkUsed(coupons: Coupon[]): Promise<void> {
    if (coupons.length === 0) return;
    const ids = coupons.map(c => c.id);

    // DB Update
    await batchUpdateStatus(ids, 'used');

    // Reminders
    for (const id of ids) {
        await cancelCouponReminder(id);
    }

    // Analytics
    trackEvent('bulk_action_applied', { action: 'mark_used', count: ids.length });
}

export async function bulkMarkActive(coupons: Coupon[]): Promise<void> {
    if (coupons.length === 0) return;
    const ids = coupons.map(c => c.id);

    // DB Update
    await batchUpdateStatus(ids, 'active');

    // Reminders
    const settings = await getReminderSettings();
    for (const coupon of coupons) {
        if (settings.enabled && coupon.expiryDate) {
            // scheduleCouponReminder encapsulates logic for active check and cancelling existing
            await scheduleCouponReminder({ ...coupon, status: 'active' });
        } else {
            await cancelCouponReminder(coupon.id);
        }
    }

    // Analytics
    trackEvent('bulk_action_applied', { action: 'mark_active', count: ids.length });
}

export async function bulkDeleteCoupons(coupons: Pick<Coupon, 'id'>[]): Promise<void> {
    if (coupons.length === 0) return;
    const ids = coupons.map(c => c.id);

    // Reminders
    for (const id of ids) {
        await cancelCouponReminder(id);
    }

    // DB Update
    await batchDelete(ids);

    // Analytics
    trackEvent('bulk_action_applied', { action: 'delete', count: ids.length });
}

export async function bulkAddTags(coupons: Pick<Coupon, 'id'>[], tag: string): Promise<void> {
    if (coupons.length === 0 || !tag.trim()) return;
    const ids = coupons.map(c => c.id);

    await batchAddTag(ids, tag.trim());

    trackEvent('bulk_action_applied', { action: 'add_tag', count: ids.length, hasTags: true });
}

export async function bulkRemoveTags(coupons: Pick<Coupon, 'id'>[], tag: string): Promise<void> {
    if (coupons.length === 0 || !tag.trim()) return;
    const ids = coupons.map(c => c.id);

    await batchRemoveTag(ids, tag.trim());

    trackEvent('bulk_action_applied', { action: 'remove_tag', count: ids.length, hasTags: true });
}
