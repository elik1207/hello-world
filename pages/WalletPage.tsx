import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Search, ArrowDownUp, Inbox, Archive, PieChart, Wallet, TrendingDown, AlertCircle, CheckSquare, X, Tag as TagIcon, Trash2, MinusCircle } from 'lucide-react-native';
import { CouponCard } from '../components/CouponCard';
import type { Coupon, SortOption, SavedView, SavedViewPayload } from '../lib/types';
import { isExpired, formatCurrency } from '../lib/utils';
import { LinearGradient } from 'expo-linear-gradient';
import { listCoupons, getCoupons, getAllTags, listSavedViews, createSavedView, deleteSavedView } from '../lib/db';
import { bulkMarkUsed, bulkMarkActive, bulkDeleteCoupons, bulkAddTags, bulkRemoveTags } from '../lib/bulkActions';
import { trackEvent } from '../lib/analytics';

type Tab = 'all' | 'active' | 'used' | 'expired';

interface WalletPageProps {
    coupons: Coupon[];
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void;
}

export function WalletPage({ coupons, onEdit, onDelete, onToggleStatus }: WalletPageProps) {
    const [activeTab, setActiveTab] = useState<Tab>('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('expiry-asc');

    // Bulk Actions Selection
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Quick toggles
    const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
    const [missingOnly, setMissingOnly] = useState(false);

    // Saved Views
    const [savedViews, setSavedViews] = useState<SavedView[]>([]);

    // Tag Filters
    const [allTags, setAllTags] = useState<string[]>([]);
    const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
    const [untaggedOnly, setUntaggedOnly] = useState(false);

    // Dynamic State
    const [dbCoupons, setDbCoupons] = useState<Coupon[]>([]);

    // Throttled Chron Job reference 
    const lastExpireCheck = useRef<number>(0);

    const fetchCoupons = useCallback(async () => {
        // Auto-expire routine (Throttled to run at most once per minute natively)
        const now = Date.now();
        if (now - lastExpireCheck.current > 60000) {
            const { autoExpireCoupons } = await import('../lib/db');
            await autoExpireCoupons();
            lastExpireCheck.current = now;
        }

        const tagsList = await getAllTags();
        setAllTags(tagsList);

        let statusFilter: 'all' | 'active' | 'used' | 'expired' = 'all';
        if (activeTab === 'active') statusFilter = 'active';
        else if (activeTab === 'used') statusFilter = 'used';
        // For 'expired', we fetch 'all' to safely fallback on the JS date check below
        // just in case the throttled auto-expire cron hasn't hit a newly expired item yet.
        else if (activeTab === 'expired') statusFilter = 'all';

        let sortCol: 'expiryDate' | 'createdAt' | 'amount' = 'expiryDate';
        let sortDir: 'asc' | 'desc' = 'asc';

        if (sortOption === 'newest') { sortCol = 'createdAt'; sortDir = 'desc'; }
        if (sortOption === 'oldest') { sortCol = 'createdAt'; sortDir = 'asc'; }
        if (sortOption === 'expiry-desc') { sortCol = 'expiryDate'; sortDir = 'desc'; }

        const results = await listCoupons({
            searchText: searchTerm,
            statusFilter,
            needsReviewOnly,
            missingOnly,
            tagFilter: activeTagFilters,
            untaggedOnly,
            sortBy: sortCol,
            sortDir
        });

        let finalFilter = results;
        if (activeTab === 'active') {
            finalFilter = results.filter(c => c.status === 'active' && !isExpired(c.expiryDate));
        } else if (activeTab === 'used') {
            finalFilter = results.filter(c => c.status === 'used');
        } else if (activeTab === 'expired') {
            finalFilter = results.filter(c => c.status === 'expired' || (c.status === 'active' && isExpired(c.expiryDate)));
        }

        setDbCoupons(finalFilter);
    }, [searchTerm, activeTab, sortOption, needsReviewOnly, missingOnly, activeTagFilters, untaggedOnly, coupons]); // re-run if parent `coupons` props changes (ie insert)

    const fetchViews = useCallback(async () => {
        try {
            const views = await listSavedViews();
            setSavedViews(views);
        } catch (e) { console.error('Error fetching views', e); }
    }, []);

    useEffect(() => {
        fetchCoupons();
    }, [fetchCoupons]);

    useEffect(() => {
        fetchViews();
    }, [fetchViews]);

    const filteredCoupons = dbCoupons; // Supplied directly from SQL listCoupons now.

    const toggleTag = (tag: string) => {
        if (untaggedOnly) setUntaggedOnly(false);
        setActiveTagFilters(curr =>
            curr.includes(tag) ? curr.filter(t => t !== tag) : [...curr, tag]
        );
    };

    const toggleUntagged = () => {
        if (!untaggedOnly) setActiveTagFilters([]); // Clear explicit tags if turning untagged on
        setUntaggedOnly(!untaggedOnly);
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleExitSelection = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    };

    const getSelectedCoupons = (): Coupon[] => filteredCoupons.filter(c => selectedIds.has(c.id));

    const handleBulkStatus = () => {
        if (selectedIds.size === 0) return;
        Alert.alert('Change Status', 'Mark selected items as:', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Active', onPress: async () => {
                    await bulkMarkActive(getSelectedCoupons());
                    await fetchCoupons();
                    handleExitSelection();
                }
            },
            {
                text: 'Used', onPress: async () => {
                    await bulkMarkUsed(getSelectedCoupons());
                    await fetchCoupons();
                    handleExitSelection();
                }
            }
        ]);
    };

    const handleBulkAddTag = () => {
        if (selectedIds.size === 0) return;
        Alert.prompt('Add Tag', 'Enter a tag to add to all selected items:', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Add', onPress: async (tag?: string) => {
                    if (!tag || tag.trim() === '') return;
                    await bulkAddTags(getSelectedCoupons(), tag.trim());
                    await fetchCoupons();
                    handleExitSelection();
                }
            }
        ]);
    };

    const handleBulkRemoveTag = async () => {
        if (selectedIds.size === 0) return;
        const tags = await getAllTags();
        if (tags.length === 0) {
            Alert.alert('No Tags', 'No tags exist to remove.');
            return;
        }
        const buttons = tags.map(tag => ({
            text: tag,
            onPress: async () => {
                await bulkRemoveTags(getSelectedCoupons(), tag);
                await fetchCoupons();
                handleExitSelection();
            }
        }));
        buttons.push({ text: 'Cancel', onPress: async () => { } });
        Alert.alert('Remove Tag', 'Select a tag to remove from selected items:', buttons);
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        Alert.alert('Delete Selected', `Are you sure you want to delete ${selectedIds.size} items?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await bulkDeleteCoupons(getSelectedCoupons());
                    await fetchCoupons();
                    handleExitSelection();
                }
            }
        ]);
    };

    const cycleSort = () => {
        const order: (SortOption | 'amount')[] = ['expiry-asc', 'expiry-desc', 'newest', 'amount'];
        const idx = order.indexOf(sortOption as any);
        setSortOption(order[(idx + 1) % order.length] as SortOption);
    };

    const handleSaveCurrentView = () => {
        Alert.prompt(
            'Save View',
            'Enter a name for this custom view:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Save',
                    onPress: async (name?: string) => {
                        if (!name || name.trim() === '') return;
                        const payload: SavedViewPayload = {
                            searchText: searchTerm,
                            statusTab: activeTab,
                            missingOnly,
                            needsReviewOnly,
                            tagFilter: activeTagFilters,
                            untaggedOnly,
                            sortBy: sortColFromOption(sortOption), // Helper
                            sortDir: sortDirFromOption(sortOption)
                        };
                        await createSavedView(name.trim(), payload);
                        trackEvent('saved_view_created', { hasTags: (activeTagFilters.length > 0 || untaggedOnly) });
                        await fetchViews();
                    }
                }
            ]
        );
    };

    const applySavedView = (view: SavedView) => {
        const p = view.payload;
        setSearchTerm(p.searchText || '');
        setActiveTab(p.statusTab || 'all');
        setMissingOnly(!!p.missingOnly);
        setNeedsReviewOnly(!!p.needsReviewOnly);
        setActiveTagFilters(p.tagFilter || []);
        setUntaggedOnly(!!p.untaggedOnly);
        // Map back to SortOption
        let opt: SortOption = 'expiry-asc';
        if (p.sortBy === 'expiryDate') opt = p.sortDir === 'desc' ? 'expiry-desc' : 'expiry-asc';
        if (p.sortBy === 'createdAt') opt = p.sortDir === 'desc' ? 'newest' : 'oldest';
        if (p.sortBy === 'amount') opt = 'amount' as any;
        setSortOption(opt);
    };

    const sortColFromOption = (opt: SortOption) => opt.startsWith('expiry') ? 'expiryDate' : (opt as any) === 'amount' ? 'amount' : 'createdAt';
    const sortDirFromOption = (opt: SortOption) => opt === 'expiry-desc' || opt === 'newest' ? 'desc' : 'asc';

    const EmptyState = () => (
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#27305a', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Wallet size={32} color="#6366f1" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 }}>
                {activeTab === 'active' ? 'No active items' : activeTab === 'used' ? 'No used items' : activeTab === 'expired' ? 'No expired items' : 'No items found'}
            </Text>
            <Text style={{ fontSize: 14, color: '#a0aed4', textAlign: 'center', lineHeight: 20 }}>
                {activeTab === 'active' ? 'Add some coupons or gift cards to your wallet to get started.' : 'Try adjusting your search criteria.'}
            </Text>
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1, backgroundColor: '#1a1d38' }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} stickyHeaderIndices={[0]}>
                <View style={{ backgroundColor: '#1a1d38', paddingBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5 }}>
                            Wallet
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <Pressable onPress={() => { setIsSelectionMode(!isSelectionMode); if (isSelectionMode) handleExitSelection(); }} hitSlop={8}>
                                <Text style={{ color: isSelectionMode ? '#ef4444' : '#6366f1', fontSize: 13, fontWeight: '600' }}>
                                    {isSelectionMode ? 'Cancel' : 'Select'}
                                </Text>
                            </Pressable>
                            {!isSelectionMode && (
                                <Pressable onPress={handleSaveCurrentView} hitSlop={8}>
                                    <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '600' }}>+ Save View</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>

                    {savedViews.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 16 }}>
                            {savedViews.map(view => (
                                <Pressable
                                    key={view.id}
                                    onPress={() => applySavedView(view)}
                                    onLongPress={() => {
                                        Alert.alert('Delete View', `Delete "${view.name}"?`, [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Delete', style: 'destructive', onPress: async () => {
                                                    await deleteSavedView(view.id);
                                                    await fetchViews();
                                                }
                                            }
                                        ]);
                                    }}
                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#332d80', borderWidth: 1, borderColor: '#4e48c0' }}
                                >
                                    <Text style={{ fontSize: 13, color: '#dde2f4', fontWeight: '500' }}>{view.name}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#27305a', borderRadius: 12, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: '#3c4270' }}>
                        <Search size={18} color="#a0aed4" />
                        <TextInput
                            style={{ flex: 1, height: 44, color: '#f8fafc', marginLeft: 8 }}
                            placeholder="Search items, stores, categories..."
                            placeholderTextColor="#a0aed4"
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>

                    {/* Tag Filters Horizontal Row */}
                    {(allTags.length > 0 || activeTagFilters.length > 0 || untaggedOnly) && (
                        <View style={{ marginBottom: 16 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                <Pressable
                                    onPress={toggleUntagged}
                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: untaggedOnly ? '#6366f1' : '#27305a', borderWidth: 1, borderColor: untaggedOnly ? '#8b5cf6' : '#3c4270' }}
                                >
                                    <Text style={{ fontSize: 13, color: untaggedOnly ? '#fff' : '#a0aed4', fontWeight: '500' }}>ללא תגיות (Untagged)</Text>
                                </Pressable>

                                {allTags.map(tag => {
                                    const active = activeTagFilters.includes(tag);
                                    return (
                                        <Pressable
                                            key={tag}
                                            onPress={() => toggleTag(tag)}
                                            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: active ? '#4e48c0' : '#27305a', borderWidth: 1, borderColor: active ? '#6366f1' : '#3c4270' }}
                                        >
                                            <Text style={{ fontSize: 13, color: active ? '#fff' : '#a0aed4', fontWeight: '500' }}>{tag}</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    <View style={{ flexDirection: 'row', backgroundColor: '#27305a', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#3c4270' }}>
                        {[
                            { id: 'all', icon: Inbox, label: 'All' },
                            { id: 'active', icon: Wallet, label: 'Active' },
                            { id: 'used', icon: Archive, label: 'Used' },
                            { id: 'expired', icon: AlertCircle, label: 'Expired' },
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
                </View>

                {filteredCoupons.length === 0 ? (
                    <EmptyState />
                ) : (
                    <View style={{ marginTop: 8 }}>
                        {filteredCoupons.map((c, i) => (
                            <CouponCard
                                key={`${c.id}-${i}`}
                                coupon={c}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onToggleStatus={onToggleStatus}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedIds.has(c.id)}
                                onToggleSelect={handleToggleSelect}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
            {
                isSelectionMode && (
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 32, paddingTop: 16, paddingHorizontal: 16, backgroundColor: '#1a1d38', borderTopWidth: 1, borderTopColor: '#3c4270', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ color: '#f8fafc', fontWeight: '600' }}>{selectedIds.size} selected</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                            <TouchableOpacity onPress={handleBulkStatus} style={{ alignItems: 'center', opacity: selectedIds.size === 0 ? 0.5 : 1 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#27305a', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                                    <CheckSquare size={20} color="#10b981" />
                                </View>
                                <Text style={{ color: '#dde2f4', fontSize: 11, fontWeight: '500' }}>Status</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleBulkAddTag} style={{ alignItems: 'center', opacity: selectedIds.size === 0 ? 0.5 : 1 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#27305a', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                                    <TagIcon size={20} color="#8b5cf6" />
                                </View>
                                <Text style={{ color: '#dde2f4', fontSize: 11, fontWeight: '500' }}>Add Tag</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleBulkRemoveTag} style={{ alignItems: 'center', opacity: selectedIds.size === 0 ? 0.5 : 1 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#27305a', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                                    <MinusCircle size={20} color="#f59e0b" />
                                </View>
                                <Text style={{ color: '#dde2f4', fontSize: 11, fontWeight: '500' }}>הסר תגית</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleBulkDelete} style={{ alignItems: 'center', opacity: selectedIds.size === 0 ? 0.5 : 1 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#27305a', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                                    <Trash2 size={20} color="#ef4444" />
                                </View>
                                <Text style={{ color: '#dde2f4', fontSize: 11, fontWeight: '500' }}>Delete</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                )
            }
        </View >
    );
}
