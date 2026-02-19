import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    Alert,
} from 'react-native';
import type { Coupon, DiscountType } from '../lib/types';

interface CouponFormProps {
    initialData?: Coupon;
    onSave: (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
    onCancel: () => void;
}

export function CouponForm({ initialData, onSave, onCancel }: CouponFormProps) {
    const [title, setTitle] = useState(initialData?.title ?? '');
    const [description, setDescription] = useState(initialData?.description ?? '');
    const [discountType, setDiscountType] = useState<DiscountType>(initialData?.discountType ?? 'amount');
    const [discountValue, setDiscountValue] = useState(
        initialData?.discountValue ? String(initialData.discountValue) : ''
    );
    const [currency, setCurrency] = useState(initialData?.currency ?? 'ILS');
    const [expiryDate, setExpiryDate] = useState(initialData?.expiryDate ?? '');
    const [store, setStore] = useState(initialData?.store ?? '');
    const [category, setCategory] = useState(initialData?.category ?? '');
    const [code, setCode] = useState(initialData?.code ?? '');

    const handleSubmit = () => {
        if (!title.trim()) {
            Alert.alert('Validation', 'Title is required');
            return;
        }
        const val = Number(discountValue);
        if (!discountValue || isNaN(val) || val <= 0) {
            Alert.alert('Validation', 'Value must be greater than 0');
            return;
        }
        if (discountType === 'percent' && val > 100) {
            Alert.alert('Validation', 'Percentage cannot exceed 100');
            return;
        }
        onSave({ title, description, discountType, discountValue: val, currency, expiryDate, store, category, code });
    };

    const inputClass = 'w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 bg-white';
    const labelClass = 'text-sm font-medium text-gray-700 mb-1';

    return (
        <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
            <View className="gap-4 pb-8">
                {/* Title */}
                <View>
                    <Text className={labelClass}>Title *</Text>
                    <TextInput
                        className={inputClass}
                        placeholder="e.g. 50₪ off at Super-Pharm"
                        value={title}
                        onChangeText={setTitle}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                {/* Type + Value */}
                <View className="flex-row gap-3">
                    <View className="flex-1">
                        <Text className={labelClass}>Type</Text>
                        <View className="flex-row rounded-lg border border-gray-300 overflow-hidden">
                            {(['amount', 'percent'] as DiscountType[]).map((t) => (
                                <Pressable
                                    key={t}
                                    onPress={() => setDiscountType(t)}
                                    className={`flex-1 py-3 items-center ${discountType === t ? 'bg-blue-600' : 'bg-white'}`}
                                >
                                    <Text className={`text-sm font-medium ${discountType === t ? 'text-white' : 'text-gray-700'}`}>
                                        {t === 'amount' ? 'Amount' : 'Percent'}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                    <View className="flex-1">
                        <Text className={labelClass}>Value *</Text>
                        <TextInput
                            className={inputClass}
                            placeholder="0"
                            value={discountValue}
                            onChangeText={setDiscountValue}
                            keyboardType="decimal-pad"
                            placeholderTextColor="#9ca3af"
                        />
                    </View>
                </View>

                {/* Currency (only for amount type) */}
                {discountType === 'amount' && (
                    <View>
                        <Text className={labelClass}>Currency</Text>
                        <View className="flex-row gap-2">
                            {['ILS', 'USD', 'EUR', 'GBP'].map((c) => (
                                <Pressable
                                    key={c}
                                    onPress={() => setCurrency(c)}
                                    className={`px-3 py-2 rounded-lg border ${currency === c ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}
                                >
                                    <Text className={`text-sm font-medium ${currency === c ? 'text-white' : 'text-gray-700'}`}>{c}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}

                {/* Store + Category */}
                <View className="flex-row gap-3">
                    <View className="flex-1">
                        <Text className={labelClass}>Store</Text>
                        <TextInput className={inputClass} placeholder="e.g. Fox" value={store} onChangeText={setStore} placeholderTextColor="#9ca3af" />
                    </View>
                    <View className="flex-1">
                        <Text className={labelClass}>Category</Text>
                        <TextInput className={inputClass} placeholder="e.g. Food" value={category} onChangeText={setCategory} placeholderTextColor="#9ca3af" />
                    </View>
                </View>

                {/* Expiry Date */}
                <View>
                    <Text className={labelClass}>Expiry Date (YYYY-MM-DD)</Text>
                    <TextInput
                        className={inputClass}
                        placeholder="2025-12-31"
                        value={expiryDate}
                        onChangeText={setExpiryDate}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                {/* Code */}
                <View>
                    <Text className={labelClass}>Code / Barcode</Text>
                    <TextInput
                        className={inputClass}
                        placeholder="Promo Code"
                        value={code}
                        onChangeText={setCode}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                {/* Description */}
                <View>
                    <Text className={labelClass}>Description</Text>
                    <TextInput
                        className={inputClass}
                        placeholder="Terms & conditions, notes..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        style={{ height: 80, textAlignVertical: 'top' }}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                {/* Buttons */}
                <View className="flex-row gap-3 pt-2 border-t border-gray-100">
                    <Pressable
                        onPress={onCancel}
                        className="flex-1 py-3 rounded-lg bg-gray-100 items-center active:bg-gray-200"
                    >
                        <Text className="font-medium text-gray-700">Cancel</Text>
                    </Pressable>
                    <Pressable
                        onPress={handleSubmit}
                        className="flex-1 py-3 rounded-lg bg-blue-600 items-center active:bg-blue-700"
                    >
                        <Text className="font-medium text-white">Save Coupon</Text>
                    </Pressable>
                </View>
            </View>
        </ScrollView>
    );
}
