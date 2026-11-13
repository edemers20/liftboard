const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const engineRoot = path.resolve(projectRoot, "../../packages/engine");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);
config.watchFolders = [engineRoot];

module.exports = config;
