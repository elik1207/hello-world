import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CouponForm } from '../components/CouponForm';
import type { Coupon } from '../lib/types';

interface AddEditPageProps {
    initialData?: Coupon;
    onSave: (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
    onCancel: () => void;
    onToggleStatus?: (coupon: Coupon) => void;
}

export function AddEditPage({ initialData, onSave, onCancel, onToggleStatus }: AddEditPageProps) {
    return (
        <View style={{ flex: 1, backgroundColor: '#1a1d38' }}>
            <LinearGradient
                colors={['#332d80', '#1a1d38']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                <SafeAreaView>
                    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5 }}>
                            {initialData ? 'Edit Coupon' : 'Add Coupon'}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#6366f1', fontWeight: '500', marginTop: 2 }}>
                            {initialData ? 'Update the details below' : 'Save a new deal to your wallet'}
                        </Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <CouponForm initialData={initialData} onSave={onSave} onCancel={onCancel} onToggleStatus={onToggleStatus} />
            </KeyboardAvoidingView>
        </View>
    );
}
