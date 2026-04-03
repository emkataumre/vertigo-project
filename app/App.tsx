import { type ReactNode, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Image, Pressable, Alert, Linking } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import ScanningOverlay from "./components/ScanningOverlay";
import ConfirmationScreen from "./components/ConfirmationScreen";
import ResultScreen from "./components/ResultScreen";
import CorrectionScreen, { type Alternative } from "./components/CorrectionScreen";
import ErrorOverlay from "./components/ErrorOverlay";
import UnidentifiableOverlay from "./components/UnidentifiableOverlay";
import type { BinId } from "./constants/bins";
import { callIdentify } from "./lib/callIdentify";
import { callClassifyText } from "./lib/callClassifyText";
import { saveScan } from "./lib/saveScan";
import { saveCorrection } from "./lib/saveCorrection";
import { compressForIdentify, compressForStorage } from "./lib/compressImage";

type AppState = "camera" | "scanning" | "confirmation" | "result" | "correction" | "error" | "unidentifiable";

interface ScanResult {
  photoUri: string;
  photoBase64: string;
  item: string;
  bin: BinId;
  reason: string;
  reasonDa: string;
  alternatives: Alternative[];
}

interface ScreenLayerProps {
  visible: boolean;
  children: ReactNode;
}

function ScreenLayer({ visible, children }: ScreenLayerProps): ReactNode {
  return (
    <View
      style={[styles.screenLayer, { opacity: visible ? 1 : 0 }]}
      pointerEvents={visible ? "auto" : "none"}
    >
      {visible ? children : null}
    </View>
  );
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [appState, setAppState] = useState<AppState>("camera");
  const [errorTitle, setErrorTitle] = useState<string>("Something went wrong");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    requestPermission().catch((error) => {
      console.error("Camera permission request failed:", error);
      Alert.alert(
        "Permission error",
        "Could not request camera access. Please restart the app or enable it in Settings.",
        [{ text: "Open Settings", onPress: () => Linking.openSettings().catch((error) => { console.error("Could not open settings:", error); }) }]
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      console.log("[handleCapture] Taking picture...");
      const photo = await cameraRef.current.takePictureAsync({ base64: true });
      if (!photo || !photo.base64) {
        console.error("[handleCapture] Camera returned no photo or missing base64 data");
        setAppState("error");
        return;
      }

      console.log("[handleCapture] Photo captured, calling identify...");
      setCapturedPhotoUri(photo.uri);
      setAppState("scanning");

      const compressedBase64 = await compressForIdentify(photo.uri);
      const response = await callIdentify(compressedBase64 ?? photo.base64);
      console.log("[handleCapture] Identify returned:", response.item);

      if (response.bin_id === null) {
        setAppState("unidentifiable");
        return;
      }

      const result: ScanResult = {
        photoUri: photo.uri,
        photoBase64: photo.base64,
        item: response.item,
        bin: response.bin_id,
        reason: response.reason_en,
        reasonDa: response.reason_da,
        alternatives: response.alternatives.map((a) => ({ item: a.item, bin: a.bin_id })),
      };
      setScanResult(result);
      setAppState("confirmation");
    } catch (error) {
      console.error("handleCapture failed:", error);
      const networkPattern = /network request failed|failed to send a request|failed to fetch/i;
      const isNetworkError =
        error instanceof Error &&
        (networkPattern.test(error.message) ||
          (error.cause instanceof Error && networkPattern.test(error.cause.message)));
      setErrorTitle(isNetworkError ? "No internet connection" : "Something went wrong");
      setAppState("error");
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (scanResult) {
      const { photoUri, photoBase64 } = scanResult;
      const result = {
        item: scanResult.item,
        bin_id: scanResult.bin,
        reason_en: scanResult.reason,
        reason_da: scanResult.reasonDa,
        alternatives: scanResult.alternatives.map((a) => ({ item: a.item, bin_id: a.bin })),
      };
      void compressForStorage(photoUri)
        .catch(() => null)
        .then((compressed) => {
          void saveScan(photoUri, compressed ?? photoBase64, result);
        });
    }
    setAppState("result");
  };

  const handleDeny = () => {
    setAppState("correction");
  };

  const handleClassify = async (item: string) => {
    try {
      return await callClassifyText(item);
    } catch (error) {
      console.error("[handleClassify] classify-text failed:", error);
      return null;
    }
  };

  const handleCorrection = (correctedItem: string, correctedBin: BinId | null, reason?: string, reasonDa?: string) => {
    if (scanResult) {
      const { photoUri, photoBase64, item, bin } = scanResult;
      void compressForStorage(photoUri)
        .catch(() => null)
        .then((compressed) => {
          void saveCorrection(photoUri, compressed ?? photoBase64, item, bin, correctedItem, correctedBin);
        });
    }

    if (correctedBin) {
      setScanResult((prev) =>
        prev
          ? {
              ...prev,
              item: correctedItem,
              bin: correctedBin,
              reason: reason ?? `You identified this as ${correctedItem}.`,
              reasonDa: reasonDa ?? prev.reasonDa,
            }
          : null
      );
      setAppState("result");
    } else {
      resetToCamera();
    }
  };

  const resetToCamera = () => {
    setAppState("camera");
    setScanResult(null);
    setCapturedPhotoUri(null);
    setErrorTitle("Something went wrong");
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Preparing camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera access is required to use Vertigo.</Text>
        <Pressable
          style={styles.settingsButton}
          onPress={() => {
            Linking.openSettings().catch((error) => {
              console.error("Could not open settings:", error);
              Alert.alert("Unable to open settings", "Please open Settings manually and grant camera access to Vertigo.");
            });
          }}
        >
          <Text style={styles.settingsText}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back" />

      <View
        style={[
          styles.blurBackground,
          { opacity: appState !== "camera" ? 1 : 0 },
        ]}
        pointerEvents={appState === "camera" ? "none" : "auto"}
      >
        {capturedPhotoUri && (
          <Image source={{ uri: capturedPhotoUri }} style={styles.blurImage} blurRadius={20} />
        )}
      </View>

      <ScreenLayer visible={appState === "scanning"}>
        <ScanningOverlay />
      </ScreenLayer>

      <ScreenLayer visible={appState === "confirmation"}>
        {scanResult && (
          <ConfirmationScreen
            photoUri={scanResult.photoUri}
            itemName={scanResult.item}
            onConfirm={handleConfirm}
            onDeny={handleDeny}
          />
        )}
      </ScreenLayer>

      <ScreenLayer visible={appState === "correction"}>
        {scanResult && (
          <CorrectionScreen
            alternatives={scanResult.alternatives}
            onSelect={handleCorrection}
            onClassify={handleClassify}
            onCancel={resetToCamera}
          />
        )}
      </ScreenLayer>

      <ScreenLayer visible={appState === "result"}>
        {scanResult && (
          <ResultScreen
            item={scanResult.item}
            binId={scanResult.bin}
            reason={scanResult.reason}
            onDone={resetToCamera}
          />
        )}
      </ScreenLayer>

      <ScreenLayer visible={appState === "error"}>
        <ErrorOverlay onRetry={resetToCamera} title={errorTitle} />
      </ScreenLayer>

      <ScreenLayer visible={appState === "unidentifiable"}>
        <UnidentifiableOverlay onRetry={resetToCamera} />
      </ScreenLayer>

      {appState === "camera" && (
        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              pressed && styles.captureButtonPressed,
            ]}
            onPress={handleCapture}
            disabled={capturing}
            testID="capture-button"
          />
        </View>
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  blurImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    resizeMode: "cover",
  },
  screenLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "#888",
  },
  captureButtonPressed: {
    backgroundColor: "#ccc",
  },
  text: {
    color: "#fff",
    textAlign: "center",
    padding: 20,
    marginTop: 100,
  },
  settingsButton: {
    alignSelf: "center",
    marginTop: 16,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  settingsText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
