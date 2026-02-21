import { useState, useEffect } from 'react';
import type { Coupon } from './lib/types';
import { getCoupons, saveCoupons, clearCoupons, importCoupons } from './lib/storage';
import { BottomNav } from './components/BottomNav';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WalletPage } from './pages/WalletPage';
import { AddEditPage } from './pages/AddEditPage';
import { SettingsPage } from './pages/SettingsPage';

import '../global.css';

type View = 'wallet' | 'add' | 'settings';

function App() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [view, setView] = useState<View>('wallet');
  const [editingCoupon, setEditingCoupon] = useState<Coupon | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  useEffect(() => {
    setCoupons(getCoupons());
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    saveCoupons(coupons);
  }, [coupons, hasHydrated]);

  const handleNavChange = (newView: View) => {
    if (newView === 'add') setEditingCoupon(undefined);
    setView(newView);
  };

  const handleSave = (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const now = Date.now();
    if (editingCoupon) {
      setCoupons(curr => curr.map(c => c.id === editingCoupon.id ? { ...c, ...data, updatedAt: now } : c));
    } else {
      const newCoupon: Coupon = {
        id: crypto.randomUUID(),
        ...data,
        type: data.type || 'coupon',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      setCoupons(curr => [newCoupon, ...curr]);
    }
    setView('wallet');
    setEditingCoupon(undefined);
  };

  const handleToggleStatus = (coupon: Coupon) => {
    setCoupons(curr => curr.map(c => {
      if (c.id !== coupon.id) return c;
      const newStatus = c.status === 'used' ? 'active' : 'used';
      return { ...c, status: newStatus, updatedAt: Date.now() };
    }));
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(coupons, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `coupon-wallet-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    if (importCoupons(text)) {
      setCoupons(getCoupons());
      alert('Import successful!');
    } else {
      alert('Failed to import. Invalid JSON format.');
    }
  };

  const handleClearData = () => {
    clearCoupons();
    setCoupons([]);
    setIsClearDialogOpen(false);
  };

  return (
    <>
      <main className="flex-1 bg-brand-bg pb-20 overflow-y-auto min-h-screen">
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
      </main>

      <BottomNav currentView={view} onChange={handleNavChange} />

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Coupon?"
        message="This action cannot be undone."
        onConfirm={() => { setCoupons(curr => curr.filter(c => c.id !== deleteId)); setDeleteId(null); }}
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
    </>
  );
}

export default App;
