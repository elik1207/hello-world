import { View, Text, Pressable } from 'react-native';
import { Wallet, PlusCircle, Settings } from 'lucide-react-native';

type View = 'wallet' | 'add' | 'settings';

interface BottomNavProps {
    currentView: View;
    onChange: (view: View) => void;
}

const tabs: { id: View; label: string; Icon: typeof Wallet }[] = [
    { id: 'wallet', label: 'Wallet', Icon: Wallet },
    { id: 'add', label: 'Add', Icon: PlusCircle },
    { id: 'settings', label: 'Settings', Icon: Settings },
];

export function BottomNav({ currentView, onChange }: BottomNavProps) {
    return (
        <View className="absolute bottom-0 left-0 right-0 flex-row bg-white border-t border-gray-200 pb-6 pt-2">
            {tabs.map(({ id, label, Icon }) => {
                const active = currentView === id;
                return (
                    <Pressable
                        key={id}
                        onPress={() => onChange(id)}
                        className="flex-1 items-center gap-1 py-1"
                    >
                        <Icon
                            size={22}
                            color={active ? '#2563eb' : '#9ca3af'}
                            strokeWidth={active ? 2.5 : 1.75}
                        />
                        <Text
                            className={`text-xs font-medium ${active ? 'text-blue-600' : 'text-gray-400'}`}
                        >
                            {label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
