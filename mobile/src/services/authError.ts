import { AxiosError } from "axios";

export const LOGIN_REQUEST_TIMEOUT_MS = 30000;

export const AUTH_TIMEOUT_MESSAGE =
  "O servidor demorou mais que o esperado. Verifique sua conexão e tente novamente.";

export const AUTH_NETWORK_MESSAGE =
  "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";

export function authErrorMessage(
  error: unknown,
  fallback = "Erro ao autenticar. Tente novamente.",
): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    const serverMessage = data?.error ?? data?.message;
    if (serverMessage) return serverMessage;

    if (
      error.code === AxiosError.ECONNABORTED ||
      error.code === AxiosError.ETIMEDOUT ||
      error.message.toLowerCase().includes("timeout")
    ) {
      return AUTH_TIMEOUT_MESSAGE;
    }

    if (error.code === AxiosError.ERR_NETWORK || !error.response) {
      return AUTH_NETWORK_MESSAGE;
    }

    return fallback;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
