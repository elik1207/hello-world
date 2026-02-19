import { View, Text, Pressable, Modal } from 'react-native';

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
        <Modal
            visible={isOpen}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable
                className="flex-1 bg-black/50 items-center justify-center p-4"
                onPress={onCancel}
            >
                <Pressable className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 gap-4">
                    <Text className="text-lg font-semibold text-gray-900">{title}</Text>
                    <Text className="text-gray-600">{message}</Text>
                    <View className="flex-row gap-3 justify-end pt-2">
                        <Pressable
                            onPress={onCancel}
                            className="px-4 py-2 rounded-lg bg-gray-100 active:bg-gray-200"
                        >
                            <Text className="text-sm font-medium text-gray-700">{cancelLabel}</Text>
                        </Pressable>
                        <Pressable
                            onPress={onConfirm}
                            className={`px-4 py-2 rounded-lg active:opacity-80 ${isDestructive ? 'bg-red-600' : 'bg-blue-600'}`}
                        >
                            <Text className="text-sm font-medium text-white">{confirmLabel}</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
