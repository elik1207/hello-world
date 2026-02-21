try {
    const mockNativeModules = require('react-native/Libraries/BatchedBridge/NativeModules');
    if (!mockNativeModules.UIManager) {
        mockNativeModules.UIManager = {
            RCTView: () => { },
        };
    }
} catch (e) {
    console.error('Failed to polyfill NativeModules', e);
}
