import { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";
import type { BinId } from "../constants/bins";

interface Alternative {
  item: string;
  bin: BinId;
}

interface CorrectionScreenProps {
  alternatives: Alternative[];
  onSelect: (corrected: string) => void;
  onCancel: () => void;
}

export default function CorrectionScreen({
  alternatives,
  onSelect,
  onCancel,
}: CorrectionScreenProps) {
  const [otherText, setOtherText] = useState("");

  const handleSubmitOther = () => {
    const trimmed = otherText.trim();
    if (trimmed) {
      onSelect(trimmed);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>What is it?</Text>
        <Text style={styles.subtitle}>Select the correct item</Text>

        <View style={styles.alternatives}>
          {alternatives.map((alt) => (
            <Pressable
              key={`${alt.item}-${alt.bin}`}
              style={({ pressed }) => [
                styles.altButton,
                pressed && styles.altButtonPressed,
              ]}
              onPress={() => onSelect(alt.item)}
            >
              <Text style={styles.altText}>{alt.item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.otherLabel}>Other</Text>
        <View style={styles.otherRow}>
          <TextInput
            style={styles.otherInput}
            placeholder="Type the item name"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            value={otherText}
            onChangeText={setOtherText}
            returnKeyType="send"
            onSubmitEditing={handleSubmitOther}
          />
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              !otherText.trim() && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitOther}
            disabled={!otherText.trim()}
          >
            <Text style={styles.submitText}>Send</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.cancelButtonPressed,
          ]}
          onPress={() => {
            Keyboard.dismiss();
            onCancel();
          }}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
  },
  alternatives: {
    gap: 10,
  },
  altButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  altButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  altText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "500",
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 24,
  },
  otherLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  otherRow: {
    flexDirection: "row",
    gap: 10,
  },
  otherInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#fff",
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  submitButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: "center",
  },
  submitButtonPressed: {
    backgroundColor: "#e0e0e0",
  },
  submitButtonDisabled: {
    opacity: 0.3,
  },
  submitText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    marginTop: 24,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelButtonPressed: {
    opacity: 0.6,
  },
  cancelText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 15,
  },
});
