import { StyleSheet, View, Text, Image, Pressable } from "react-native";

interface ConfirmationScreenProps {
  photoUri: string;
  itemName: string;
  onConfirm: () => void;
  onDeny: () => void;
}

export default function ConfirmationScreen({
  photoUri,
  itemName,
  onConfirm,
  onDeny,
}: ConfirmationScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
        <Text style={styles.question}>{itemName}?</Text>
        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.confirmButton,
              pressed && styles.confirmButtonPressed,
            ]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmText}>Yes</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.denyButton,
              pressed && styles.denyButtonPressed,
            ]}
            onPress={onDeny}
          >
            <Text style={styles.denyText}>No</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 28,
  },
  preview: {
    width: 240,
    height: 240,
    borderRadius: 16,
    backgroundColor: "#1a1a1a",
  },
  question: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  buttons: {
    flexDirection: "row",
    gap: 16,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  confirmButton: {
    backgroundColor: "#fff",
  },
  confirmButtonPressed: {
    backgroundColor: "#e0e0e0",
  },
  confirmText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "600",
  },
  denyButton: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  denyButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  denyText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
