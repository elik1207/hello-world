import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolateColor,
    useDerivedValue,
} from 'react-native-reanimated';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Wallet, PlusCircle, Settings, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type NavView = 'wallet' | 'add' | 'add-ai' | 'settings';

interface BottomNavProps {
    currentView: NavView;
    onChange: (view: NavView) => void;
}

const TABS: { id: NavView; label: string; Icon: typeof Wallet }[] = [
    { id: 'wallet', label: 'Wallet', Icon: Wallet },
    { id: 'add', label: 'Manual', Icon: PlusCircle },
    { id: 'add-ai', label: 'AI Paste', Icon: Sparkles },
    { id: 'settings', label: 'Settings', Icon: Settings },
];

function NavTab({
    id,
    label,
    Icon,
    active,
    onPress,
}: {
    id: NavView;
    label: string;
    Icon: typeof Wallet;
    active: boolean;
    onPress: () => void;
}) {
    const scale = useSharedValue(1);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
        scale.value = withSpring(0.85, {}, () => {
            scale.value = withSpring(1);
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    return (
        <Pressable onPress={handlePress} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
            <Animated.View style={[animStyle, { alignItems: 'center', gap: 4 }]}>
                {active ? (
                    <LinearGradient
                        colors={['#6366f1', '#8b5cf6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            borderRadius: 16,
                            padding: 8,
                            marginBottom: 2,
                        }}
                    >
                        <Icon size={20} color="#ffffff" strokeWidth={2.2} />
                    </LinearGradient>
                ) : (
                    <View style={{ padding: 8, marginBottom: 2 }}>
                        <Icon size={20} color="#a0aed4" strokeWidth={1.75} />
                    </View>
                )}
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: active ? '700' : '400',
                        color: active ? '#a78bfa' : '#a0aed4',
                        letterSpacing: 0.3,
                    }}
                >
                    {label}
                </Text>
            </Animated.View>
        </Pressable>
    );
}

export function BottomNav({ currentView, onChange }: BottomNavProps) {
    return (
        <View
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: '#252849',
                borderTopWidth: 1,
                borderTopColor: '#3c4270',
                paddingBottom: 20,
                paddingTop: 8,
                flexDirection: 'row',
            }}
        >
            {TABS.map(({ id, label, Icon }) => (
                <NavTab
                    key={id}
                    id={id}
                    label={label}
                    Icon={Icon}
                    active={currentView === id}
                    onPress={() => onChange(id)}
                />
            ))}
        </View>
    );
}
