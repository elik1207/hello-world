import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, SafeAreaView, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Download, Upload, Trash2, ChevronRight, Shield, Database, Bell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getReminderSettings, setReminderSettings } from '../lib/reminders';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLIPBOARD_ENABLED_KEY = '@intake_clipboard_enabled';

interface SettingsPageProps {
    onExport: () => void;
    onImport: () => void;
    onClear: () => void;
}

export function SettingsPage({ onExport, onImport, onClear }: SettingsPageProps) {
    const [remindersEnabled, setRemindersEnabled] = useState(true);
    const [clipboardEnabled, setClipboardEnabled] = useState(false);

    useEffect(() => {
        getReminderSettings().then(cfg => {
            setRemindersEnabled(cfg.enabled);
        });
        AsyncStorage.getItem(CLIPBOARD_ENABLED_KEY).then(val => {
            setClipboardEnabled(val === 'true');
        });
    }, []);

    const toggleClipboardSuggestions = async (val: boolean) => {
        setClipboardEnabled(val);
        await AsyncStorage.setItem(CLIPBOARD_ENABLED_KEY, val.toString());
    };

    const toggleReminders = async (val: boolean) => {
        setRemindersEnabled(val);
        await setReminderSettings(val);
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
                    description="Share your wallet as a file"
                    onPress={onExport}
                />
                <SettingRow
                    iconBg={['#0a7a5e', '#0a6b52']}
                    icon={<Download size={20} color="#6ee7b7" />}
                    label="Import Coupons"
                    description="Load an exported file"
                    onPress={onImport}
                />
                <SettingRow
                    iconBg={['#921f1f', '#5a0d0d']}
                    icon={<Trash2 size={20} color="#fca5a5" />}
                    label="Clear All Data"
                    description="Permanently delete all items"
                    onPress={onClear}
                    destructive
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 12 }}>
                    <Bell size={12} color="#a0aed4" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#a0aed4', letterSpacing: 1, textTransform: 'uppercase' }}>
                        Notifications & Alerts
                    </Text>
                </View>

                <View style={{
                    backgroundColor: '#27305a',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#3c4270',
                    overflow: 'hidden'
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#3c4270' }}>
                        <View style={{ flex: 1, paddingRight: 16 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#f8fafc' }}>Local Reminders</Text>
                            <Text style={{ fontSize: 12, color: '#a0aed4', marginTop: 2 }}>Get alerts before coupons expire</Text>
                        </View>
                        <Switch
                            value={remindersEnabled}
                            onValueChange={toggleReminders}
                            trackColor={{ false: '#3c4270', true: '#6366f1' }}
                            thumbColor={'#fff'}
                        />
                    </View>

                    {remindersEnabled && (
                        <View style={{ padding: 16 }}>
                            <Text style={{ fontSize: 13, color: '#a0aed4', lineHeight: 18 }}>
                                התראות אוטומטיות לפי זמן עד תפוגה:{"\n"}
                                • שוברים ארוכי טווח — 6 חודשים + חודש לפני{"\n"}
                                • שוברים בינוניים — חודש + שבוע לפני{"\n"}
                                • שוברים קצרי טווח — שבוע + 3 ימים לפני
                            </Text>
                        </View>
                    )}
                </View>

                {/* Clipboard Suggestions Section */}
                <View style={{
                    backgroundColor: '#27305a',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#3c4270',
                    overflow: 'hidden',
                    marginTop: 16
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                        <View style={{ flex: 1, paddingRight: 16 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#f8fafc' }}>Clipboard Suggestions</Text>
                            <Text style={{ fontSize: 12, color: '#a0aed4', marginTop: 2 }}>Suggest saving vouchers from clipboard</Text>
                        </View>
                        <Switch
                            value={clipboardEnabled}
                            onValueChange={toggleClipboardSuggestions}
                            trackColor={{ false: '#3c4270', true: '#6366f1' }}
                            thumbColor={'#fff'}
                        />
                    </View>
                </View>

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
                        <Text style={{ fontSize: 11, color: '#a0aed4', marginTop: 1 }}>v2.0.0 — Synchronized Universal Build</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
