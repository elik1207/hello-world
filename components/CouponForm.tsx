import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Coupon, DiscountType, ItemType } from '../lib/types';

interface CouponFormProps {
    initialData?: Coupon;
    onSave: (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
    onCancel: () => void;
    onToggleStatus?: (coupon: Coupon) => void;
}

export function CouponForm({ initialData, onSave, onCancel, onToggleStatus }: CouponFormProps) {
    const defaultType: ItemType = 'coupon';
    const [type, setType] = useState<ItemType>(initialData?.type || defaultType);
    const [title, setTitle] = useState(initialData?.title ?? '');
    const [description, setDescription] = useState(initialData?.description ?? '');
    const [discountType, setDiscountType] = useState<DiscountType>(initialData?.discountType ?? 'amount');
    const [discountValue, setDiscountValue] = useState(initialData?.discountValue ? String(initialData.discountValue) : '');
    const [initialValue, setInitialValue] = useState(initialData?.initialValue ? String(initialData.initialValue) : '');
    const [remainingValue, setRemainingValue] = useState(initialData?.remainingValue ? String(initialData.remainingValue) : '');
    const [currency, setCurrency] = useState(initialData?.currency ?? 'ILS');
    const [expiryDate, setExpiryDate] = useState(initialData?.expiryDate ?? '');
    const [store, setStore] = useState(initialData?.store ?? '');
    const [category, setCategory] = useState(initialData?.category ?? '');
    const [code, setCode] = useState(initialData?.code ?? '');
    const [sender, setSender] = useState(initialData?.sender ?? '');
    const [event, setEvent] = useState(initialData?.event ?? '');
    const [imageUrl, setImageUrl] = useState(initialData?.imageUrl ?? '');
    const [barcodeData, setBarcodeData] = useState(initialData?.barcodeData ?? '');
    const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
    const [tagInput, setTagInput] = useState('');

    const handleAddTag = () => {
        const { validateTag } = require('../lib/tags');
        const validated = validateTag(tagInput);
        if (validated.valid && validated.normalized) {
            if (tags.length >= 8) {
                Alert.alert('Limit Reached', 'Maximum 8 tags allowed');
                return;
            }
            if (!tags.includes(validated.normalized)) {
                setTags([...tags, validated.normalized]);
            }
            setTagInput('');
        } else if (validated.error && tagInput.trim().length > 0) {
            Alert.alert('Invalid Tag', validated.error);
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSubmit = () => {
        if (!title.trim()) { Alert.alert('Validation', 'Title is required'); return; }

        let finalDiscountValue;
        let finalInitialValue;
        let finalRemainingValue;

        if (type === 'gift_card') {
            const initial = Number(initialValue);
            if (!initialValue || isNaN(initial) || initial <= 0) {
                Alert.alert('Validation', 'Initial amount is required and must be > 0'); return;
            }
            finalInitialValue = initial;
            const remaining = remainingValue ? Number(remainingValue) : initial;
            if (isNaN(remaining) || remaining < 0 || remaining > initial) {
                Alert.alert('Validation', 'Remaining balance must be valid and <= initial amount'); return;
            }
            finalRemainingValue = remaining;
        } else {
            const val = Number(discountValue);
            if (!discountValue || isNaN(val) || val <= 0) { Alert.alert('Validation', 'Value must be greater than 0'); return; }
            if (discountType === 'percent' && val > 100) { Alert.alert('Validation', 'Percentage cannot exceed 100'); return; }
            finalDiscountValue = val;
        }

        onSave({
            type, title, description, discountType, discountValue: finalDiscountValue,
            initialValue: finalInitialValue, remainingValue: finalRemainingValue,
            currency, expiryDate, store, category, code, sender, event, imageUrl, barcodeData,
            tags
        });
    };

    const inputStyle = { backgroundColor: '#27305a', borderWidth: 1, borderColor: '#3c4270', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#f8fafc', fontSize: 15 };
    const labelStyle = { fontSize: 12, fontWeight: '600' as const, color: '#dde2f4', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' as const };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#1a1d38' }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

            {/* Type Selector */}
            <View style={{ flexDirection: 'row', backgroundColor: '#27305a', borderRadius: 14, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: '#3c4270' }}>
                {(['coupon', 'gift_card', 'voucher'] as ItemType[]).map((t) => {
                    const active = type === t;
                    return (
                        <Pressable key={t} onPress={() => setType(t)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: active ? '#252849' : 'transparent', borderRadius: 10 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#6366f1' : '#a0aed4', textTransform: 'capitalize' }}>{t.replace('_', ' ')}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Title */}
            <View style={{ marginBottom: 20 }}>
                <Text style={labelStyle}>Title *</Text>
                <TextInput style={inputStyle} placeholder={type === 'gift_card' ? "e.g. Fox Home Birthday Card" : "e.g. 50₪ off at Super-Pharm"} placeholderTextColor="#a0aed4" value={title} onChangeText={setTitle} />
            </View>

            {/* Values */}
            {type === 'gift_card' ? (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={labelStyle}>Initial Value *</Text>
                        <TextInput style={inputStyle} placeholder="0" placeholderTextColor="#a0aed4" value={initialValue} onChangeText={setInitialValue} keyboardType="decimal-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={labelStyle}>Remaining Balance</Text>
                        <TextInput style={inputStyle} placeholder={initialValue || "0"} placeholderTextColor="#a0aed4" value={remainingValue} onChangeText={setRemainingValue} keyboardType="decimal-pad" />
                    </View>
                </View>
            ) : (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={labelStyle}>Type</Text>
                        <View style={{ flexDirection: 'row', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#3c4270' }}>
                            {(['amount', 'percent'] as DiscountType[]).map((t) => {
                                const active = discountType === t;
                                return (
                                    <Pressable key={t} onPress={() => setDiscountType(t)} style={{ flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: active ? '#6366f1' : '#27305a' }}>
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : '#a0aed4' }}>{t === 'amount' ? 'Amount' : 'Percent'}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={labelStyle}>Value *</Text>
                        <TextInput style={inputStyle} placeholder="0" placeholderTextColor="#a0aed4" value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" />
                    </View>
                </View>
            )}

            {/* Currency */}
            {(type === 'gift_card' || discountType === 'amount') && (
                <View style={{ marginBottom: 20 }}>
                    <Text style={labelStyle}>Currency</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {['ILS', 'USD', 'EUR', 'GBP'].map((c) => {
                            const active = currency === c;
                            return (
                                <Pressable key={c} onPress={() => setCurrency(c)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: active ? '#6366f1' : '#3c4270', backgroundColor: active ? '#4e48c0' : '#27305a' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#a78bfa' : '#a0aed4' }}>{c}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Store & Category */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Store</Text>
                    <TextInput style={inputStyle} placeholder="e.g. Fox" placeholderTextColor="#a0aed4" value={store} onChangeText={setStore} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Category</Text>
                    <TextInput style={inputStyle} placeholder="e.g. Food" placeholderTextColor="#a0aed4" value={category} onChangeText={setCategory} />
                </View>
            </View>

            {/* Tags */}
            <View style={{ marginBottom: 20 }}>
                <Text style={labelStyle}>Tags (Max 8)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#27305a', borderWidth: 1, borderColor: '#3c4270', borderRadius: 14, paddingRight: 4 }}>
                    <TextInput
                        style={[inputStyle, { flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]}
                        placeholder="e.g. birthday, online..."
                        placeholderTextColor="#a0aed4"
                        value={tagInput}
                        onChangeText={setTagInput}
                        onSubmitEditing={handleAddTag}
                        blurOnSubmit={false}
                        returnKeyType="done"
                    />
                    <Pressable onPress={handleAddTag} style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#6366f1', borderRadius: 10, marginRight: 2 }}>
                        <Text style={{ fontWeight: '600', color: '#fff' }}>Add</Text>
                    </Pressable>
                </View>
                {tags.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                        {tags.map((tag, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#332d80', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#4e48c0' }}>
                                <Text style={{ fontSize: 13, color: '#dde2f4', fontWeight: '500', marginRight: 6 }}>{tag}</Text>
                                <Pressable onPress={() => handleRemoveTag(tag)} hitSlop={8}>
                                    <Text style={{ color: '#a78bfa', fontSize: 14, fontWeight: '700' }}>×</Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Gift Sender & Event */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>From / Sender</Text>
                    <TextInput style={inputStyle} placeholder="e.g. Mom & Dad" placeholderTextColor="#a0aed4" value={sender} onChangeText={setSender} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Occasion</Text>
                    <TextInput style={inputStyle} placeholder="e.g. Birthday" placeholderTextColor="#a0aed4" value={event} onChangeText={setEvent} />
                </View>
            </View>

            {/* Expiry & Code */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Expiry (YYYY-MM-DD)</Text>
                    <TextInput style={inputStyle} placeholder="2025-12-31" placeholderTextColor="#a0aed4" value={expiryDate} onChangeText={setExpiryDate} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Coupon/PIN</Text>
                    <TextInput style={inputStyle} placeholder="e.g. SAVE20" placeholderTextColor="#a0aed4" value={code} onChangeText={setCode} />
                </View>
            </View>

            {/* Barcode & Image */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Barcode Data</Text>
                    <TextInput style={inputStyle} placeholder="e.g. 123456789" placeholderTextColor="#a0aed4" value={barcodeData} onChangeText={setBarcodeData} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Image URL</Text>
                    <TextInput style={inputStyle} placeholder="https://..." placeholderTextColor="#a0aed4" value={imageUrl} onChangeText={setImageUrl} />
                </View>
            </View>

            {/* Description */}
            <View style={{ marginBottom: 28 }}>
                <Text style={labelStyle}>Notes</Text>
                <TextInput style={[inputStyle, { height: 90, textAlignVertical: 'top' }]} placeholder="Terms & conditions, notes..." placeholderTextColor="#a0aed4" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
            </View>

            {/* Status Toggle UX for existing items */}
            {initialData && onToggleStatus && (
                <View style={{ marginBottom: 20 }}>
                    <Text style={labelStyle}>Status Management</Text>
                    <Pressable
                        onPress={() => onToggleStatus(initialData)}
                        style={({ pressed }) => ({
                            backgroundColor: initialData.status === 'used' ? '#1a1d38' : '#332d80',
                            borderWidth: 1,
                            borderColor: initialData.status === 'used' ? '#6366f1' : '#3c4270',
                            borderRadius: 14,
                            padding: 16,
                            alignItems: 'center',
                            opacity: pressed ? 0.8 : 1
                        })}
                    >
                        <Text style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: initialData.status === 'used' ? '#6366f1' : '#dde2f4'
                        }}>
                            {initialData.status === 'used' ? 'Mark as Active (Undo)' : 'Mark as Used'}
                        </Text>
                    </Pressable>
                </View>
            )}

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={onCancel} style={({ pressed }) => ({ flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: pressed ? '#3c4270' : '#27305a', borderWidth: 1, borderColor: '#3c4270' })}>
                    <Text style={{ fontWeight: '600', color: '#dde2f4', fontSize: 15 }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSubmit} style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                        <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Save Item</Text>
                    </LinearGradient>
                </Pressable>
            </View>
        </ScrollView>
    );
}
