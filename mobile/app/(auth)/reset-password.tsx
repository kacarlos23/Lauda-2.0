import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../src/services/api";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!pin.trim() || pin.length !== 6) {
      Alert.alert("Erro", "O PIN deve conter exatamente 6 dígitos.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Erro", "A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Erro", "As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email,
        token: pin,
        newPassword,
      });
      Alert.alert("Sucesso", "Sua senha foi redefinida com sucesso.");
      router.replace("/(auth)/login");
    } catch (error: any) {
      const message = error.response?.data?.error || "Erro ao redefinir a senha.";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white justify-center px-8">
      <View className="mb-10 items-center">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Redefinir Senha</Text>
        <Text className="text-base text-gray-500 text-center">
          Insira o código PIN enviado para {email} e sua nova senha.
        </Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">Código PIN (6 dígitos)</Text>
          <TextInput
            className="w-full h-14 bg-gray-50 rounded-2xl px-5 border border-gray-200 text-gray-900"
            placeholder="Ex: 123456"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            maxLength={6}
            value={pin}
            onChangeText={setPin}
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">Nova Senha</Text>
          <TextInput
            className="w-full h-14 bg-gray-50 rounded-2xl px-5 border border-gray-200 text-gray-900"
            placeholder="Digite a nova senha"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">Confirmar Senha</Text>
          <TextInput
            className="w-full h-14 bg-gray-50 rounded-2xl px-5 border border-gray-200 text-gray-900"
            placeholder="Confirme a nova senha"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        <TouchableOpacity
          className={`w-full h-14 bg-indigo-600 rounded-2xl items-center justify-center shadow-sm mt-4 ${
            loading ? "opacity-70" : ""
          }`}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-lg">Redefinir</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full h-14 items-center justify-center mt-2"
          onPress={() => router.replace("/(auth)/login")}
          disabled={loading}
        >
          <Text className="text-indigo-600 font-medium text-base">Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
