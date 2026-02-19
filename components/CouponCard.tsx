import { View, Text, Pressable } from 'react-native';
import { Edit2, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';
import type { Coupon } from '../lib/types';
import { cn, formatCurrency, formatDate, getDaysUntilExpiry } from '../lib/utils';

interface CouponCardProps {
    coupon: Coupon;
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void;
}

export function CouponCard({ coupon, onEdit, onDelete, onToggleStatus }: CouponCardProps) {
    const daysLeft = getDaysUntilExpiry(coupon.expiryDate);
    const isExpired = daysLeft !== null && daysLeft < 0;
    const dimmed = coupon.status === 'used' || isExpired;

    let badgeText = '';
    let badgeClass = '';
    let BadgeIcon: typeof AlertCircle | null = null;

    if (coupon.status === 'used') {
        badgeText = 'Used';
        badgeClass = 'bg-gray-100';
    } else if (isExpired) {
        badgeText = 'Expired';
        badgeClass = 'bg-red-100';
        BadgeIcon = AlertCircle;
    } else if (daysLeft !== null && daysLeft <= 3) {
        badgeText = daysLeft === 0 ? 'Today' : `${daysLeft}d left`;
        badgeClass = 'bg-orange-100';
        BadgeIcon = Clock;
    } else if (daysLeft !== null) {
        badgeText = `${daysLeft}d left`;
        badgeClass = 'bg-green-50';
    }

    return (
        <View
            className={cn(
                'bg-white rounded-xl p-4 shadow-sm border mb-3',
                dimmed ? 'border-gray-100 opacity-75' : 'border-gray-200'
            )}
        >
            {/* Header row */}
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 pr-2">
                    <Text
                        className={cn(
                            'font-bold text-lg leading-tight',
                            coupon.status === 'used' && 'line-through text-gray-500'
                        )}
                    >
                        {coupon.title}
                    </Text>
                    <View className="flex-row gap-2 mt-1 flex-wrap">
                        {!!coupon.store && (
                            <Text className="text-sm font-medium text-gray-700">{coupon.store}</Text>
                        )}
                        {!!coupon.category && (
                            <Text className="text-sm text-gray-500 bg-gray-50 px-1.5 rounded border border-gray-100">
                                {coupon.category}
                            </Text>
                        )}
                    </View>
                </View>

                <View className="items-end">
                    <Text className="font-bold text-xl text-blue-600">
                        {coupon.discountType === 'percent'
                            ? `${coupon.discountValue}%`
                            : formatCurrency(coupon.discountValue, coupon.currency)}
                    </Text>
                    {!!badgeText && (
                        <View className={`flex-row items-center gap-1 mt-1 px-2 py-0.5 rounded ${badgeClass}`}>
                            {BadgeIcon && (
                                <BadgeIcon
                                    size={10}
                                    color={isExpired ? '#b91c1c' : '#c2410c'}
                                />
                            )}
                            <Text className={`text-xs font-medium ${isExpired ? 'text-red-700' : coupon.status === 'used' ? 'text-gray-600' : daysLeft !== null && daysLeft <= 3 ? 'text-orange-700' : 'text-green-700'}`}>
                                {badgeText}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Footer row */}
            <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-gray-50">
                <Text className="text-xs text-gray-400">
                    {coupon.expiryDate ? `Exp: ${formatDate(coupon.expiryDate)}` : 'No expiry'}
                </Text>
                <View className="flex-row gap-2">
                    {coupon.status !== 'used' && !isExpired && (
                        <Pressable
                            onPress={() => onToggleStatus(coupon)}
                            className="p-2 rounded-lg active:bg-green-50"
                        >
                            <CheckCircle size={18} color="#16a34a" />
                        </Pressable>
                    )}
                    {coupon.status === 'used' && (
                        <Pressable
                            onPress={() => onToggleStatus(coupon)}
                            className="p-2 rounded-lg active:bg-blue-50"
                        >
                            <CheckCircle size={18} color="#2563eb" />
                        </Pressable>
                    )}
                    <Pressable onPress={() => onEdit(coupon)} className="p-2 rounded-lg active:bg-gray-100">
                        <Edit2 size={18} color="#6b7280" />
                    </Pressable>
                    <Pressable onPress={() => onDelete(coupon)} className="p-2 rounded-lg active:bg-red-50">
                        <Trash2 size={18} color="#ef4444" />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
