import { View, Text, Pressable, ScrollView, Alert, SafeAreaView } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Download, Upload, Trash2, ChevronRight, Shield, Database } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

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

    function SettingRow({
        icon,
        iconBg,
        label,
        description,
        onPress,
        destructive = false,
    }: {
        icon: React.ReactNode;
        iconBg: string[];
        label: string;
        description: string;
        onPress: () => void;
        destructive?: boolean;
    }) {
        return (
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress();
                }}
                style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 16,
                    backgroundColor: pressed ? '#252050' : '#27305a',
                    borderRadius: 16,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: '#3c4270',
                })}
            >
                <LinearGradient
                    colors={iconBg as [string, string]}
                    style={{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}
                >
                    {icon}
                </LinearGradient>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: destructive ? '#f87171' : '#f8fafc' }}>
                        {label}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#a0aed4', marginTop: 2 }}>{description}</Text>
                </View>
                <ChevronRight size={16} color="#3c4270" />
            </Pressable>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#1a1d38' }}>
            <LinearGradient
                colors={['#332d80', '#1a1d38']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                <SafeAreaView>
                    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5 }}>
                            Settings
                        </Text>
                        <Text style={{ fontSize: 13, color: '#6366f1', fontWeight: '500', marginTop: 2 }}>
                            Manage your data
                        </Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <Database size={12} color="#a0aed4" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#a0aed4', letterSpacing: 1, textTransform: 'uppercase' }}>
                        Data Management
                    </Text>
                </View>

                <SettingRow
                    iconBg={['#4e48c0', '#332d80']}
                    icon={<Upload size={20} color="#a78bfa" />}
                    label="Export Coupons"
                    description="Share your wallet as a JSON file"
                    onPress={onExport}
                />
                <SettingRow
                    iconBg={['#0a7a5e', '#0a6b52']}
                    icon={<Download size={20} color="#6ee7b7" />}
                    label="Import Coupons"
                    description="Load coupons from a JSON file"
                    onPress={handleImport}
                />
                <SettingRow
                    iconBg={['#921f1f', '#5a0d0d']}
                    icon={<Trash2 size={20} color="#fca5a5" />}
                    label="Clear All Data"
                    description="Permanently delete all coupons"
                    onPress={onClear}
                    destructive
                />

                {/* App Version */}
                <View
                    style={{
                        marginTop: 24,
                        padding: 16,
                        backgroundColor: '#27305a',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: '#3c4270',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <Shield size={16} color="#6366f1" />
                    <View>
                        <Text style={{ fontSize: 13, color: '#dde2f4', fontWeight: '500' }}>Coupon Wallet</Text>
                        <Text style={{ fontSize: 11, color: '#a0aed4', marginTop: 1 }}>v1.0.0 — All data stored locally</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
