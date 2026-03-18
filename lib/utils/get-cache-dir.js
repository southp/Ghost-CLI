'use strict';
const os = require('os');
const path = require('path');
const Config = require('./config');

const GLOBAL_DIR = path.join(os.homedir(), '.ghost');

function getCacheDir() {
    if (process.env.GHOST_CACHE_DIR) {
        return process.env.GHOST_CACHE_DIR;
    }

    const globalConfigFile = path.join(GLOBAL_DIR, 'config');
    const configValues = Config.exists(globalConfigFile);
    if (configValues && configValues.cacheDir) {
        return configValues.cacheDir;
    }

    return path.join(GLOBAL_DIR, 'cache');
}

module.exports = getCacheDir;
