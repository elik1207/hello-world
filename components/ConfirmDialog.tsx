import { View, Text, Pressable, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { AlertTriangle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    isDestructive = false,
}: ConfirmDialogProps) {
    return (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onCancel}>
            <BlurView
                intensity={40}
                tint="dark"
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
            >
                <Pressable
                    style={{ position: 'absolute', inset: 0 } as any}
                    onPress={onCancel}
                />
                <View
                    style={{
                        backgroundColor: '#252849',
                        borderRadius: 24,
                        width: '100%',
                        maxWidth: 360,
                        borderWidth: 1,
                        borderColor: '#3c4270',
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 20 },
                        shadowOpacity: 0.5,
                        shadowRadius: 40,
                        elevation: 20,
                    }}
                >
                    {/* Top accent gradient strip */}
                    <LinearGradient
                        colors={isDestructive ? ['#921f1f', '#5a0d0d'] : ['#4e48c0', '#332d80']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ height: 4 }}
                    />

                    <View style={{ padding: 24 }}>
                        {/* Icon */}
                        <View
                            style={{
                                width: 52,
                                height: 52,
                                borderRadius: 16,
                                backgroundColor: isDestructive ? '#921f1f33' : '#4e48c033',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16,
                            }}
                        >
                            <AlertTriangle
                                size={26}
                                color={isDestructive ? '#ef4444' : '#6366f1'}
                                strokeWidth={2}
                            />
                        </View>

                        <Text
                            style={{ fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 }}
                        >
                            {title}
                        </Text>
                        <Text style={{ fontSize: 14, color: '#dde2f4', lineHeight: 20, marginBottom: 24 }}>
                            {message}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Pressable
                                onPress={onCancel}
                                style={({ pressed }) => ({
                                    flex: 1,
                                    paddingVertical: 14,
                                    borderRadius: 14,
                                    backgroundColor: pressed ? '#3c4270' : '#27305a',
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: '#3c4270',
                                })}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#dde2f4' }}>
                                    {cancelLabel}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={onConfirm}
                                style={({ pressed }) => ({
                                    flex: 1,
                                    paddingVertical: 14,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    opacity: pressed ? 0.8 : 1,
                                    overflow: 'hidden',
                                    backgroundColor: isDestructive ? '#b91c1c' : '#6366f1',
                                })}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                                    {confirmLabel}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </BlurView>
        </Modal>
    );
}
