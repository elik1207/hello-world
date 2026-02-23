/**
 * modules/share-intent/index.ts
 * 
 * JS interface for the ShareIntent native module (Android only).
 * On non-Android platforms, all methods are safe no-ops that return null/void.
 * 
 * The native module (ShareIntentModule.kt) reads ACTION_SEND EXTRA_TEXT from
 * the Android intent on both cold and warm starts.
 */
import { Platform } from 'react-native';

// Dynamically require the native module only on Android.
// Use try/catch to handle cases where the module isn't built (e.g., Expo Go).
let ShareIntentNative: any = null;
if (Platform.OS === 'android') {
    try {
        const ExpoModulesCore = require('expo-modules-core');
        ShareIntentNative = ExpoModulesCore.NativeModulesProxy?.ShareIntent ?? null;
    } catch {
        // Module not linked — running in Expo Go or web
    }
}

/**
 * Get the shared text from the intent that opened the app (cold start).
 * Returns null if:
 * - Not on Android
 * - Module not linked (e.g., Expo Go)
 * - App was not opened via a share intent
 */
export async function getSharedText(): Promise<string | null> {
    if (!ShareIntentNative) return null;
    try {
        const text = await ShareIntentNative.getSharedText();
        return typeof text === 'string' ? text : null;
    } catch {
        return null;
    }
}

/**
 * Clear the native buffer after the text has been routed to the intake pipeline.
 * Must be called after routing to prevent re-processing on next check.
 */
export function clearSharedText(): void {
    if (!ShareIntentNative) return;
    try {
        ShareIntentNative.clearSharedText();
    } catch {
        // Silently ignore — module may not be linked
    }
}

export type ShareIntentListener = (event: { text: string }) => void;

/**
 * Subscribe to share intent events for warm-start shares.
 * When the app is already running and receives a new share intent,
 * the native module emits "onShareIntent" with { text: string }.
 * Returns an unsubscribe function.
 */
export function addShareIntentListener(listener: ShareIntentListener): () => void {
    if (!ShareIntentNative) return () => { };
    try {
        const ExpoModulesCore = require('expo-modules-core');
        const emitter = new ExpoModulesCore.EventEmitter(ShareIntentNative);
        const subscription = emitter.addListener('onShareIntent', (event: any) => {
            if (event?.text && typeof event.text === 'string') {
                listener(event);
            }
        });
        return () => subscription.remove();
    } catch {
        return () => { };
    }
}
