import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { api } from "../../src/services/api";
import { useAuthStore } from "../../src/store/useAuthStore";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const login = useAuthStore((s) => s.login);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.login(email.trim(), password);
      await login(data.token, data.user);
      router.replace("/(tabs)/tracking");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.card}>
        <Text style={s.logo}>🏠</Text>
        <Text style={s.title}>Home Hub</Text>
        <Text style={s.subtitle}>Увійдіть у свій акаунт</Text>

        {error && <Text style={s.error}>{error}</Text>}

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={s.input}
          placeholder="Пароль"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Увійти</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#1f2937", borderRadius: 16, padding: 24 },
  logo: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 24, marginTop: 4 },
  error: { backgroundColor: "#7f1d1d", color: "#fca5a5", padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 },
  input: {
    backgroundColor: "#374151", color: "#fff", borderRadius: 10, padding: 14,
    fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: "#4b5563",
  },
  btn: { backgroundColor: "#3b82f6", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
