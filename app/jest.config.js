module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["./jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo/src/.*|react-navigation|@react-navigation/.*|@supabase/supabase-js))",
  ],
  moduleNameMapper: {
    // Prevent Expo's winter runtime from loading native modules in Jest
    "^expo/src/winter/runtime\\.native$": "<rootDir>/__mocks__/expoWinterRuntime.js",
    // Mock installGlobal entirely to prevent ALL lazy global getter installations
    ".*/expo/src/winter/installGlobal.*": "<rootDir>/__mocks__/emptyModule.js",
  },
};
