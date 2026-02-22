import { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Coupon } from './lib/types';
import { getCoupons, saveCoupons, clearCoupons, importCoupons, generateId } from './lib/storage';
import { exportWallet, importWalletFile } from './lib/importExport';
import { BottomNav } from './components/BottomNav';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WalletPage } from './pages/WalletPage';
import { AddEditPage } from './pages/AddEditPage';
import { AddViaAIPage } from './pages/AddViaAIPage';
import { SettingsPage } from './pages/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';

import './global-css';

type AppView = 'wallet' | 'add' | 'add-ai' | 'settings';

export default function App() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [view, setView] = useState<AppView>('wallet');
    const [editingCoupon, setEditingCoupon] = useState<Coupon | undefined>(undefined);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

    useEffect(() => {
        getCoupons().then(setCoupons);
    }, []);

    useEffect(() => {
        saveCoupons(coupons);
    }, [coupons]);

    const handleNavChange = (newView: AppView) => {
        if (newView === 'add') setEditingCoupon(undefined);
        setView(newView);
    };

    const handleSave = (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
        const now = Date.now();
        if (editingCoupon) {
            setCoupons((curr) =>
                curr.map((c) => (c.id === editingCoupon.id ? { ...c, ...data, updatedAt: now } : c))
            );
        } else {
            // Phase 4: True Idempotency Enforcement
            setCoupons((curr) => {
                if (data.idempotencyKey && curr.some(c => c.idempotencyKey === data.idempotencyKey)) {
                    console.log('[App] Idempotent save blocked duplicate:', data.idempotencyKey);
                    return curr;
                }

                const newCoupon: Coupon = {
                    id: generateId(),
                    ...data,
                    status: 'active',
                    createdAt: now,
                    updatedAt: now,
                };
                return [newCoupon, ...curr];
            });
        }
        setView('wallet');
        setEditingCoupon(undefined);
    };

    const handleToggleStatus = (coupon: Coupon) => {
        setCoupons((curr) =>
            curr.map((c) =>
                c.id !== coupon.id
                    ? c
                    : { ...c, status: c.status === 'used' ? 'active' : 'used', updatedAt: Date.now() }
            )
        );
    };

    const handleExport = useCallback(async () => {
        const success = await exportWallet();
        if (!success) Alert.alert('Export Failed', 'Could not export coupons.');
    }, []);

    const handleImport = async () => {
        const content = await importWalletFile();
        if (content) {
            const ok = await importCoupons(content);
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
        await clearCoupons();
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
                onConfirm={() => { setCoupons((curr) => curr.filter((c) => c.id !== deleteId)); setDeleteId(null); }}
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
