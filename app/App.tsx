import { type ReactNode, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Image, Pressable, Alert, Linking } from "react-native";
import { BlurView } from "expo-blur";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import ScanningOverlay from "./components/ScanningOverlay";
import ConfirmationScreen from "./components/ConfirmationScreen";
import ResultScreen from "./components/ResultScreen";
import CorrectionScreen, { type Alternative } from "./components/CorrectionScreen";
import type { BinId } from "./constants/bins";
import { saveScan } from "./lib/saveScan";

type AppState = "camera" | "scanning" | "confirmation" | "result" | "correction";

interface ScanResult {
  photoUri: string;
  item: string;
  bin: BinId;
  reason: string;
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
      {children}
    </View>
  );
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [appState, setAppState] = useState<AppState>("camera");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission().catch((error) => {
        console.error("Camera permission request failed:", error);
        Alert.alert(
          "Permission error",
          "Could not request camera access. Please restart the app or enable it in Settings.",
          [{ text: "Open Settings", onPress: () => Linking.openSettings().catch(() => {}) }]
        );
      });
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true });
      if (photo) {
        setCapturedPhotoUri(photo.uri);
        setAppState("scanning");
        // TODO: send photo to the identify endpoint and await the real IdentifyResponse.
        // Note: IdentifyResponse does not include `item` or `alternatives` — a decision is
        // needed before wiring this in: extend the endpoint to return them, derive them
        // client-side from the response, or revise the ScanResult interface to remove them.
        // For now, simulate the full flow with a timeout.
        console.log("Photo captured:", photo.uri);
        scanTimeoutRef.current = setTimeout(() => {
          const result = {
            photoUri: photo.uri,
            item: "Coffee filter",
            bin: "madaffald" as BinId,
            reason: "Used coffee filters are organic waste and go in the green bio bag.",
            alternatives: [
              { item: "Coffee bag (plastic)", bin: "restaffald" as BinId },
              { item: "Coffee capsule (aluminium)", bin: "metal" as BinId },
              { item: "Paper cup", bin: "papir" as BinId },
            ],
          };
          setScanResult(result);
          setAppState("confirmation");
          // Fire-and-forget background save — UI is never blocked. Failures are logged
          // to console only and are intentionally not surfaced to the user.
          // TODO: when wiring in the identify endpoint, remove the entire setTimeout simulation
          // above and replace it with a real HTTP call. Pass the returned IdentifyResponse
          // directly to saveScan. Keep in mind that IdentifyResponse has no `item` or
          // `alternatives` fields — those will need to be sourced separately (see TODO above).
          void saveScan(photo.uri, photo.base64 ?? "", {
            bin_id: result.bin,
            reason_en: result.reason,
            reason_da: result.reason,
            alternative_bin_id: null,
          });
        }, 2000);
      } else {
        Alert.alert("Capture failed", "The camera did not return a photo. Please try again.");
      }
    } catch (error) {
      console.error("handleCapture failed:", error);
      Alert.alert("Capture failed", "Something went wrong. Please try again.");
      resetToCamera();
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    setAppState("result");
  };

  const handleDeny = () => {
    setAppState("correction");
  };

  const handleCorrection = (item: string, bin: BinId | null) => {
    // TODO: call /correct endpoint and upload photo
    console.log("Correction:", {
      predicted: scanResult?.item,
      predictedBin: scanResult?.bin,
      correctedItem: item,
      correctedBin: bin,
    });
    resetToCamera();
  };

  const resetToCamera = () => {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    setAppState("camera");
    setScanResult(null);
    setCapturedPhotoUri(null);
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
          <Image source={{ uri: capturedPhotoUri }} style={styles.blurImage} />
        )}
        <BlurView intensity={80} tint="dark" style={styles.blurFill} />
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

      {appState === "camera" && (
        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              pressed && styles.captureButtonPressed,
            ]}
            onPress={handleCapture}
            disabled={capturing}
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
  blurFill: {
    ...StyleSheet.absoluteFillObject,
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
