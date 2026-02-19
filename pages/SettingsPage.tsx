import { View, Text, Pressable, ScrollView, Alert, SafeAreaView } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Download, Upload, Trash2 } from 'lucide-react-native';

interface SettingsPageProps {
    onExport: () => void;
    onImport: (content: string) => void;
    onClear: () => void;
}

export function SettingsPage({ onExport, onImport, onClear }: SettingsPageProps) {
    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.[0]) return;
            const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
            onImport(content);
        } catch {
            Alert.alert('Error', 'Failed to read the file.');
        }
    };

    const SettingRow = ({
        icon,
        label,
        description,
        onPress,
        destructive = false,
    }: {
        icon: React.ReactNode;
        label: string;
        description: string;
        onPress: () => void;
        destructive?: boolean;
    }) => (
        <Pressable
            onPress={onPress}
            className="flex-row items-center gap-4 p-4 bg-white rounded-xl mb-3 active:opacity-70"
        >
            <View className={`p-2 rounded-lg ${destructive ? 'bg-red-50' : 'bg-blue-50'}`}>
                {icon}
            </View>
            <View className="flex-1">
                <Text className={`font-semibold text-base ${destructive ? 'text-red-600' : 'text-gray-900'}`}>
                    {label}
                </Text>
                <Text className="text-sm text-gray-500 mt-0.5">{description}</Text>
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView className="flex-1">
                <View className="px-4 pt-4 pb-2">
                    <Text className="text-2xl font-bold text-gray-900 mb-6">Settings</Text>

                    <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                        Data
                    </Text>

                    <SettingRow
                        icon={<Upload size={20} color="#2563eb" />}
                        label="Export Coupons"
                        description="Save your coupons as a JSON file"
                        onPress={onExport}
                    />
                    <SettingRow
                        icon={<Download size={20} color="#2563eb" />}
                        label="Import Coupons"
                        description="Load coupons from a JSON file"
                        onPress={handleImport}
                    />
                    <SettingRow
                        icon={<Trash2 size={20} color="#dc2626" />}
                        label="Clear All Data"
                        description="Delete all coupons permanently"
                        onPress={onClear}
                        destructive
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
