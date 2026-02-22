import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { generateExportPayload } from './db';

export async function exportWallet(): Promise<boolean> {
    try {
        const data = await generateExportPayload();
        const json = JSON.stringify(data, null, 2);
        const filename = `coupon-wallet-${data.exportedAt.split('T')[0]}.json`;

        const fileUri = (FileSystem.cacheDirectory ?? '') + filename;
        await FileSystem.writeAsStringAsync(fileUri, json);
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json' });
        return true;
    } catch (error) {
        console.error('Export failed:', error);
        return false;
    }
}

export async function importWalletFile(): Promise<string | null> {
    try {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'application/json',
            copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets || result.assets.length === 0) {
            return null;
        }
        const fileUri = result.assets[0].uri;
        const content = await FileSystem.readAsStringAsync(fileUri);
        return content;
    } catch (error) {
        console.error('Import file picking failed:', error);
        return null;
    }
}
