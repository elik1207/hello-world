import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isExpired, parseLocalDate } from './utils';
import { Coupon } from './types';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const REMIND_DAYS_KEY = '@wallet_remind_days';
export const REMINDERS_ENABLED_KEY = '@wallet_reminders_enabled';

export async function getReminderSettings() {
    const enabledStr = await AsyncStorage.getItem(REMINDERS_ENABLED_KEY);
    const daysStr = await AsyncStorage.getItem(REMIND_DAYS_KEY);
    return {
        enabled: enabledStr !== 'false', // default true
        daysBefore: daysStr ? parseInt(daysStr, 10) : 3 // default 3
    };
}

export async function setReminderSettings(enabled: boolean, daysBefore: number) {
    await AsyncStorage.setItem(REMINDERS_ENABLED_KEY, enabled.toString());
    await AsyncStorage.setItem(REMIND_DAYS_KEY, daysBefore.toString());
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

export async function scheduleCouponReminder(coupon: Coupon) {
    // 1. Always cancel any existing reminder for this coupon first
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

    // Schedule for 10:00 AM local time on the target day
    const targetDate = new Date(expiry);
    targetDate.setDate(targetDate.getDate() - settings.daysBefore);
    targetDate.setHours(10, 0, 0, 0);

    // If the reminder date is already in the past (e.g., expiry is tomorrow, remind 3 days ago), skip it
    if (targetDate.getTime() < Date.now()) return;

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: 'תוקף שובר מתקרב',
                body: 'יש לך שובר שעומד לפוג בקרוב. פתח את האפליקציה לפרטים.',
                // DO NOT INCLUDE THE VOUCHER CODE `coupon.code` FOR PII HARDENING
                data: { couponId: coupon.id },
            },
            trigger: {
                date: targetDate,
                type: Notifications.SchedulableTriggerInputTypes.DATE,
            } as Notifications.DateTriggerInput,
            identifier: `reminder_${coupon.id}` // Use consistent ID
        });
        console.log(`[Reminders] Scheduled local push for ${coupon.id} at ${targetDate.toISOString()}`);
    } catch (e) {
        console.error('[Reminders] Failed to schedule push:', e);
    }
}

export async function cancelCouponReminder(couponId: string) {
    try {
        await Notifications.cancelScheduledNotificationAsync(`reminder_${couponId}`);
    } catch (e) {
        // Ignore gracefully
    }
}
