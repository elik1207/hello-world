import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isExpired, parseLocalDate } from './utils';
import { Coupon } from './types';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const REMINDERS_ENABLED_KEY = '@wallet_reminders_enabled';

// Keep legacy key exports for backward compat (settings migration)
export const REMIND_DAYS_KEY = '@wallet_remind_days';

export async function getReminderSettings() {
    const enabledStr = await AsyncStorage.getItem(REMINDERS_ENABLED_KEY);
    return {
        enabled: enabledStr !== 'false', // default true
        daysBefore: 0 // deprecated — kept for API compat
    };
}

export async function setReminderSettings(enabled: boolean, _daysBefore?: number) {
    await AsyncStorage.setItem(REMINDERS_ENABLED_KEY, enabled.toString());
}

export async function requestPermissionsAsync() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    return finalStatus === 'granted';
}

// ---------------------------------------------------------------------------
// Smart tiered reminder computation
// ---------------------------------------------------------------------------

interface ReminderSlot {
    daysBefore: number;
    label: string;
    title: string;
    body: string;
}

/**
 * Compute which reminders to schedule based on how far away expiry is.
 *
 * | Time to Expiry  | Reminders              |
 * |-----------------|------------------------|
 * | > 1 year        | 180d + 30d             |
 * | 3–12 months     | 30d                    |
 * | 1–3 months      | 30d + 7d               |
 * | < 1 month       | 7d + 3d                |
 */
function computeReminderSlots(daysUntilExpiry: number): ReminderSlot[] {
    if (daysUntilExpiry > 365) {
        return [
            {
                daysBefore: 180,
                label: '6m',
                title: '💡 יש לך שובר ששווה להשתמש בו',
                body: 'לא לשכוח שיש לך שובר! עדיין בתוקף, אבל חבל שיישכח.',
            },
            {
                daysBefore: 30,
                label: '30d',
                title: '📅 שובר פג בעוד חודש',
                body: 'יש לך שובר שפג בעוד חודש. כדאי להשתמש בו!',
            },
        ];
    }
    if (daysUntilExpiry > 90) {
        return [
            {
                daysBefore: 30,
                label: '30d',
                title: '📅 שובר פג בעוד חודש',
                body: 'יש לך שובר שפג בעוד חודש. כדאי להשתמש בו!',
            },
        ];
    }
    if (daysUntilExpiry > 30) {
        return [
            {
                daysBefore: 30,
                label: '30d',
                title: '📅 שובר פג בעוד חודש',
                body: 'יש לך שובר שפג בעוד חודש. כדאי להשתמש בו!',
            },
            {
                daysBefore: 7,
                label: '7d',
                title: '⏰ שובר עומד לפוג בעוד שבוע!',
                body: 'נשאר שבוע אחרון! פתח את הארנק ותממש.',
            },
        ];
    }
    // < 1 month
    return [
        {
            daysBefore: 7,
            label: '7d',
            title: '⏰ שובר עומד לפוג בעוד שבוע!',
            body: 'נשאר שבוע אחרון! פתח את הארנק ותממש.',
        },
        {
            daysBefore: 3,
            label: '3d',
            title: '⚠️ שובר עומד לפוג בעוד 3 ימים!',
            body: 'מהרו! השובר שלכם פג בעוד 3 ימים.',
        },
    ];
}

// All possible labels used for identifier suffixes
const ALL_REMINDER_LABELS = ['6m', '30d', '7d', '3d'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function scheduleCouponReminder(coupon: Coupon) {
    // 1. Always cancel ALL existing reminders for this coupon first
    await cancelCouponReminder(coupon.id);

    // 2. Base viability checks
    if (coupon.status !== 'active') return;
    if (!coupon.expiryDate) return;
    if (isExpired(coupon.expiryDate)) return;

    // 3. Settings check
    const settings = await getReminderSettings();
    if (!settings.enabled) return;

    const hasPermission = await requestPermissionsAsync();
    if (!hasPermission) return;

    const expiry = parseLocalDate(coupon.expiryDate);
    if (!expiry) return;

    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const slots = computeReminderSlots(daysUntilExpiry);

    for (const slot of slots) {
        const targetDate = new Date(expiry);
        targetDate.setDate(targetDate.getDate() - slot.daysBefore);
        targetDate.setHours(10, 0, 0, 0);

        // Skip if reminder date is already in the past
        if (targetDate.getTime() < Date.now()) continue;

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: slot.title,
                    body: slot.body,
                    // DO NOT INCLUDE THE VOUCHER CODE for PII hardening
                    data: { couponId: coupon.id },
                },
                trigger: {
                    date: targetDate,
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                } as Notifications.DateTriggerInput,
                identifier: `reminder_${coupon.id}_${slot.label}`,
            });
            console.log(`[Reminders] Scheduled ${slot.label} reminder for ${coupon.id} at ${targetDate.toISOString()}`);
        } catch (e) {
            console.error(`[Reminders] Failed to schedule ${slot.label} push:`, e);
        }
    }
}

export async function cancelCouponReminder(couponId: string) {
    // Cancel all tiered reminders for this coupon
    for (const label of ALL_REMINDER_LABELS) {
        try {
            await Notifications.cancelScheduledNotificationAsync(`reminder_${couponId}_${label}`);
        } catch (e) {
            // Ignore gracefully
        }
    }
    // Also cancel legacy single-reminder format
    try {
        await Notifications.cancelScheduledNotificationAsync(`reminder_${couponId}`);
    } catch (e) {
        // Ignore
    }
}

