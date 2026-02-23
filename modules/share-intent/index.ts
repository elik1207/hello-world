/**
 * modules/share-intent/index.ts
 * 
 * JS interface for the ShareIntent native module.
 * Provides typed access to Android share text reception.
 * On non-Android platforms, all methods are safe no-ops.
 */
import { Platform } from 'react-native';

// Dynamically require the native module only on Android to avoid crashes
let ShareIntentNative: any = null;
try {
    if (Platform.OS === 'android') {
        const { NativeModulesProxy } = require('expo-modules-core');
        ShareIntentNative = NativeModulesProxy.ShareIntent ?? null;
    }
} catch {
    // Module not available — running in web or iOS
}

/**
 * Get the shared text from the intent that opened the app (cold start).
 * Returns null if the app was not opened via a share intent.
 */
export async function getSharedText(): Promise<string | null> {
    if (!ShareIntentNative) return null;
    try {
        return await ShareIntentNative.getSharedText();
    } catch {
        return null;
    }
}

/**
 * Clear the native buffer after the text has been routed to the intake pipeline.
 * Prevents re-processing on subsequent checks.
 */
export function clearSharedText(): void {
    if (!ShareIntentNative) return;
    try {
        ShareIntentNative.clearSharedText();
    } catch {
        // Silently ignore
    }
}

export type ShareIntentListener = (event: { text: string }) => void;

/**
 * Subscribe to share intent events (warm start — app already running).
 * Returns an unsubscribe function.
 */
export function addShareIntentListener(listener: ShareIntentListener): () => void {
    if (!ShareIntentNative) return () => { };
    try {
        const { EventEmitter: ExpoEventEmitter } = require('expo-modules-core');
        const emitter = new ExpoEventEmitter(ShareIntentNative);
        const subscription = emitter.addListener('onShareIntent', listener);
        return () => subscription.remove();
    } catch {
        return () => { };
    }
}

