import { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Coupon } from './lib/types';
import { initDb, getCoupons, upsertCoupon, deleteCoupon, clearDb, isDuplicateFingerprint } from './lib/db';
import { generateFingerprint } from './lib/fingerprint';
import { generateId } from './lib/utils';
import { exportWallet, importWalletFile } from './lib/importExport';
import { BottomNav } from './components/BottomNav';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WalletPage } from './pages/WalletPage';
import { AddEditPage } from './pages/AddEditPage';
import { AddViaAIPage } from './pages/AddViaAIPage';
import { SettingsPage } from './pages/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import * as Sentry from '@sentry/react-native';

import './global-css';

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

    useEffect(() => {
        initDb().then(() => getCoupons().then(setCoupons)).catch(console.error);
    }, []);

    const handleNavChange = (newView: AppView) => {
        if (newView === 'add') setEditingCoupon(undefined);
        setView(newView);
    };

    const handleSave = async (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
        const now = Date.now();
        if (editingCoupon) {
            const updated: Coupon = { ...editingCoupon, ...data, updatedAt: now };
            const expiryKey = 'expirationDate' in updated ? (updated as any).expirationDate : updated.expiryDate;
            const fp = await generateFingerprint(updated.store, updated.discountValue || updated.initialValue, updated.code, expiryKey);

            await upsertCoupon(updated, fp);
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
            setCoupons((curr) => [newCoupon, ...curr]);
        }
        setView('wallet');
        setEditingCoupon(undefined);
    };

    const handleToggleStatus = async (coupon: Coupon) => {
        const updated: Coupon = { ...coupon, status: coupon.status === 'used' ? 'active' : 'used', updatedAt: Date.now() };
        const expiryKey = 'expirationDate' in updated ? (updated as any).expirationDate : updated.expiryDate;
        const fp = await generateFingerprint(updated.store, updated.discountValue || updated.initialValue, updated.code, expiryKey);

        await upsertCoupon(updated, fp);
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
            const ok = await importCouponsToDb(content);
            if (ok) {
                const updated = await getCoupons();
                setCoupons(updated);
                Alert.alert('✅ Imported', 'Coupons imported successfully!');
            } else {
                Alert.alert('Import Failed', 'Invalid JSON format.');
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
                />
            )}
            {view === 'add-ai' && (
                <ErrorBoundary onReset={() => setView('wallet')}>
                    <AddViaAIPage
                        onSave={handleSave}
                        onCancel={() => setView('wallet')}
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
