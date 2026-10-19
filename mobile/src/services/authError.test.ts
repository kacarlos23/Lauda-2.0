import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import {
  AUTH_NETWORK_MESSAGE,
  AUTH_TIMEOUT_MESSAGE,
  authErrorMessage,
} from "./authError";

function axiosError(code: string, response?: { data: { error?: string }; status: number }) {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };
  return new AxiosError(
    code === AxiosError.ECONNABORTED ? "timeout of 30000ms exceeded" : "Network Error",
    code,
    config,
    {},
    response
      ? {
          config,
          data: response.data,
          headers: {},
          status: response.status,
          statusText: "Error",
        }
      : undefined,
  );
}

describe("authErrorMessage", () => {
  it("diferencia timeout de credenciais inválidas", () => {
    expect(authErrorMessage(axiosError(AxiosError.ECONNABORTED))).toBe(AUTH_TIMEOUT_MESSAGE);
  });

  it("diferencia indisponibilidade de rede de credenciais inválidas", () => {
    expect(authErrorMessage(axiosError(AxiosError.ERR_NETWORK))).toBe(AUTH_NETWORK_MESSAGE);
  });

  it("preserva a mensagem enviada pelo backend", () => {
    expect(authErrorMessage(axiosError(AxiosError.ERR_BAD_REQUEST, {
      status: 401,
      data: { error: "Credenciais inválidas" },
    }))).toBe("Credenciais inválidas");
  });
});
