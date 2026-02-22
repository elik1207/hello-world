import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Search, ArrowDownUp, Inbox, Archive, PieChart, Wallet, TrendingDown } from 'lucide-react-native';
import { CouponCard } from '../components/CouponCard';
import type { Coupon, SortOption, ItemType } from '../lib/types';
import { isExpired, formatCurrency } from '../lib/utils';
import { LinearGradient } from 'expo-linear-gradient';

type Tab = 'inbox' | 'active' | 'archive' | 'insights';

interface WalletPageProps {
    coupons: Coupon[];
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void;
}

export function WalletPage({ coupons, onEdit, onDelete, onToggleStatus }: WalletPageProps) {
    const [activeTab, setActiveTab] = useState<Tab>('inbox');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('expiry-asc');

    // Stats
    const totalPotentialValue = useMemo(() => {
        return coupons
            .filter(c => c.status === 'active' && !isExpired(c.expiryDate))
            .reduce((sum, c) => {
                if (c.type === 'gift_card') return sum + (c.remainingValue || c.initialValue || 0);
                if (c.discountType === 'amount') return sum + (c.discountValue || 0);
                return sum;
            }, 0);
    }, [coupons]);

    const valueRealized = useMemo(() => {
        return coupons
            .filter(c => c.status === 'used')
            .reduce((sum, c) => {
                if (c.type === 'gift_card') return sum + ((c.initialValue || 0) - (c.remainingValue || 0));
                if (c.discountType === 'amount') return sum + (c.discountValue || 0);
                return sum;
            }, 0);
    }, [coupons]);

    const valueExpired = useMemo(() => {
        return coupons
            .filter(c => c.status === 'expired' || (c.status === 'active' && isExpired(c.expiryDate)))
            .reduce((sum, c) => {
                if (c.type === 'gift_card') return sum + (c.remainingValue || c.initialValue || 0);
                if (c.discountType === 'amount') return sum + (c.discountValue || 0);
                return sum;
            }, 0);
    }, [coupons]);

    const filteredCoupons = useMemo(() => {
        let filtered = coupons.filter(c => {
            const matchesSearch =
                c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.store || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.category || '').toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchesSearch) return false;

            const isItemExpired = isExpired(c.expiryDate);
            const isGiftCardEmpty = c.type === 'gift_card' && c.remainingValue !== undefined && c.remainingValue <= 0;

            switch (activeTab) {
                case 'inbox':
                    return c.status === 'active' && !isItemExpired && !isGiftCardEmpty;
                case 'active':
                    return c.status === 'active';
                case 'archive':
                    return c.status === 'used' || isItemExpired || isGiftCardEmpty;
                case 'insights':
                    return false; // Handled separately
                default:
                    return true;
            }
        });

        filtered.sort((a, b) => {
            if (sortOption === 'newest') return b.createdAt - a.createdAt;
            if (sortOption === 'oldest') return a.createdAt - b.createdAt;

            const expA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
            const expB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;

            if (sortOption === 'expiry-asc') return expA - expB;
            return expB - expA;
        });

        return filtered;
    }, [coupons, searchTerm, activeTab, sortOption]);

    const cycleSort = () => {
        const order: SortOption[] = ['expiry-asc', 'expiry-desc', 'newest', 'oldest'];
        const idx = order.indexOf(sortOption);
        setSortOption(order[(idx + 1) % order.length]);
    };

    const EmptyState = () => (
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#27305a', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Wallet size={32} color="#6366f1" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 }}>
                {activeTab === 'inbox' ? 'Inbox is empty' : activeTab === 'archive' ? 'No archived items' : 'No items found'}
            </Text>
            <Text style={{ fontSize: 14, color: '#a0aed4', textAlign: 'center', lineHeight: 20 }}>
                {activeTab === 'inbox' ? 'Add some coupons or gift cards to your wallet to get started.' : 'Try adjusting your search criteria.'}
            </Text>
        </View>
    );

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#1a1d38' }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} stickyHeaderIndices={[0]}>
            <View style={{ backgroundColor: '#1a1d38', paddingBottom: 12 }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#f8fafc', marginBottom: 16, letterSpacing: -0.5 }}>
                    Wallet Inbox
                </Text>

                {activeTab !== 'insights' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#27305a', borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: '#3c4270' }}>
                        <Search size={18} color="#a0aed4" />
                        <TextInput
                            style={{ flex: 1, height: 44, color: '#f8fafc', marginLeft: 8 }}
                            placeholder="Search items, stores, categories..."
                            placeholderTextColor="#a0aed4"
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>
                )}

                <View style={{ flexDirection: 'row', backgroundColor: '#27305a', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#3c4270' }}>
                    {[
                        { id: 'inbox', icon: Inbox, label: 'Inbox' },
                        { id: 'active', icon: Wallet, label: 'All' },
                        { id: 'archive', icon: Archive, label: 'Archive' },
                        { id: 'insights', icon: PieChart, label: 'Stats' },
                    ].map(tab => {
                        const active = activeTab === tab.id;
                        const Icon = tab.icon;
                        return (
                            <Pressable
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id as Tab)}
                                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: active ? '#252849' : 'transparent' }}
                            >
                                <Icon size={16} color={active ? '#6366f1' : '#a0aed4'} style={{ marginBottom: 4 }} />
                                <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#6366f1' : '#a0aed4' }}>{tab.label}</Text>
                            </Pressable>
                        )
                    })}
                </View>

                {activeTab !== 'insights' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                        <Pressable onPress={cycleSort} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#27305a', borderRadius: 8, borderWidth: 1, borderColor: '#3c4270' }}>
                            <ArrowDownUp size={12} color="#dde2f4" />
                            <Text style={{ fontSize: 12, color: '#dde2f4', fontWeight: '500' }}>
                                {sortOption === 'expiry-asc' ? 'Expiring Soon' : sortOption === 'expiry-desc' ? 'Expires Last' : sortOption === 'newest' ? 'Newest' : 'Oldest'}
                            </Text>
                        </Pressable>
                    </View>
                )}
            </View>

            {activeTab === 'insights' ? (
                <View style={{ marginTop: 8 }}>
                    <LinearGradient colors={['#6366f1', '#4e48c0']} style={{ borderRadius: 16, padding: 20, marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, color: '#dde2f4', fontWeight: '500', marginBottom: 4 }}>Potential Value</Text>
                        <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>{formatCurrency(totalPotentialValue, 'ILS')}</Text>
                        <Text style={{ fontSize: 12, color: '#a78bfa', marginTop: 4 }}>Active coupons & gift card balances</Text>
                    </LinearGradient>

                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        <View style={{ flex: 1, backgroundColor: '#27305a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#3c4270' }}>
                            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#10b98122', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                <PieChart size={16} color="#10b981" />
                            </View>
                            <Text style={{ fontSize: 12, color: '#a0aed4', marginBottom: 4 }}>Value Realized</Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: '#10b981' }}>{formatCurrency(valueRealized, 'ILS')}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#27305a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#3c4270' }}>
                            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#ef444422', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                <TrendingDown size={16} color="#ef4444" />
                            </View>
                            <Text style={{ fontSize: 12, color: '#a0aed4', marginBottom: 4 }}>Value Expired</Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: '#ef4444' }}>{formatCurrency(valueExpired, 'ILS')}</Text>
                        </View>
                    </View>
                </View>
            ) : filteredCoupons.length === 0 ? (
                <EmptyState />
            ) : (
                <View style={{ marginTop: 8 }}>
                    {filteredCoupons.map(c => (
                        <CouponCard key={c.id} coupon={c} onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} />
                    ))}
                </View>
            )}
        </ScrollView>
    );
}
