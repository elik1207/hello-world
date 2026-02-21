import { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    FlatList,
    SafeAreaView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { Coupon, SortOption } from '../lib/types';
import { isExpired } from '../lib/utils';
import { CouponCard } from '../components/CouponCard';
import { Search, ArrowUpDown, Tag } from 'lucide-react-native';

interface WalletPageProps {
    coupons: Coupon[];
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void;
}

type Tab = 'active' | 'used' | 'expired';

const TABS: { id: Tab; label: string; color: string }[] = [
    { id: 'active', label: 'Active', color: '#10b981' },
    { id: 'used', label: 'Used', color: '#6366f1' },
    { id: 'expired', label: 'Expired', color: '#ef4444' },
];

export function WalletPage({ coupons, onEdit, onDelete, onToggleStatus }: WalletPageProps) {
    const [tab, setTab] = useState<Tab>('active');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('expiry_asc');

    const filtered = useMemo(() => {
        let result = coupons.filter((c) => {
            const exp = isExpired(c.expiryDate);
            if (tab === 'active') return c.status === 'active' && !exp;
            if (tab === 'used') return c.status === 'used';
            if (tab === 'expired') return exp && c.status !== 'used';
            return true;
        });
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (c) =>
                    c.title.toLowerCase().includes(q) ||
                    c.store.toLowerCase().includes(q) ||
                    c.category.toLowerCase().includes(q)
            );
        }
        return [...result].sort((a, b) => {
            if (sort === 'expiry_asc') return (a.expiryDate || 'z') < (b.expiryDate || 'z') ? -1 : 1;
            if (sort === 'expiry_desc') return (a.expiryDate || '') > (b.expiryDate || '') ? -1 : 1;
            return b.createdAt - a.createdAt;
        });
    }, [coupons, tab, search, sort]);

    const activeCount = coupons.filter((c) => c.status === 'active' && !isExpired(c.expiryDate)).length;

    return (
        <View style={{ flex: 1, backgroundColor: '#1a1d38' }}>
            {/* Header */}
            <LinearGradient
                colors={['#332d80', '#1a1d38']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ paddingBottom: 16 }}
            >
                <SafeAreaView>
                    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <View>
                                <Text style={{ fontSize: 28, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5 }}>
                                    My Wallet
                                </Text>
                                <Text style={{ fontSize: 13, color: '#6366f1', fontWeight: '500', marginTop: 2 }}>
                                    {activeCount} active coupon{activeCount !== 1 ? 's' : ''}
                                </Text>
                            </View>
                            <LinearGradient
                                colors={['#4e48c0', '#332d80']}
                                style={{ borderRadius: 16, padding: 10 }}
                            >
                                <Tag size={20} color="#a78bfa" />
                            </LinearGradient>
                        </View>
                    </View>
                </SafeAreaView>

                {/* Search bar */}
                <View style={{ marginHorizontal: 20, marginTop: 12 }}>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#27305a',
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            borderWidth: 1,
                            borderColor: '#3c4270',
                        }}
                    >
                        <Search size={16} color="#a0aed4" />
                        <TextInput
                            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: '#f8fafc', fontSize: 14 }}
                            placeholder="Search coupons..."
                            placeholderTextColor="#a0aed4"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                </View>

                {/* Tab + Sort row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12 }}>
                    <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                        {TABS.map(({ id, label, color }) => {
                            const active = tab === id;
                            return (
                                <Pressable
                                    key={id}
                                    onPress={() => setTab(id)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 8,
                                        borderRadius: 10,
                                        alignItems: 'center',
                                        backgroundColor: active ? color + '22' : '#27305a',
                                        borderWidth: 1,
                                        borderColor: active ? color + '66' : '#3c4270',
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: '600',
                                            color: active ? color : '#a0aed4',
                                        }}
                                    >
                                        {label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <Pressable
                        onPress={() => setSort((s) => (s === 'expiry_asc' ? 'expiry_desc' : 'expiry_asc'))}
                        style={{
                            padding: 8,
                            borderRadius: 10,
                            backgroundColor: '#27305a',
                            borderWidth: 1,
                            borderColor: '#3c4270',
                        }}
                    >
                        <ArrowUpDown size={16} color="#6366f1" />
                    </Pressable>
                </View>
            </LinearGradient>

            {/* Coupons */}
            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                renderItem={({ item, index }) => (
                    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
                        <CouponCard
                            coupon={item}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggleStatus={onToggleStatus}
                        />
                    </Animated.View>
                )}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingVertical: 80 }}>
                        <LinearGradient
                            colors={['#332d80', '#27305a']}
                            style={{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
                        >
                            <Tag size={36} color="#6366f1" strokeWidth={1.5} />
                        </LinearGradient>
                        <Text style={{ color: '#dde2f4', fontSize: 16, fontWeight: '600' }}>No {tab} coupons</Text>
                        <Text style={{ color: '#a0aed4', fontSize: 13, marginTop: 4 }}>
                            {tab === 'active' ? 'Tap Add to save your first coupon' : `No ${tab} coupons found`}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}
