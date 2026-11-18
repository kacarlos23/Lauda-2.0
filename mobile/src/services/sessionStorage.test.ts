import * as SecureStore from "expo-secure-store";
import { deleteSessionItem, getSessionItem, setSessionItem } from "./sessionStorage";

jest.mock("react-native", () => ({ Platform: { OS: "android" } }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

it("reads the newest token when persistent storage still holds the previous token", async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce("old-token");
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("Save failed"));

  await setSessionItem("refresh_token", "new-token");

  await expect(getSessionItem("refresh_token")).resolves.toBe("new-token");
  expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
});

it("keeps a failed deletion effective until the next token is saved", async () => {
  jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error("Delete failed"));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce("old-token");

  await deleteSessionItem("auth_token");

  await expect(getSessionItem("auth_token")).resolves.toBeNull();
  expect(SecureStore.getItemAsync).not.toHaveBeenCalled();

  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValueOnce("new-token");
  await setSessionItem("auth_token", "new-token");
  await expect(getSessionItem("auth_token")).resolves.toBe("new-token");
});
