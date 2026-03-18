'use strict';
const fs = require('fs-extra');
const Command = require('../command');
const getCacheDir = require('../utils/get-cache-dir');

class CacheCommand extends Command {
    run(argv) {
        const cacheDir = getCacheDir();

        // Show path when explicitly requested, or when no other action is given
        if (argv.path || !argv.clear) {
            this.ui.log(cacheDir);
        }

        if (argv.clear) {
            if (!fs.existsSync(cacheDir)) {
                this.ui.log('Cache is already empty.', 'cyan');
                return;
            }

            fs.removeSync(cacheDir);
            this.ui.log('Download cache cleared.', 'green');
        }
    }
}

CacheCommand.description = 'Manage the Ghost download cache';
CacheCommand.global = true;
CacheCommand.options = {
    path: {
        description: 'Print the cache directory path',
        type: 'boolean'
    },
    clear: {
        description: 'Delete all cached tarballs',
        type: 'boolean'
    }
};

module.exports = CacheCommand;
