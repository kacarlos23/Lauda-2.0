const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const config = getDefaultConfig(projectRoot);

// The permission contract is shared with the backend from the workspace root.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Router 6 imports the named query-string API. Version 9 exposes it in base.js.
const expoRouterRoot = path.dirname(require.resolve("expo-router/package.json"));
const queryStringBase = path.join(
  path.dirname(require.resolve("query-string", { paths: [expoRouterRoot] })),
  "base.js",
);
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isRouterQueryString =
    moduleName === "query-string" && context.originModulePath.startsWith(expoRouterRoot + path.sep);
  return (defaultResolveRequest ?? context.resolveRequest)(
    context,
    isRouterQueryString ? queryStringBase : moduleName,
    platform,
  );
};

module.exports = config;
