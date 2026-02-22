/**
 * plugins/withAndroidShareIntent.js
 * 
 * Expo config plugin that adds an intent-filter for ACTION_SEND (text/plain)
 * to the main Android activity, enabling the app to appear in the OS share sheet.
 * 
 * Usage: add to app.json plugins array:
 *   ["./plugins/withAndroidShareIntent"]
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function withAndroidShareIntent(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults;
        const mainActivity = manifest.manifest.application[0].activity[0];

        // Check if share intent-filter already exists
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
