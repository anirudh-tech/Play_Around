const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Expo detects the pnpm monorepo and watches workspace packages automatically.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
