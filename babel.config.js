module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Dotenv plugin for loading environment variables
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
      // React Native Reanimated plugin (must be last)
      'react-native-reanimated/plugin',
    ],
    overrides: [
      {
        test: /\.tsx?$/,
        presets: [
          [
            '@babel/preset-typescript',
            {
              tsconfigPath: './tsconfig.json', // Make sure this matches your project structure
            },
          ],
        ],
      },
    ],
  };
};
