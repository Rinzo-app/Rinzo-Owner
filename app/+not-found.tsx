import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.dark.textTertiary} />
        <Text style={styles.title}>Page not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.dark.background,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  link: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.primary,
  },
});
