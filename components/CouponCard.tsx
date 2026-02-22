import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { View, Text, Pressable, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Edit2, Trash2, CheckCircle, Clock, AlertCircle, Tag, Gift, Ticket } from 'lucide-react-native';
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

    const isGiftCard = coupon.type === 'gift_card';
    const hasRemaining = isGiftCard && coupon.remainingValue !== undefined && coupon.initialValue !== undefined;
    const isFullyUsed = hasRemaining && coupon.remainingValue! <= 0;
    const isUsed = coupon.status === 'used' || isFullyUsed;

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
    const TypeIcon = coupon.type === 'gift_card' ? Gift : coupon.type === 'voucher' ? Ticket : Tag;

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
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
            }}
        >
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accentColor, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }} />

            <View style={{ padding: 16, paddingLeft: 20 }}>
                {!!coupon.imageUrl && (
                    <View style={{ width: '100%', height: 120, marginBottom: 16, backgroundColor: '#1a1d38', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#3c4270' }}>
                        <Image source={{ uri: coupon.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <TypeIcon size={12} color="#a0aed4" />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#a0aed4', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {coupon.type.replace('_', ' ')}
                            </Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: isUsed ? '#64748b' : '#f8fafc', textDecorationLine: isUsed ? 'line-through' : 'none', marginBottom: 6 }} numberOfLines={1}>
                            {coupon.title}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {!!coupon.store && (
                                <Text style={{ fontSize: 12, color: '#dde2f4', fontWeight: '500' }}>{coupon.store}</Text>
                            )}
                            {!!coupon.category && (
                                <View style={{ backgroundColor: '#252050', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: '#3c4270' }}>
                                    <Text style={{ fontSize: 11, color: '#a78bfa', fontWeight: '500' }}>{coupon.category}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                        {isGiftCard ? (
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: dimmed ? '#a0aed4' : '#6366f1' }}>
                                    {formatCurrency(coupon.remainingValue ?? coupon.initialValue ?? 0, coupon.currency)}
                                </Text>
                                {hasRemaining && coupon.remainingValue !== coupon.initialValue && (
                                    <Text style={{ fontSize: 11, color: '#64748b', textDecorationLine: 'line-through', marginTop: 2 }}>
                                        {formatCurrency(coupon.initialValue!, coupon.currency)}
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <LinearGradient colors={dimmed ? ['#3c4270', '#3c4270'] : ['#6366f1', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, fontWeight: '800', color: dimmed ? '#a0aed4' : '#ffffff' }}>
                                    {coupon.discountType === 'percent' ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue || 0, coupon.currency)}
                                </Text>
                            </LinearGradient>
                        )}
                        {!!badgeText && (
                            <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8 }}>
                                {isExpired && <AlertCircle size={10} color={badgeTextColor} />}
                                {!isExpired && !isUsed && daysLeft !== null && daysLeft <= 7 && <Clock size={10} color={badgeTextColor} />}
                                <Text style={{ fontSize: 11, color: badgeTextColor, fontWeight: '600' }}>{badgeText}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {(!!coupon.sender || !!coupon.event) && (
                    <View style={{ marginTop: 12, padding: 8, backgroundColor: '#1a1d38', borderRadius: 8, borderWidth: 1, borderColor: '#3c4270', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        {!!coupon.sender && <Text style={{ fontSize: 11, color: '#a0aed4' }}>From: <Text style={{ color: '#dde2f4', fontWeight: '500' }}>{coupon.sender}</Text></Text>}
                        {!!coupon.sender && !!coupon.event && <Text style={{ color: '#64748b', fontSize: 11 }}>•</Text>}
                        {!!coupon.event && <Text style={{ fontSize: 11, color: '#a0aed4' }}>For: <Text style={{ color: '#dde2f4', fontWeight: '500' }}>{coupon.event}</Text></Text>}
                    </View>
                )}

                {!!coupon.barcodeData && (
                    <View style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#1a1d38', borderRadius: 8, borderWidth: 1, borderColor: '#3c4270', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', width: '100%', height: 24, justifyContent: 'space-between', marginBottom: 4, opacity: 0.5 }}>
                            {Array.from({ length: 24 }).map((_, i) => (
                                <View key={i} style={{ flex: 1, backgroundColor: '#a0aed4', opacity: Math.random() > 0.5 ? 1 : 0.3, width: Math.random() * 4 + 1, marginHorizontal: 1 }} />
                            ))}
                        </View>
                        <Text style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, color: '#a0aed4', fontWeight: '600' }}>{coupon.barcodeData}</Text>
                    </View>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#3c4270' }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#a0aed4' }}>
                            {coupon.expiryDate ? `Exp: ${formatDate(coupon.expiryDate)}` : 'No expiry'}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                        {!isUsed && !isExpired && <ActionBtn onPress={() => onToggleStatus(coupon)} icon={<CheckCircle size={16} color="#10b981" />} color="#10b981" />}
                        {isUsed && <ActionBtn onPress={() => onToggleStatus(coupon)} icon={<CheckCircle size={16} color="#6366f1" />} color="#6366f1" />}
                        <ActionBtn onPress={() => onEdit(coupon)} icon={<Edit2 size={16} color="#dde2f4" />} color="#dde2f4" />
                        <ActionBtn onPress={() => onDelete(coupon)} icon={<Trash2 size={16} color="#ef4444" />} color="#ef4444" haptic="Medium" />
                    </View>
                </View>
            </View>
        </Animated.View>
    );
}
