module.exports = {
    preset: 'jest-expo',
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|lucide-react-native)'
    ],
    setupFiles: ['./jest.polyfill.js'],
    setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect']
};
