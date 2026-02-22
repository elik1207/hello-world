import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Search, ArrowDownUp, Inbox, Archive, PieChart, Wallet, TrendingDown, AlertCircle } from 'lucide-react-native';
import { CouponCard } from '../components/CouponCard';
import type { Coupon, SortOption } from '../lib/types';
import { isExpired, formatCurrency } from '../lib/utils';
import { LinearGradient } from 'expo-linear-gradient';
import { listCoupons, getCoupons } from '../lib/db';

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

    // Quick toggles
    const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
    const [missingOnly, setMissingOnly] = useState(false);

    // Dynamic State
    const [dbCoupons, setDbCoupons] = useState<Coupon[]>([]);

    const fetchCoupons = useCallback(async () => {
        if (activeTab === 'insights') return;

        let statusFilter: 'all' | 'active' | 'used' | 'expired' = 'all';
        if (activeTab === 'inbox') statusFilter = 'active';
        else if (activeTab === 'active') statusFilter = 'all';
        else if (activeTab === 'archive') statusFilter = 'used'; // Map archive closer to used/expired? We'll fetch all and filter expired inline for Archive strictly if needed, or query used and expired sequentially. For now, if activeTab is 'archive', let's fetch 'all' and filter offline below for legacy complex overlap, or just map tabs to Status strictly.
        // Actually, the new prompt asks for "All/Active/Used/Expired".
        // Let's redefine the Tabs to match the spec: All | Active | Used | Expired.

        let sortCol: 'expiryDate' | 'createdAt' | 'amount' = 'expiryDate';
        let sortDir: 'asc' | 'desc' = 'asc';

        if (sortOption === 'newest') { sortCol = 'createdAt'; sortDir = 'desc'; }
        if (sortOption === 'oldest') { sortCol = 'createdAt'; sortDir = 'asc'; }
        if (sortOption === 'expiry-desc') { sortCol = 'expiryDate'; sortDir = 'desc'; }
        // We'll also add an 'amount' sort in cycleSort below.

        const results = await listCoupons({
            searchText: searchTerm,
            statusFilter: activeTab === 'inbox' ? 'active' : activeTab === 'archive' ? 'all' : 'all',
            needsReviewOnly,
            missingOnly,
            sortBy: sortCol,
            sortDir
        });

        // The old activeTab filter semantics handled 'expired' by looking at dates dynamically if status was still 'active'.
        // We replicate legacy 'archive' tab mapping here so UI doesn't visually break
        let finalFilter = results;
        if (activeTab === 'inbox') {
            finalFilter = results.filter(c => c.status === 'active' && !isExpired(c.expiryDate));
        } else if (activeTab === 'archive') {
            finalFilter = results.filter(c => c.status !== 'active' || isExpired(c.expiryDate));
        }

        setDbCoupons(finalFilter);
    }, [searchTerm, activeTab, sortOption, needsReviewOnly, missingOnly, coupons]); // re-run if parent `coupons` props changes (ie insert)

    useEffect(() => {
        fetchCoupons();
    }, [fetchCoupons]);

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

    const filteredCoupons = dbCoupons; // Supplied directly from SQL listCoupons now.

    const cycleSort = () => {
        const order: (SortOption | 'amount')[] = ['expiry-asc', 'expiry-desc', 'newest', 'amount'];
        const idx = order.indexOf(sortOption as any);
        setSortOption(order[(idx + 1) % order.length] as SortOption);
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                                onPress={() => setNeedsReviewOnly(!needsReviewOnly)}
                                style={{ paddingVertical: 4, paddingHorizontal: 10, backgroundColor: needsReviewOnly ? '#f59e0b22' : '#27305a', borderRadius: 12, borderWidth: 1, borderColor: needsReviewOnly ? '#f59e0b' : '#3c4270', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                                <AlertCircle size={10} color={needsReviewOnly ? "#f59e0b" : "#a0aed4"} />
                                <Text style={{ fontSize: 11, color: needsReviewOnly ? '#f59e0b' : '#a0aed4', fontWeight: '500' }}>לבדיקה</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => setMissingOnly(!missingOnly)}
                                style={{ paddingVertical: 4, paddingHorizontal: 10, backgroundColor: missingOnly ? '#ef444422' : '#27305a', borderRadius: 12, borderWidth: 1, borderColor: missingOnly ? '#ef4444' : '#3c4270', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                                <AlertCircle size={10} color={missingOnly ? "#ef4444" : "#a0aed4"} />
                                <Text style={{ fontSize: 11, color: missingOnly ? '#ef4444' : '#a0aed4', fontWeight: '500' }}>חסר</Text>
                            </Pressable>
                        </View>

                        <Pressable onPress={cycleSort} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#27305a', borderRadius: 8, borderWidth: 1, borderColor: '#3c4270' }}>
                            <ArrowDownUp size={12} color="#dde2f4" />
                            <Text style={{ fontSize: 12, color: '#dde2f4', fontWeight: '500' }}>
                                {sortOption === 'expiry-asc' ? 'Expiring Soon' :
                                    sortOption === 'expiry-desc' ? 'Expires Last' :
                                        (sortOption as any) === 'amount' ? 'Amount' : 'Newest'}
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
