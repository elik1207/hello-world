// @ts-nocheck
import { scheduleCouponReminder, cancelCouponReminder, getReminderSettings } from './reminders';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    setNotificationHandler: jest.fn()
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));

// Mock today to a fixed date to allow date math tests
beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-05-01T12:00:00Z'));
});

afterAll(() => {
    jest.useRealTimers();
});

describe('lib/reminders - Local Scheduling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // default mock settings response
        AsyncStorage.getItem.mockImplementation(async (key) => {
            if (key === '@wallet_reminders_enabled') return 'true';
            if (key === '@wallet_remind_days') return '3';
            return null;
        });
    });

    it('skips scheduling if reminder settings are explicitly disabled', async () => {
        AsyncStorage.getItem.mockImplementation(async (key) => {
            if (key === '@wallet_reminders_enabled') return 'false';
            return null;
        });

        await scheduleCouponReminder({
            id: 'c1',
            status: 'active',
            expiryDate: '2024-05-15'
        });

        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('bails if coupon status is used', async () => {
        await scheduleCouponReminder({
            id: 'c1',
            status: 'used',
            expiryDate: '2024-05-15'
        });

        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules notification 3 days prior at 10 AM by default', async () => {
        await scheduleCouponReminder({
            id: 'c1',
            status: 'active',
            expiryDate: '2024-05-10' // 9 days out
        });

        // 3 days prior would be May 7th at 10 AM
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                identifier: 'reminder_c1',
                trigger: expect.objectContaining({
                    // Only match the fact that the date object contains this date
                    date: expect.any(Date)
                } as any),
                content: expect.objectContaining({
                    body: expect.stringContaining('3 days')
                })
            })
        );

        // Assert date explicitly
        const callArgs = Notifications.scheduleNotificationAsync.mock.calls[0][0];
        const dateObj = callArgs.trigger.date;
        expect(dateObj.getDate()).toBe(7);
        expect(dateObj.getHours()).toBe(10);
        expect(dateObj.getMonth()).toBe(4); // May is 0-indexed 4
    });

    it('does not dispatch if reminder date is already in the past', async () => {
        // Expiry is tomorrow (May 2). Remind mapping throws target date to April 29th (-3).
        // That target date is in the past! It should not trigger.
        await scheduleCouponReminder({
            id: 'c1',
            status: 'active',
            expiryDate: '2024-05-02'
        });

        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancel dispatch isolates specific identifier', async () => {
        await cancelCouponReminder('xyz-123');

        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder_xyz-123');
    });
});
