import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { CouponForm } from '../components/CouponForm';
import type { Coupon } from '../lib/types';

interface AddEditPageProps {
    initialData?: Coupon;
    onSave: (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
    onCancel: () => void;
}

export function AddEditPage({ initialData, onSave, onCancel }: AddEditPageProps) {
    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View className="px-4 pt-4 pb-2 border-b border-gray-100">
                    <Text className="text-2xl font-bold text-gray-900">
                        {initialData ? 'Edit Coupon' : 'Add Coupon'}
                    </Text>
                </View>
                <CouponForm initialData={initialData} onSave={onSave} onCancel={onCancel} />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
