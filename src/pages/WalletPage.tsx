import { useState, useMemo } from 'react';
import type { Coupon, SortOption } from '../lib/types';
import { isExpired, getDaysUntilExpiry } from '../lib/utils';
import { CouponCard } from '../components/CouponCard';
import { Search, ArrowUpDown, Inbox, Archive, PieChart, Wallet, TrendingDown } from 'lucide-react';

interface WalletPageProps {
    coupons: Coupon[];
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void;
}

type Tab = 'inbox' | 'archive' | 'insights';

export function WalletPage({ coupons, onEdit, onDelete, onToggleStatus }: WalletPageProps) {
    const [activeTab, setActiveTab] = useState<Tab>('inbox');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('expiry-asc');

    const insights = useMemo(() => {
        let trappedValue = 0;
        let lostValue = 0;

        coupons.forEach(c => {
            const expired = isExpired(c.expiryDate);
            const isGiftCard = c.type === 'gift_card';
            const val = isGiftCard
                ? (c.remainingValue ?? c.initialValue ?? 0)
                : (c.discountType === 'amount' ? (c.discountValue || 0) : 0);

            if (c.status === 'used') {
                // Not counted as trapped or lost - successfully used
            } else if (expired) {
                lostValue += val;
            } else {
                trappedValue += val;
            }
        });

        return { trappedValue, lostValue };
    }, [coupons]);

    const filteredCoupons = useMemo(() => {
        return coupons.filter(c => {
            // 1. Status Filter
            const expired = isExpired(c.expiryDate);
            const isArchive = c.status === 'used' || expired || (c.type === 'gift_card' && c.remainingValue !== undefined && c.remainingValue <= 0);

            if (activeTab === 'inbox' && isArchive) return false;
            if (activeTab === 'archive' && !isArchive) return false;

            // 2. Search Filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    c.title.toLowerCase().includes(term) ||
                    (c.store?.toLowerCase() || '').includes(term) ||
                    (c.category?.toLowerCase() || '').includes(term)
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

    const renderInsights = () => (
        <div className="space-y-6 pt-2">
            <div className="bg-brand-surface p-6 rounded-2xl shadow-sm border border-brand-border flex flex-col items-center text-center">
                <span className="text-text-muted font-medium mb-2 flex items-center gap-2 uppercase tracking-widest text-xs"><Wallet size={16} className="text-brand-primary" /> Trapped Value</span>
                <span className="text-5xl font-extrabold text-blue-400 tracking-tight">₪{insights.trappedValue.toFixed(2)}</span>
                <p className="text-sm text-text-muted mt-4 leading-relaxed">Total usable value trapped in active gift cards & amount vouchers.</p>
            </div>

            <div className="bg-brand-surface p-6 rounded-2xl shadow-sm border border-brand-border flex flex-col items-center text-center">
                <span className="text-text-muted font-medium mb-2 flex items-center gap-2 uppercase tracking-widest text-xs"><TrendingDown size={16} className="text-status-expired" /> Lost Value</span>
                <span className="text-5xl font-extrabold text-red-400 tracking-tight">₪{insights.lostValue.toFixed(2)}</span>
                <p className="text-sm text-text-muted mt-4 leading-relaxed">Total value lost from expired items.</p>
            </div>
        </div>
    );

    const renderInboxGroups = () => {
        const urgent: Coupon[] = [];
        const thisMonth: Coupon[] = [];
        const safe: Coupon[] = [];

        filteredCoupons.forEach(c => {
            const days = getDaysUntilExpiry(c.expiryDate);
            if (days !== null && days <= 7) urgent.push(c);
            else if (days !== null && days <= 30) thisMonth.push(c);
            else safe.push(c);
        });

        return (
            <div className="space-y-8">
                {urgent.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                            <span className="text-lg">🔥</span> Expiring Soon
                        </h2>
                        <div className="space-y-4">
                            {urgent.map(c => <CouponCard key={c.id} coupon={c} onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} />)}
                        </div>
                    </div>
                )}
                {thisMonth.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold text-orange-600 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                            <span className="text-lg">⏳</span> This Month
                        </h2>
                        <div className="space-y-4">
                            {thisMonth.map(c => <CouponCard key={c.id} coupon={c} onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} />)}
                        </div>
                    </div>
                )}
                {safe.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                            <span className="text-lg">🟢</span> Safe / Distant
                        </h2>
                        <div className="space-y-4">
                            {safe.map(c => <CouponCard key={c.id} coupon={c} onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} />)}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="pb-24 pt-4 px-4 max-w-md mx-auto bg-brand-bg">
            {/* Header with Search */}
            <div className="sticky top-0 bg-brand-bg pt-2 pb-4 z-10 space-y-4 border-b border-brand-border">
                <style>{`
                    /* Hide scrollbar for aesthetics */
                    ::-webkit-scrollbar { display: none; }
                `}</style>

                <h1 className="text-2xl font-bold text-text-primary tracking-tight">Wallet Inbox</h1>

                {activeTab !== 'insights' && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Search items, stores, categories..."
                            className="w-full pl-10 pr-4 py-2.5 bg-brand-surface border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary shadow-sm text-text-primary placeholder-text-muted"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}

                {/* Tabs */}
                <div className="flex p-1 bg-brand-surface rounded-xl border border-brand-border">
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'inbox' ? 'bg-brand-card text-brand-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        <Inbox size={16} />
                        Inbox
                    </button>
                    <button
                        onClick={() => setActiveTab('archive')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'archive' ? 'bg-brand-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        <Archive size={16} />
                        Archive
                    </button>
                    <button
                        onClick={() => setActiveTab('insights')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'insights' ? 'bg-brand-card text-brand-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        <PieChart size={16} />
                        Insights
                    </button>
                </div>

                {/* Sort (Only really useful in Archive or within Safe now, but we keep it) */}
                {activeTab !== 'insights' && (
                    <div className="flex justify-end pt-1">
                        <button
                            onClick={() => setSortOption(curr =>
                                curr === 'expiry-asc' ? 'newest' :
                                    curr === 'newest' ? 'expiry-desc' : 'expiry-asc'
                            )}
                            className="flex items-center gap-1.5 text-xs text-brand-primary font-semibold bg-brand-surface border border-brand-border px-2.5 py-1.5 rounded-md hover:bg-brand-card transition-colors"
                        >
                            <ArrowUpDown size={12} />
                            {sortOption === 'expiry-asc' ? 'Expiring Soon' :
                                sortOption === 'newest' ? 'Newest' : 'Expiring Late'}
                        </button>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="pt-4">
                {activeTab === 'insights' ? renderInsights() :
                    filteredCoupons.length === 0 ? (
                        <div className="text-center py-16 text-text-muted flex flex-col items-center">
                            {activeTab === 'inbox' ? (
                                <>
                                    <Inbox className="w-12 h-12 text-brand-border mb-4" />
                                    <p className="text-text-secondary font-medium">Your inbox is clear.</p>
                                    <p className="text-sm mt-1">No active vouchers to use right now.</p>
                                </>
                            ) : (
                                <>
                                    <Archive className="w-12 h-12 text-brand-border mb-4" />
                                    <p className="text-text-secondary font-medium">Archive empty.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        activeTab === 'inbox' ? renderInboxGroups() : (
                            <div className="space-y-4">
                                {filteredCoupons.map(coupon => (
                                    <CouponCard
                                        key={coupon.id}
                                        coupon={coupon}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                        onToggleStatus={onToggleStatus}
                                    />
                                ))}
                            </div>
                        )
                    )}
            </div>
        </div>
    );
}
