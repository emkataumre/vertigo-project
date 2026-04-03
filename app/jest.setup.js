// Supabase client reads these at module import time — must be set before any test imports
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

// expo/src/winter/runtime.native.ts (loaded by jest-expo's setupFiles) installs lazy
// property getters on globals like structuredClone, TextDecoder, URL, etc. When these
// getters fire in tests, their require() calls are bound to the setup module context,
// causing "import outside scope of test code" errors.
//
// Fix: replace each Expo lazy getter with a real value using Object.defineProperty.
// Object.defineProperty REPLACES the descriptor without triggering the existing getter,
// and all Expo lazy getters are installed with configurable: true so this is safe.
const { TextDecoder: NodeTextDecoder, TextEncoder: NodeTextEncoder } = require("util");
const { URL: NodeURL, URLSearchParams: NodeURLSearchParams } = require("url");

[
  ["structuredClone", (obj) => JSON.parse(JSON.stringify(obj))],
  ["TextDecoder", NodeTextDecoder],
  ["TextEncoder", NodeTextEncoder],
  ["URL", NodeURL],
  ["URLSearchParams", NodeURLSearchParams],
  ["__ExpoImportMetaRegistry", undefined],
].forEach(([name, value]) => {
  Object.defineProperty(global, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
});

// expo-camera: mock native camera module
jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn().mockResolvedValue({ granted: true })]),
}));

// expo-status-bar: no-op
jest.mock("expo-status-bar", () => ({
  StatusBar: "StatusBar",
}));
