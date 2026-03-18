'use strict';
const expect = require('chai').expect;
const os = require('os');
const path = require('path');
const proxyquire = require('proxyquire').noPreserveCache();
const sinon = require('sinon');

const modulePath = '../../../lib/utils/get-cache-dir';

describe('Unit: Utils > getCacheDir', function () {
    let originalEnv;

    beforeEach(function () {
        originalEnv = process.env.GHOST_CACHE_DIR;
        delete process.env.GHOST_CACHE_DIR;
    });

    afterEach(function () {
        if (originalEnv !== undefined) {
            process.env.GHOST_CACHE_DIR = originalEnv;
        } else {
            delete process.env.GHOST_CACHE_DIR;
        }
        sinon.restore();
    });

    it('returns GHOST_CACHE_DIR env var when set', function () {
        process.env.GHOST_CACHE_DIR = '/custom/cache/dir';
        const getCacheDir = require(modulePath);
        expect(getCacheDir()).to.equal('/custom/cache/dir');
    });

    it('returns cacheDir from global config when set', function () {
        const configExistsStub = sinon.stub().returns({cacheDir: '/config/cache/dir'});
        const getCacheDir = proxyquire(modulePath, {
            './config': {exists: configExistsStub}
        });
        expect(getCacheDir()).to.equal('/config/cache/dir');
    });

    it('returns default cache dir when env var and global config are not set', function () {
        const configExistsStub = sinon.stub().returns({});
        const getCacheDir = proxyquire(modulePath, {
            './config': {exists: configExistsStub}
        });
        expect(getCacheDir()).to.equal(path.join(os.homedir(), '.ghost', 'cache'));
    });

    it('returns default cache dir when global config file does not exist', function () {
        const configExistsStub = sinon.stub().returns(false);
        const getCacheDir = proxyquire(modulePath, {
            './config': {exists: configExistsStub}
        });
        expect(getCacheDir()).to.equal(path.join(os.homedir(), '.ghost', 'cache'));
    });

    it('prefers GHOST_CACHE_DIR env var over global config', function () {
        process.env.GHOST_CACHE_DIR = '/env/cache';
        const configExistsStub = sinon.stub().returns({cacheDir: '/config/cache'});
        const getCacheDir = proxyquire(modulePath, {
            './config': {exists: configExistsStub}
        });
        expect(getCacheDir()).to.equal('/env/cache');
        expect(configExistsStub.called).to.be.false;
    });
});
