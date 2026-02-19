import { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import type { Coupon } from './lib/types';
import { getCoupons, saveCoupons, clearCoupons, importCoupons } from './lib/storage';
import { BottomNav } from './components/BottomNav';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WalletPage } from './pages/WalletPage';
import { AddEditPage } from './pages/AddEditPage';
import { SettingsPage } from './pages/SettingsPage';

import './global.css';

type View = 'wallet' | 'add' | 'settings';

export default function App() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [view, setView] = useState<View>('wallet');
    const [editingCoupon, setEditingCoupon] = useState<Coupon | undefined>(undefined);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

    // Load coupons on mount (AsyncStorage is async)
    useEffect(() => {
        getCoupons().then(setCoupons);
    }, []);

    // Save coupons whenever they change
    useEffect(() => {
        saveCoupons(coupons);
    }, [coupons]);

    const handleNavChange = (newView: View) => {
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
            const newCoupon: Coupon = {
                id: Math.random().toString(36).slice(2),
                ...data,
                status: 'active',
                createdAt: now,
                updatedAt: now,
            };
            setCoupons((curr) => [newCoupon, ...curr]);
        }
        setView('wallet');
        setEditingCoupon(undefined);
    };

    const handleToggleStatus = (coupon: Coupon) => {
        setCoupons((curr) =>
            curr.map((c) => {
                if (c.id !== coupon.id) return c;
                return { ...c, status: c.status === 'used' ? 'active' : 'used', updatedAt: Date.now() };
            })
        );
    };

    const handleExport = useCallback(async () => {
        try {
            const json = JSON.stringify(coupons, null, 2);
            const filename = `coupon-wallet-${new Date().toISOString().split('T')[0]}.json`;
            const fileUri = (FileSystem.cacheDirectory ?? '') + filename;
            await FileSystem.writeAsStringAsync(fileUri, json);
            await Sharing.shareAsync(fileUri, { mimeType: 'application/json' });
        } catch {
            Alert.alert('Export Failed', 'Could not export coupons.');
        }
    }, [coupons]);

    const handleImport = async (content: string) => {
        const ok = await importCoupons(content);
        if (ok) {
            const updated = await getCoupons();
            setCoupons(updated);
            Alert.alert('Success', 'Coupons imported successfully!');
        } else {
            Alert.alert('Import Failed', 'Invalid JSON format.');
        }
    };

    const handleClearData = async () => {
        await clearCoupons();
        setCoupons([]);
        setIsClearDialogOpen(false);
    };

    return (
        <View className="flex-1 bg-gray-50">
            <StatusBar style="dark" />

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
