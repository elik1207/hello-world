import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Alert, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coupon } from './lib/types';
import { initDb, getCoupons, upsertCoupon, deleteCoupon, clearDb, isDuplicateFingerprint } from './lib/db';
import { generateFingerprint } from './lib/fingerprint';
import { generateId } from './lib/utils';
import { exportWallet, importWalletFile } from './lib/importExport';
import { scheduleCouponReminder, cancelCouponReminder } from './lib/reminders';
import { normalizeIncomingText, classifyIntake, getSafeAnalyticsMeta } from './lib/intake';
import { trackEvent } from './lib/analytics';
import { stableDigest } from './lib/hash';
import { getSharedText, clearSharedText, addShareIntentListener } from './modules/share-intent';
import { BottomNav } from './components/BottomNav';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WalletPage } from './pages/WalletPage';
import { AddEditPage } from './pages/AddEditPage';
import { AddViaAIPage } from './pages/AddViaAIPage';
import { SettingsPage } from './pages/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import * as Sentry from '@sentry/react-native';

import './global-css';

// Feature flags (default OFF)
const INTAKE_DEEPLINK = process.env.EXPO_PUBLIC_FEATURE_INTAKE_DEEPLINK === 'true';
const INTAKE_SHARE = process.env.EXPO_PUBLIC_FEATURE_INTAKE_SHARE === 'true';
const INTAKE_CLIPBOARD = process.env.EXPO_PUBLIC_FEATURE_INTAKE_CLIPBOARD === 'true';

const CLIPBOARD_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const CLIPBOARD_DIGEST_KEY = '@intake_clipboard_digest';
const CLIPBOARD_TIME_KEY = '@intake_clipboard_lastPromptAt';
const CLIPBOARD_ENABLED_KEY = '@intake_clipboard_enabled';

Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || 'https://dummy@o0.ingest.sentry.io/0',
    debug: __DEV__,
    beforeSend(event) {
        // Sanitize PII
        if (event.request) delete event.request.data;
        if (event.user) {
            delete event.user.email;
            delete event.user.ip_address;
        }
        return event;
    }
});

type AppView = 'wallet' | 'add' | 'add-ai' | 'settings';

function App() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [view, setView] = useState<AppView>('wallet');
    const [editingCoupon, setEditingCoupon] = useState<Coupon | undefined>(undefined);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
    const [intakeText, setIntakeText] = useState<string | undefined>(undefined);
    const appState = useRef(AppState.currentState);

    // --- Deep link / Share intake handler ---
    const handleIncomingUrl = useCallback((url: string, source: string = 'deeplink') => {
        try {
            const parsed = Linking.parse(url);
            if (parsed.path === 'intake' && parsed.queryParams?.text) {
                const text = normalizeIncomingText(String(parsed.queryParams.text));
                if (text) {
                    const meta = getSafeAnalyticsMeta(text, source);
                    trackEvent('intake_opened', meta);
                    setIntakeText(text);
                    setView('add-ai');
                }
            }
        } catch (e) {
            console.error('[Intake] Failed to parse URL:', e);
        }
    }, []);

    const handleSharedText = useCallback((text: string) => {
        const normalized = normalizeIncomingText(text);
        if (normalized) {
            const meta = getSafeAnalyticsMeta(normalized, 'share');
            trackEvent('intake_opened', meta);
            setIntakeText(normalized);
            setView('add-ai');
        }
    }, []);

    useEffect(() => {
        initDb().then(async () => {
            const { autoExpireCoupons } = await import('./lib/db');
            await autoExpireCoupons();
            const loaded = await getCoupons();
            setCoupons(loaded);
        }).catch(console.error);

        // Deep link: initial URL (cold start)
        if (INTAKE_DEEPLINK || INTAKE_SHARE) {
            Linking.getInitialURL().then(url => {
                if (url) handleIncomingUrl(url);
            }).catch(console.error);

            // Deep link: warm start
            const sub = Linking.addEventListener('url', (event) => {
                handleIncomingUrl(event.url);
            });

            // Android share intent (cold start): read text from native buffer
            if (INTAKE_SHARE) {
                getSharedText().then(text => {
                    if (text) {
                        handleSharedText(text);
                        clearSharedText();
                    }
                }).catch(e => {
                    if (__DEV__) console.warn('[ShareIntent] bridge unavailable:', e);
                });

                // Warm start: listen for new share events while app is running
                const unsub = addShareIntentListener((event) => {
                    if (event.text) {
                        handleSharedText(event.text);
                        clearSharedText();
                    }
                });

                return () => {
                    sub.remove();
                    unsub();
                };
            }

            return () => sub.remove();
        }
    }, [handleIncomingUrl, handleSharedText]);

    // --- Clipboard suggestion (conservative, non-annoying) ---
    useEffect(() => {
        if (!INTAKE_CLIPBOARD) return;

        const checkClipboard = async () => {
            try {
                const enabledStr = await AsyncStorage.getItem(CLIPBOARD_ENABLED_KEY);
                if (enabledStr !== 'true') return; // Opt-in only

                const text = await Clipboard.getStringAsync();
                if (!text || text.trim().length < 10) return;

                const normalized = normalizeIncomingText(text);
                const classification = classifyIntake(normalized);
                if (!classification.isCandidate) return;

                // Throttle check
                const lastTimeStr = await AsyncStorage.getItem(CLIPBOARD_TIME_KEY);
                if (lastTimeStr && (Date.now() - parseInt(lastTimeStr, 10)) < CLIPBOARD_THROTTLE_MS) return;

                // Dedup check (SHA-256 digest — no text content persisted)
                const digest = await stableDigest(normalized);
                const lastDigest = await AsyncStorage.getItem(CLIPBOARD_DIGEST_KEY);
                if (digest === lastDigest) return;

                await AsyncStorage.setItem(CLIPBOARD_DIGEST_KEY, digest);
                await AsyncStorage.setItem(CLIPBOARD_TIME_KEY, Date.now().toString());

                const meta = getSafeAnalyticsMeta(normalized, 'clipboard');

                Alert.alert(
                    'מצאתי טקסט שנראה כמו שובר',
                    'לשמור לארנק?',
                    [
                        {
                            text: 'לא עכשיו',
                            style: 'cancel',
                            onPress: () => trackEvent('intake_suggested', { ...meta, action: 'dismissed' }),
                        },
                        {
                            text: 'כן',
                            onPress: () => {
                                trackEvent('intake_suggested', { ...meta, action: 'accepted' });
                                setIntakeText(normalized);
                                setView('add-ai');
                            },
                        },
                    ]
                );
            } catch (e) {
                console.error('[Clipboard] check failed:', e);
            }
        };

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                checkClipboard();
            }
            appState.current = nextState;
        });

        return () => subscription.remove();
    }, []);

    const handleNavChange = (newView: AppView) => {
        if (newView === 'add') setEditingCoupon(undefined);
        if (newView !== 'add-ai') setIntakeText(undefined); // Clear intake on nav away
        setView(newView);
    };

    const handleSave = async (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
        const now = Date.now();
        if (editingCoupon) {
            const updated: Coupon = { ...editingCoupon, ...data, updatedAt: now };
            const expiryKey = 'expirationDate' in updated ? (updated as any).expirationDate : updated.expiryDate;
            const fp = await generateFingerprint(updated.store, updated.discountValue || updated.initialValue, updated.code, expiryKey);

            await upsertCoupon(updated, fp);
            if (updated.status === 'active') {
                await scheduleCouponReminder(updated);
            }
            setCoupons((curr) => curr.map((c) => (c.id === editingCoupon.id ? updated : c)));
        } else {
            // Phase 4: True Idempotency Enforcement
            if (data.idempotencyKey && coupons.some(c => c.idempotencyKey === data.idempotencyKey)) {
                console.log('[App] Idempotent save blocked duplicate:', data.idempotencyKey);
                setView('wallet');
                return;
            }

            // Phase 6: Fingerprint Deduplication
            const expiryKey = 'expirationDate' in data ? (data as any).expirationDate : data.expiryDate;
            const fp = await generateFingerprint(data.store, data.discountValue || data.initialValue, data.code, expiryKey);

            if (await isDuplicateFingerprint(fp)) {
                Alert.alert('Duplicate Found', 'This gift or voucher already exists in your wallet.');
                return; // Block save early preventing UI switch
            }

            const newCoupon: Coupon = {
                id: generateId(),
                ...data,
                status: 'active',
                createdAt: now,
                updatedAt: now,
            };

            await upsertCoupon(newCoupon, fp);
            await scheduleCouponReminder(newCoupon);

            setCoupons((curr) => [newCoupon, ...curr]);
        }
        setView('wallet');
        setEditingCoupon(undefined);
    };

    const handleToggleStatus = async (coupon: Coupon) => {
        const nextStatus = coupon.status === 'used' ? 'active' : 'used';
        const updated: Coupon = {
            ...coupon,
            status: nextStatus,
            usedAt: nextStatus === 'used' ? new Date().toISOString() : undefined,
            updatedAt: Date.now()
        };
        const expiryKey = 'expirationDate' in updated ? (updated as any).expirationDate : updated.expiryDate;
        const fp = await generateFingerprint(updated.store, updated.discountValue || updated.initialValue, updated.code, expiryKey);

        await upsertCoupon(updated, fp);

        if (nextStatus === 'used') {
            await cancelCouponReminder(coupon.id);
        } else if (nextStatus === 'active') {
            await scheduleCouponReminder(updated);
        }

        setCoupons((curr) => curr.map((c) => c.id !== coupon.id ? c : updated));
    };

    const handleExport = useCallback(async () => {
        const success = await exportWallet();
        if (!success) Alert.alert('Export Failed', 'Could not export coupons.');
    }, []);

    const handleImport = async () => {
        const content = await importWalletFile();
        if (content) {
            // We need to implement importCoupons logic correctly in db or importExportImpl.
            // Placeholder for now. We will call an async db method.
            const { importCouponsToDb } = await import('./lib/db');
            const report = await importCouponsToDb(content);
            if (report.imported > 0 || report.skippedDuplicateFingerprint > 0 || report.skippedDuplicateIdempotencyKey > 0) {
                const updated = await getCoupons();
                setCoupons(updated);

                const lines = [
                    `Imported: ${report.imported}`,
                    report.skippedDuplicateFingerprint > 0 ? `Skipped (Duplicates): ${report.skippedDuplicateFingerprint}` : null,
                    report.skippedDuplicateIdempotencyKey > 0 ? `Skipped (Already Saved): ${report.skippedDuplicateIdempotencyKey}` : null,
                    report.invalidItems > 0 ? `Invalid items: ${report.invalidItems}` : null,
                    `\nSchema Version: v${report.schemaVersion}`
                ].filter(Boolean);

                Alert.alert('✅ Import Complete', lines.join('\n'));
            } else {
                Alert.alert('Import Failed', 'No valid items found or invalid JSON format.');
            }
        }
    };

    const handleClearData = async () => {
        await clearDb();
        setCoupons([]);
        setIsClearDialogOpen(false);
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#1a1d38' }}>
            <StatusBar style="light" />

            {view === 'wallet' && (
                <WalletPage
                    coupons={coupons}
                    onEdit={(c) => { setEditingCoupon(c); setView('add'); }}
                    onDelete={(c) => setDeleteId(c.id)}
                    onToggleStatus={handleToggleStatus}
                />
            )}
            {view === 'add' && (
                <AddEditPage
                    initialData={editingCoupon}
                    onSave={handleSave}
                    onCancel={() => setView('wallet')}
                    onToggleStatus={async (c) => {
                        await handleToggleStatus(c);
                        setView('wallet');
                        setEditingCoupon(undefined);
                    }}
                />
            )}
            {view === 'add-ai' && (
                <ErrorBoundary onReset={() => setView('wallet')}>
                    <AddViaAIPage
                        onSave={handleSave}
                        onCancel={() => { setIntakeText(undefined); setView('wallet'); }}
                        initialText={intakeText}
                    />
                </ErrorBoundary>
            )}
            {view === 'settings' && (
                <SettingsPage
                    onExport={handleExport}
                    onImport={handleImport}
                    onClear={() => setIsClearDialogOpen(true)}
                />
            )}

            <BottomNav currentView={view} onChange={handleNavChange} />

            <ConfirmDialog
                isOpen={!!deleteId}
                title="Delete Coupon?"
                message="This action cannot be undone."
                onConfirm={async () => {
                    if (deleteId) {
                        await deleteCoupon(deleteId);
                        setCoupons((curr) => curr.filter((c) => c.id !== deleteId));
                    }
                    setDeleteId(null);
                }}
                onCancel={() => setDeleteId(null)}
                confirmLabel="Delete"
                isDestructive
            />

            <ConfirmDialog
                isOpen={isClearDialogOpen}
                title="Clear All Data?"
                message="Are you sure you want to delete ALL coupons? This cannot be undone."
                onConfirm={handleClearData}
                onCancel={() => setIsClearDialogOpen(false)}
                confirmLabel="Clear Everything"
                isDestructive
            />
        </View>
    );
}

export default Sentry.wrap(App);
