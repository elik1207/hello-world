import { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    FlatList,
    SafeAreaView,
} from 'react-native';
import type { Coupon, SortOption } from '../lib/types';
import { isExpired } from '../lib/utils';
import { CouponCard } from '../components/CouponCard';
import { Search, ArrowUpDown } from 'lucide-react-native';

interface WalletPageProps {
    coupons: Coupon[];
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void;
}

type Tab = 'active' | 'used' | 'expired';

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

        result = [...result].sort((a, b) => {
            if (sort === 'expiry_asc') return (a.expiryDate || 'z') < (b.expiryDate || 'z') ? -1 : 1;
            if (sort === 'expiry_desc') return (a.expiryDate || '') > (b.expiryDate || '') ? -1 : 1;
            return b.createdAt - a.createdAt;
        });

        return result;
    }, [coupons, tab, search, sort]);

    const tabs: { id: Tab; label: string }[] = [
        { id: 'active', label: 'Active' },
        { id: 'used', label: 'Used' },
        { id: 'expired', label: 'Expired' },
    ];

    const toggleSort = () => {
        setSort((s) => (s === 'expiry_asc' ? 'expiry_desc' : 'expiry_asc'));
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-100">
                <Text className="text-2xl font-bold text-gray-900 mb-3">My Wallet</Text>

                {/* Search */}
                <View className="flex-row items-center bg-gray-100 rounded-lg px-3 mb-3">
                    <Search size={16} color="#9ca3af" />
                    <TextInput
                        className="flex-1 py-2 px-2 text-gray-900"
                        placeholder="Search coupons..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                {/* Tabs + Sort */}
                <View className="flex-row items-center gap-2">
                    <View className="flex-row flex-1 gap-1">
                        {tabs.map(({ id, label }) => (
                            <Pressable
                                key={id}
                                onPress={() => setTab(id)}
                                className={`flex-1 py-1.5 rounded-lg items-center ${tab === id ? 'bg-blue-600' : 'bg-gray-100'}`}
                            >
                                <Text className={`text-sm font-medium ${tab === id ? 'text-white' : 'text-gray-600'}`}>
                                    {label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                    <Pressable onPress={toggleSort} className="p-2 rounded-lg bg-gray-100">
                        <ArrowUpDown size={16} color="#6b7280" />
                    </Pressable>
                </View>
            </View>

            {/* Coupon List */}
            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                renderItem={({ item }) => (
                    <CouponCard
                        coupon={item}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onToggleStatus={onToggleStatus}
                    />
                )}
                ListEmptyComponent={
                    <View className="items-center py-16">
                        <Text className="text-gray-400 text-base">No {tab} coupons found.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}
