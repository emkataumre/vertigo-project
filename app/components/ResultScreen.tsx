import { StyleSheet, View, Text, Pressable } from "react-native";
import { BINS_BY_ID, type BinId } from "../constants/bins";

interface ResultScreenProps {
  item: string;
  binId: BinId;
  reason: string;
  onDone: () => void;
}

export default function ResultScreen({
  item,
  binId,
  reason,
  onDone,
}: ResultScreenProps) {
  const bin = BINS_BY_ID[binId];
  const binColor = bin?.color ?? "#888";
  const binName = bin?.nameEn ?? binId;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.binBadge, { backgroundColor: binColor }]}>
          <Text style={styles.binName}>{binName}</Text>
        </View>
        <Text style={styles.item}>{item}</Text>
        <Text style={styles.reason}>{reason}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.doneButton,
          pressed && styles.doneButtonPressed,
        ]}
        onPress={onDone}
      >
        <Text style={styles.doneText}>Scan Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
    gap: 20,
  },
  binBadge: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 16,
  },
  binName: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  item: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 17,
    fontWeight: "500",
  },
  reason: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  doneButton: {
    position: "absolute",
    bottom: 50,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  doneButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  doneText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
