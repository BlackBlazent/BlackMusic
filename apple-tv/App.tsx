import React from "react";
import { SafeAreaView, Text, View } from "react-native";
// Example of sharing pure logic with the main app (no move, no copy):
import { decideTransfer } from "main-src/lib/sync/transferPolicy";

/**
 * STARTING POINT ONLY. The real tvOS UI (D-pad focus, player, library) still has to be built here.
 * React Router DOM needs the browser DOM, so screens in this app use React Navigation, not the web router.
 */
export default function App() {
  const hint = decideTransfer({ mode: "auto", bytes: 12e6, downlinkMbps: 25, saveData: false, metered: false, freeBytes: null, budgetUsed: 0, alreadyCopiedBytes: 0 });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#282c34" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 48, color: "#61afef", fontWeight: "700" }}>BlackMusic</Text>
        <Text style={{ fontSize: 26, color: "#abb2bf", marginTop: 12 }}>Apple TV — work in progress</Text>
        <Text style={{ fontSize: 18, color: "#5c6370", marginTop: 24 }}>{hint.reason}</Text>
      </View>
    </SafeAreaView>
  );
}
