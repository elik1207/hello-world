import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Edit2, Trash2, CheckCircle, Clock, AlertCircle, Tag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Coupon } from '../lib/types';
import { formatCurrency, formatDate, getDaysUntilExpiry } from '../lib/utils';

interface CouponCardProps {
    coupon: Coupon;
    onEdit: (coupon: Coupon) => void;
    onDelete: (coupon: Coupon) => void;
    onToggleStatus: (coupon: Coupon) => void;
}

function ActionBtn({
    onPress,
    icon,
    color,
    haptic = 'Light',
}: {
    onPress: () => void;
    icon: React.ReactNode;
    color: string;
    haptic?: 'Light' | 'Medium' | 'Heavy';
}) {
    const scale = useSharedValue(1);
    const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const handle = () => {
        scale.value = withSpring(0.8, {}, () => { scale.value = withSpring(1); });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle[haptic]);
        onPress();
    };
    return (
        <Pressable onPress={handle}>
            <Animated.View
                style={[anim, { padding: 8, borderRadius: 10, backgroundColor: color + '22' }]}
            >
                {icon}
            </Animated.View>
        </Pressable>
    );
}

export function CouponCard({ coupon, onEdit, onDelete, onToggleStatus }: CouponCardProps) {
    const daysLeft = getDaysUntilExpiry(coupon.expiryDate);
    const isExpired = daysLeft !== null && daysLeft < 0;
    const isUsed = coupon.status === 'used';

    // Status-based accent color
    let accentColor = '#6366f1'; // default indigo
    let badgeText = '';
    let badgeBg = '';
    let badgeTextColor = '';

    if (isUsed) {
        accentColor = '#64748b';
        badgeText = 'Used';
        badgeBg = '#232848';
        badgeTextColor = '#dde2f4';
    } else if (isExpired) {
        accentColor = '#ef4444';
        badgeText = 'Expired';
        badgeBg = '#5a0d0d';
        badgeTextColor = '#fca5a5';
    } else if (daysLeft !== null && daysLeft === 0) {
        accentColor = '#f59e0b';
        badgeText = 'Today!';
        badgeBg = '#451a03';
        badgeTextColor = '#fcd34d';
    } else if (daysLeft !== null && daysLeft <= 7) {
        accentColor = '#f59e0b';
        badgeText = `${daysLeft}d left`;
        badgeBg = '#451a03';
        badgeTextColor = '#fcd34d';
    } else if (daysLeft !== null) {
        accentColor = '#10b981';
        badgeText = `${daysLeft}d left`;
        badgeBg = '#0a6b52';
        badgeTextColor = '#6ee7b7';
    }

    const dimmed = isUsed || isExpired;

    return (
        <Animated.View
            style={{
                opacity: dimmed ? 0.7 : 1,
                marginBottom: 12,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#27305a',
                borderWidth: 1,
                borderColor: '#3c4270',
                // shadow
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
            }}
        >
            {/* Colored left accent bar */}
            <View
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    backgroundColor: accentColor,
                    borderTopLeftRadius: 16,
                    borderBottomLeftRadius: 16,
                }}
            />

            <View style={{ padding: 16, paddingLeft: 20 }}>
                {/* Top row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text
                            style={{
                                fontSize: 16,
                                fontWeight: '700',
                                color: isUsed ? '#64748b' : '#f8fafc',
                                textDecorationLine: isUsed ? 'line-through' : 'none',
                                marginBottom: 4,
                            }}
                            numberOfLines={1}
                        >
                            {coupon.title}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {!!coupon.store && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <Tag size={11} color="#6366f1" />
                                    <Text style={{ fontSize: 12, color: '#dde2f4', fontWeight: '500' }}>
                                        {coupon.store}
                                    </Text>
                                </View>
                            )}
                            {!!coupon.category && (
                                <View
                                    style={{
                                        backgroundColor: '#252050',
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        borderRadius: 20,
                                        borderWidth: 1,
                                        borderColor: '#3c4270',
                                    }}
                                >
                                    <Text style={{ fontSize: 11, color: '#a78bfa', fontWeight: '500' }}>
                                        {coupon.category}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Discount Value */}
                    <LinearGradient
                        colors={dimmed ? ['#3c4270', '#3c4270'] : ['#6366f1', '#8b5cf6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }}
                    >
                        <Text style={{ fontSize: 18, fontWeight: '800', color: dimmed ? '#a0aed4' : '#ffffff' }}>
                            {coupon.discountType === 'percent'
                                ? `${coupon.discountValue}%`
                                : formatCurrency(coupon.discountValue, coupon.currency)}
                        </Text>
                    </LinearGradient>
                </View>

                {/* Bottom row */}
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 14,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: '#3c4270',
                    }}
                >
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#a0aed4' }}>
                            {coupon.expiryDate ? `Exp: ${formatDate(coupon.expiryDate)}` : 'No expiry'}
                        </Text>
                        {!!badgeText && (
                            <View
                                style={{
                                    backgroundColor: badgeBg,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 20,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 3,
                                }}
                            >
                                {isExpired && <AlertCircle size={10} color={badgeTextColor} />}
                                {!isExpired && !isUsed && daysLeft !== null && daysLeft <= 7 && (
                                    <Clock size={10} color={badgeTextColor} />
                                )}
                                <Text style={{ fontSize: 11, color: badgeTextColor, fontWeight: '600' }}>{badgeText}</Text>
                            </View>
                        )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 4 }}>
                        {!isUsed && !isExpired && (
                            <ActionBtn
                                onPress={() => onToggleStatus(coupon)}
                                icon={<CheckCircle size={16} color="#10b981" />}
                                color="#10b981"
                            />
                        )}
                        {isUsed && (
                            <ActionBtn
                                onPress={() => onToggleStatus(coupon)}
                                icon={<CheckCircle size={16} color="#6366f1" />}
                                color="#6366f1"
                            />
                        )}
                        <ActionBtn
                            onPress={() => onEdit(coupon)}
                            icon={<Edit2 size={16} color="#dde2f4" />}
                            color="#dde2f4"
                        />
                        <ActionBtn
                            onPress={() => onDelete(coupon)}
                            icon={<Trash2 size={16} color="#ef4444" />}
                            color="#ef4444"
                            haptic="Medium"
                        />
                    </View>
                </View>
            </View>
        </Animated.View>
    );
}
