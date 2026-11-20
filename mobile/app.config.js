module.exports = ({ config }) => {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV || "production";
  const isStaging = appEnv === "staging" || process.env.LAUDA_ANDROID_VARIANT === "staging";
  const androidPackage = isStaging ? "com.lauda.app.staging" : config.android?.package ?? "com.lauda.app";
  const iosBundleIdentifier = isStaging ? "com.lauda.app.staging" : config.ios?.bundleIdentifier ?? "com.lauda.app";

  return {
    ...config,
    name: isStaging ? "Lauda Testes" : config.name ?? "Lauda",
    ios: {
      ...(config.ios ?? {}),
      bundleIdentifier: iosBundleIdentifier,
    },
    android: {
      ...(config.android ?? {}),
      package: androidPackage,
    },
    extra: {
      ...(config.extra ?? {}),
      appEnv,
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
      },
    },
  };
};
