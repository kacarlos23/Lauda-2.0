import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../src/services/api";
import { goBackTo } from "../../src/utils/navigation";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Erro", "Por favor, insira seu e-mail.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      Alert.alert("Sucesso", "Se o e-mail existir, um código foi enviado.");
      router.push({ pathname: "/(auth)/reset-password", params: { email } });
    } catch (error: any) {
      const message = error.response?.data?.error || "Erro ao solicitar recuperação de senha.";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white justify-center px-8">
      <View className="mb-10 items-center">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Recuperar Senha</Text>
        <Text className="text-base text-gray-500 text-center">
          Insira seu e-mail para receber o código PIN de recuperação.
        </Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">E-mail</Text>
          <TextInput
            className="w-full h-14 bg-gray-50 rounded-2xl px-5 border border-gray-200 text-gray-900"
            placeholder="Digite seu e-mail"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <TouchableOpacity
          className={`w-full h-14 bg-indigo-600 rounded-2xl items-center justify-center shadow-sm ${
            loading ? "opacity-70" : ""
          }`}
          onPress={handleForgotPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-lg">Enviar código</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full h-14 items-center justify-center mt-2"
          onPress={() => goBackTo(router, "/(auth)/login")}
          disabled={loading}
        >
          <Text className="text-indigo-600 font-medium text-base">Voltar para o login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
