import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { notificationService } from "./notificationService";
import { deleteSessionItem, getSessionItem, setSessionItem } from "./sessionStorage";
import { colors } from "../theme";

const DEVICE_ID_KEY = "push_device_id";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function easProjectId() {
  const constants = Constants as typeof Constants & { easConfig?: { projectId?: string } };
  return constants.expoConfig?.extra?.eas?.projectId ?? constants.easConfig?.projectId;
}

export async function enablePushNotifications() {
  if (Platform.OS === "web") throw new Error("Push do sistema está disponível apenas no aplicativo Android ou iOS.");
  if (!Device.isDevice) throw new Error("Use um dispositivo físico com development build ou build de produção para ativar push.");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("schedules", {
      name: "Escalas",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.primary,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("A permissão de notificações não foi concedida.");

  const projectId = easProjectId();
  if (!projectId) throw new Error("O projectId do EAS ainda não foi configurado neste build.");
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const device = await notificationService.registerDevice({
    expoPushToken: token.data,
    platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
    appVersion: Constants.expoConfig?.version,
  });
  await setSessionItem(DEVICE_ID_KEY, device.id);
  return device;
}

export async function disablePushNotifications() {
  const deviceId = await getSessionItem(DEVICE_ID_KEY);
  if (!deviceId) return;
  try {
    await notificationService.removeDevice(deviceId);
  } finally {
    await deleteSessionItem(DEVICE_ID_KEY);
  }
}

async function refreshEnabledPushRegistration() {
  const previousDeviceId = await getSessionItem(DEVICE_ID_KEY);
  if (!previousDeviceId || Platform.OS === "web" || !Device.isDevice) return;
  const projectId = easProjectId();
  if (!projectId) return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const device = await notificationService.registerDevice({
    expoPushToken: token.data,
    platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
    appVersion: Constants.expoConfig?.version,
  });
  if (previousDeviceId !== device.id) {
    try {
      await notificationService.removeDevice(previousDeviceId);
    } catch {
      // The old registration may already have been disabled server-side.
    }
  }
  await setSessionItem(DEVICE_ID_KEY, device.id);
}

export function addPushTokenRotationListener() {
  if (Platform.OS === "web") return { remove: () => undefined };
  return Notifications.addPushTokenListener(() => { void refreshEnabledPushRegistration(); });
}

export function addPushResponseListener(listener: (data: Record<string, unknown>) => void) {
  if (Platform.OS === "web") return { remove: () => undefined };
  return Notifications.addNotificationResponseReceivedListener((response) => {
    listener(response.notification.request.content.data as Record<string, unknown>);
  });
}
