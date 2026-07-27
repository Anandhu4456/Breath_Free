import { useState, useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Animated, StyleSheet, View, Text } from "react-native";

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const splashFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in and scale up the logo elements
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // After a brief showcase, fade out the entire splash screen overlay
    const timer = setTimeout(() => {
      Animated.timing(splashFadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="light" />

      {showSplash && (
        <Animated.View style={[styles.splashContainer, { opacity: splashFadeAnim }]}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Animated.Image
              source={require("../assets/images/bended_cigarette.png")}
              style={styles.logoImage}
            />
            <Text style={styles.title}>Breathe Free</Text>
            <Text style={styles.subtitle}>JUST BREATHE.</Text>
          </Animated.View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#090D16",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 220,
    height: 220,
    resizeMode: "contain",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 20,
  },
  subtitle: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 4,
    marginTop: 8,
  },
});
