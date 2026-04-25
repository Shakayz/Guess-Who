const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm monorepo: only watch workspace packages we actually consume.
// Watching the full monorepoRoot pulls in node_modules/.pnpm, where pnpm's
// transient *_tmp_NNNN dirs make Metro's FallbackWatcher crash on Windows
// (ENOENT in fs.watch). nodeModulesPaths below still handles resolution.
config.watchFolders = [path.resolve(monorepoRoot, "packages/shared")];

// pnpm monorepo: resolve modules from both the app and the root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Force React-related packages to resolve from the mobile app's own node_modules
// (prevents monorepo hoisting from pulling in the wrong React version)
const mobileModules = path.resolve(projectRoot, "node_modules");
config.resolver.extraNodeModules = {
  react: path.resolve(mobileModules, "react"),
  "react-native": path.resolve(mobileModules, "react-native"),
  "react/jsx-runtime": path.resolve(mobileModules, "react/jsx-runtime"),
  "react/jsx-dev-runtime": path.resolve(mobileModules, "react/jsx-dev-runtime"),
};

// Custom resolver for @red-handed/shared subpath imports (Metro doesn't support "exports" natively)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const match = moduleName.match(/^@red-handed\/shared\/(.+)$/);
  if (match) {
    const subpath = match[1];
    return context.resolveRequest(
      context,
      path.resolve(monorepoRoot, "packages/shared/src", subpath),
      platform,
    );
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
