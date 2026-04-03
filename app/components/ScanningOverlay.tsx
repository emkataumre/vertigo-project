import { useEffect, useRef } from "react";
import { StyleSheet, View, Text, Animated, Easing } from "react-native";

const RING_SIZE = 80;

export default function ScanningOverlay() {
  const rotation = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    });
    fadeIn.start();

    const spin = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();

    return () => {
      fadeIn.stop();
      spin.stop();
    };
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
        <Text style={styles.label}>Identifying</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: 20,
  },
  spinner: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderTopColor: "#fff",
  },
  label: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
});
