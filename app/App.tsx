import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import ScanningOverlay from "./components/ScanningOverlay";
import ConfirmationScreen from "./components/ConfirmationScreen";

type AppState = "camera" | "scanning" | "confirmation";

interface ScanResult {
  photoUri: string;
  item: string;
  bin: string;
  reason: string;
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [appState, setAppState] = useState<AppState>("camera");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true });
      if (photo) {
        setAppState("scanning");
        // TODO: send to identify endpoint — for now simulate with timeout
        console.log("Photo captured:", photo.uri);
        setTimeout(() => {
          setScanResult({
            photoUri: photo.uri,
            item: "Coffee filter",
            bin: "madaffald",
            reason: "Used coffee filters are organic waste and go in the green bio bag.",
          });
          setAppState("confirmation");
        }, 2000);
      }
    } catch {
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    // TODO: navigate to result screen
    console.log("Confirmed:", scanResult?.item);
    resetToCamera();
  };

  const handleDeny = () => {
    // TODO: navigate to correction flow
    console.log("Denied:", scanResult?.item);
    resetToCamera();
  };

  const resetToCamera = () => {
    setAppState("camera");
    setScanResult(null);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera access is required to use Vertigo.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back" />
      {appState === "scanning" && <ScanningOverlay />}
      {appState === "confirmation" && scanResult && (
        <ConfirmationScreen
          photoUri={scanResult.photoUri}
          itemName={scanResult.item}
          onConfirm={handleConfirm}
          onDeny={handleDeny}
        />
      )}
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
});
