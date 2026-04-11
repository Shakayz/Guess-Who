const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm monorepo: watch all packages under the monorepo root
config.watchFolders = [monorepoRoot];

// pnpm monorepo: resolve modules from both the app and the root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Custom resolver for @imposter/shared subpath imports (Metro doesn't support "exports" natively)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const match = moduleName.match(/^@imposter\/shared\/(.+)$/);
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
