import { useState, useMemo } from 'react';
import type { Coupon, SortOption } from '../lib/types';
import { isExpired } from '../lib/utils';
import { CouponCard } from '../components/CouponCard';
import { Search, ArrowUpDown } from 'lucide-react';

interface WalletPageProps {
    coupons: Coupon[];
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void;
}

type Tab = 'active' | 'used' | 'expired';

export function WalletPage({ coupons, onEdit, onDelete, onToggleStatus }: WalletPageProps) {
    const [activeTab, setActiveTab] = useState<Tab>('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('expiry-asc');

    const filteredCoupons = useMemo(() => {
        return coupons.filter(c => {
            // 1. Status Filter
            const expired = isExpired(c.expiryDate);
            if (activeTab === 'active' && (c.status === 'used' || expired)) return false;
            if (activeTab === 'used' && c.status !== 'used') return false;
            if (activeTab === 'expired' && (c.status === 'used' || !expired)) return false;

            // 2. Search Filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    c.title.toLowerCase().includes(term) ||
                    c.store?.toLowerCase().includes(term) ||
                    c.category?.toLowerCase().includes(term)
                );
            }

            return true;
        }).sort((a, b) => {
            // 3. Sorting
            if (sortOption === 'newest') return b.createdAt - a.createdAt;
            if (sortOption === 'oldest') return a.createdAt - b.createdAt;

            // Expiry sorting
            const aExpiry = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
            const bExpiry = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;

            if (sortOption === 'expiry-asc') return aExpiry - bExpiry;
            if (sortOption === 'expiry-desc') return bExpiry - aExpiry;

            return 0;
        });
    }, [coupons, activeTab, searchTerm, sortOption]);

    return (
        <div className="pb-24 pt-4 px-4 max-w-md mx-auto min-h-screen bg-gray-50">
            {/* Header with Search */}
            <div className="sticky top-0 bg-gray-50 pt-2 pb-4 z-10 space-y-3">
                <h1 className="text-2xl font-bold text-gray-900">My Wallet</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search coupons..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-gray-200 rounded-lg">
                    {(['active', 'used', 'expired'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Sort */}
                <div className="flex justify-end">
                    <button
                        onClick={() => setSortOption(curr =>
                            curr === 'expiry-asc' ? 'newest' :
                                curr === 'newest' ? 'expiry-desc' : 'expiry-asc' // Simple cycle for MVP
                        )}
                        className="flex items-center gap-1 text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded"
                    >
                        <ArrowUpDown size={12} />
                        {sortOption === 'expiry-asc' ? 'Expiring Soon' :
                            sortOption === 'newest' ? 'Newest' : 'Expiring Late'}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                {filteredCoupons.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p>No {activeTab} coupons found.</p>
                    </div>
                ) : (
                    filteredCoupons.map(coupon => (
                        <CouponCard
                            key={coupon.id}
                            coupon={coupon}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggleStatus={onToggleStatus}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
