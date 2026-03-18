'use strict';
const fs = require('fs-extra');
const path = require('path');

// Top-level directories created during a fresh install.
// Exported so InstallCommand.cleanInstallDirectory can remove exactly these
// entries on failure rather than blindly wiping all of cwd.
const VERSIONS_DIR = 'versions';
const CONTENT_DIR = 'content';
const installDirs = [VERSIONS_DIR, CONTENT_DIR];

module.exports = function ensureStructure() {
    const cwd = process.cwd();

    for (const dir of installDirs) {
        fs.ensureDirSync(path.resolve(cwd, dir));
    }

    for (const sub of ['apps', 'themes', 'data', 'images', 'logs', 'settings', 'media', 'files', 'public']) {
        fs.ensureDirSync(path.resolve(cwd, CONTENT_DIR, sub));
    }
};
module.exports.installDirs = installDirs;
