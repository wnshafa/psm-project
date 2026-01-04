const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1. Add 'cjs' to support the Firebase JS SDK (Web)
config.resolver.sourceExts.push('cjs');

// 2. Add extra support for React Native Firebase (Native)
// This helps resolve the directory import error you're seeing
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
};

module.exports = config;