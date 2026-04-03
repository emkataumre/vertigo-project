import { StyleSheet, View, Text, Pressable } from "react-native";

interface ErrorOverlayProps {
  onRetry: () => void;
  title?: string;
}

export default function ErrorOverlay({ onRetry, title = "Something went wrong" }: ErrorOverlayProps) {
  return (
    <View style={styles.container} testID="error-overlay">
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>
          Please try again.
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.retryButton,
          pressed && styles.retryButtonPressed,
        ]}
        onPress={onRetry}
        testID="error-retry-button"
      >
        <Text style={styles.retryText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  message: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    position: "absolute",
    bottom: 50,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  retryButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  retryText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
