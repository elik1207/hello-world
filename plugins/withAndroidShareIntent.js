/**
 * plugins/withAndroidShareIntent.js
 * 
 * Expo config plugin that:
 * 1. Adds ACTION_SEND text/plain intent-filter to the main Activity
 * 2. Sets android:launchMode="singleTask" so warm-start shares trigger onNewIntent
 *    instead of creating a duplicate Activity
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function withAndroidShareIntent(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults;
        const mainActivity = manifest.manifest.application[0].activity[0];

        // 1. Set launchMode to singleTask for warm-start share intent delivery
        mainActivity.$['android:launchMode'] = 'singleTask';

        // 2. Add share intent-filter if not present
        const intentFilters = mainActivity['intent-filter'] || [];
        const hasShareFilter = intentFilters.some(f => {
            const actions = f.action || [];
            return actions.some(a => a.$?.['android:name'] === 'android.intent.action.SEND');
        });

        if (!hasShareFilter) {
            intentFilters.push({
                action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
                category: [
                    { $: { 'android:name': 'android.intent.category.DEFAULT' } }
                ],
                data: [{ $: { 'android:mimeType': 'text/plain' } }],
            });
            mainActivity['intent-filter'] = intentFilters;
        }

        return config;
    });
}

module.exports = withAndroidShareIntent;
