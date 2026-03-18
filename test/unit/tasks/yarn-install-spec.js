'use strict';
const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire').noPreserveCache();
const Promise = require('bluebird');
const {setupTestFolder, cleanupTestFolders} = require('../../utils/test-folder');
const path = require('path');
const fs = require('fs');
const {Observable, isObservable} = require('rxjs');

const modulePath = '../../../lib/tasks/yarn-install';
const errors = require('../../../lib/errors');

describe('Unit: Tasks > yarn-install', function () {
    beforeEach(() => {
        process.env = {};
    });

    after(() => {
        cleanupTestFolders();
    });

    it('base function calls subtasks and yarn util', function () {
        const yarnStub = sinon.stub().returns(new Observable(o => o.complete()));
        const yarnInstall = proxyquire(modulePath, {
            '../utils/yarn': yarnStub
        });
        const subTasks = yarnInstall.subTasks;
        const ctx = {installPath: '/var/www/ghost/versions/1.5.0'};
        const listrStub = sinon.stub().callsFake((tasks) => {
            // dist + cacheRead + download + yarn = 4
            expect(tasks).to.have.length(4);

            return Promise.each(tasks, (task) => {
                if (task.enabled && !task.enabled()) {
                    return;
                }
                const result = task.task(ctx);
                return isObservable(result) ? result.toPromise() : result;
            });
        });

        const distTaskStub = sinon.stub(subTasks, 'dist').resolves();
        const cacheReadStub = sinon.stub(subTasks, 'cacheRead').resolves();
        const downloadTaskStub = sinon.stub(subTasks, 'download');

        return yarnInstall({listr: listrStub}).then(() => {
            expect(listrStub.calledOnce).to.be.true;
            expect(distTaskStub.calledOnce).to.be.true;
            expect(cacheReadStub.calledOnce).to.be.true;
            expect(downloadTaskStub.calledOnce).to.be.true;
            expect(yarnStub.calledOnce).to.be.true;
            expect(yarnStub.args[0][0]).to.deep.equal(['install', '--no-emoji', '--no-progress']);
            expect(yarnStub.args[0][1]).to.deep.equal({
                cwd: '/var/www/ghost/versions/1.5.0',
                env: {NODE_ENV: 'production', YARN_IGNORE_PATH: 'true'},
                observe: true,
                verbose: false
            });
        });
    });

    it('base function calls subtasks and yarn util correctly with GHOST_NODE_VERISON_CHECK set', function () {
        const yarnStub = sinon.stub().returns(new Observable(o => o.complete()));
        const yarnInstall = proxyquire(modulePath, {
            '../utils/yarn': yarnStub
        });
        const subTasks = yarnInstall.subTasks;
        const ctx = {installPath: '/var/www/ghost/versions/1.5.0'};
        const listrStub = sinon.stub().callsFake((tasks) => {
            expect(tasks).to.have.length(4);

            return Promise.each(tasks, (task) => {
                if (task.enabled && !task.enabled()) {
                    return;
                }
                const result = task.task(ctx);
                return isObservable(result) ? result.toPromise() : result;
            });
        });

        const distTaskStub = sinon.stub(subTasks, 'dist').resolves();
        const cacheReadStub = sinon.stub(subTasks, 'cacheRead').resolves();
        const downloadTaskStub = sinon.stub(subTasks, 'download');

        process.env.GHOST_NODE_VERSION_CHECK = 'false';

        return yarnInstall({listr: listrStub}).then(() => {
            expect(listrStub.calledOnce).to.be.true;
            expect(distTaskStub.calledOnce).to.be.true;
            expect(cacheReadStub.calledOnce).to.be.true;
            expect(downloadTaskStub.calledOnce).to.be.true;
            expect(yarnStub.calledOnce).to.be.true;
            expect(yarnStub.args[0][0]).to.deep.equal(['install', '--no-emoji', '--no-progress', '--ignore-engines']);
            expect(yarnStub.args[0][1]).to.deep.equal({
                cwd: '/var/www/ghost/versions/1.5.0',
                env: {NODE_ENV: 'production', YARN_IGNORE_PATH: 'true'},
                observe: true,
                verbose: false
            });
        });
    });

    it('base function can take zip file', function () {
        const decompressStub = sinon.stub().resolves();
        const listrStub = sinon.stub().resolves();
        const yarnInstall = proxyquire(modulePath, {
            decompress: decompressStub
        });

        return yarnInstall({listr: listrStub}, 'test.zip').then(() => {
            const ctx = {installPath: '/var/www/ghost'};
            expect(listrStub.calledOnce).to.be.true;

            const tasks = listrStub.args[0][0];
            // archive path: extract + yarn = 2 (no cache tasks)
            expect(tasks).to.have.length(2);

            tasks[0].task(ctx);

            expect(decompressStub.called).to.be.true;
            expect(decompressStub.calledWith('test.zip','/var/www/ghost')).to.be.true;
        });
    });

    it('catches errors from yarn and cleans up install folder', function () {
        const yarnStub = sinon.stub().returns(new Observable(o => o.error(new Error('an error occurred'))));
        const yarnInstall = proxyquire(modulePath, {
            '../utils/yarn': yarnStub
        });
        const subTasks = yarnInstall.subTasks;
        const env = setupTestFolder();
        const ctx = {installPath: env.dir};
        const listrStub = sinon.stub().callsFake((tasks) => {
            expect(tasks).to.have.length(4);

            return Promise.each(tasks, (task) => {
                if (task.enabled && !task.enabled()) {
                    return;
                }
                const result = task.task(ctx);
                return isObservable(result) ? result.toPromise() : result;
            });
        });

        const distTaskStub = sinon.stub(subTasks, 'dist').resolves();
        const cacheReadStub = sinon.stub(subTasks, 'cacheRead').resolves();
        const downloadTaskStub = sinon.stub(subTasks, 'download');

        return yarnInstall({listr: listrStub, verbose: true}).then(() => {
            expect(false, 'error should have been thrown').to.be.true;
        }).catch((error) => {
            expect(error.message).to.equal('an error occurred');
            expect(listrStub.calledOnce).to.be.true;
            expect(distTaskStub.calledOnce).to.be.true;
            expect(cacheReadStub.calledOnce).to.be.true;
            expect(downloadTaskStub.calledOnce).to.be.true;
            expect(yarnStub.calledOnce).to.be.true;
            expect(yarnStub.args[0][0]).to.deep.equal(['install', '--no-emoji', '--no-progress']);
            expect(yarnStub.args[0][1]).to.deep.equal({
                cwd: env.dir,
                env: {NODE_ENV: 'production', YARN_IGNORE_PATH: 'true'},
                observe: true,
                verbose: true
            });
            expect(fs.existsSync(env.dir)).to.be.false;
        });
    });

    it('--no-cache disables the cacheRead task and passes noCache to download', function () {
        const yarnStub = sinon.stub().returns(new Observable(o => o.complete()));
        const yarnInstall = proxyquire(modulePath, {
            '../utils/yarn': yarnStub
        });
        const subTasks = yarnInstall.subTasks;
        const ctx = {installPath: '/var/www/ghost/versions/1.5.0'};
        let cacheReadEnabled;
        const listrStub = sinon.stub().callsFake((tasks) => {
            cacheReadEnabled = tasks[1].enabled();
            return Promise.each(tasks, (task) => {
                if (task.enabled && !task.enabled()) {
                    return;
                }
                const result = task.task(ctx);
                return isObservable(result) ? result.toPromise() : result;
            });
        });

        sinon.stub(subTasks, 'dist').resolves();
        const cacheReadStub = sinon.stub(subTasks, 'cacheRead').resolves();
        const downloadTaskStub = sinon.stub(subTasks, 'download');

        return yarnInstall({listr: listrStub}, null, {noCache: true}).then(() => {
            expect(cacheReadEnabled).to.be.false;
            expect(cacheReadStub.called).to.be.false;
            expect(downloadTaskStub.calledOnce).to.be.true;
            expect(downloadTaskStub.args[0][1]).to.deep.equal({noCache: true});
        });
    });

    describe('dist subtask', function () {
        it('rejects if Ghost version isn\'t compatible with the current Node version and GHOST_NODE_VERISON_CHECK is not set', function () {
            const data = {
                engines: {node: '^0.10.0'},
                dist: {shasum: 'asdf1234', tarball: 'something.tgz'}
            };
            const infoStub = sinon.stub().resolves(data);
            const dist = proxyquire(modulePath, {
                'package-json': infoStub
            }).subTasks.dist;
            const ctx = {version: '1.5.0', agent: false};

            return dist(ctx).then(() => {
                expect(false, 'error should have been thrown').to.be.true;
            }).catch((error) => {
                expect(error).to.be.an.instanceof(errors.SystemError);
                expect(error.message).to.equal(`Ghost v1.5.0 is not compatible with the current Node version. Your node version is ${process.versions.node}, but Ghost v1.5.0 requires ^0.10.0`);
                expect(infoStub.calledOnce).to.be.true;
                expect(infoStub.calledWithExactly('ghost', {version: '1.5.0', agent: false})).to.be.true;
            });
        });

        it('resolves if Ghost version isn\'t compatible with the current Node version and GHOST_NODE_VERISON_CHECK is set', function () {
            const data = {
                engines: {node: '^0.10.0'},
                dist: {shasum: 'asdf1234', tarball: 'something.tgz'}
            };
            const infoStub = sinon.stub().resolves(data);
            const dist = proxyquire(modulePath, {
                'package-json': infoStub
            }).subTasks.dist;
            const ctx = {version: '1.5.0', agent: false};
            process.env.GHOST_NODE_VERSION_CHECK = 'false';

            return dist(ctx).then(() => {
                delete process.env.GHOST_NODE_VERSION_CHECK;
                expect(infoStub.calledOnce).to.be.true;
                expect(infoStub.calledWithExactly('ghost', {version: '1.5.0', agent: false})).to.be.true;
                expect(ctx).to.deep.equal({
                    agent: false,
                    version: '1.5.0',
                    shasum: 'asdf1234',
                    tarball: 'something.tgz'
                });
            }).catch((error) => {
                delete process.env.GHOST_NODE_VERSION_CHECK;
                return Promise.reject(error);
            });
        });

        it('rejects if Ghost version isn\'t compatible with the current CLI version', function () {
            const data = {
                engines: {node: process.versions.node, cli: '^0.0.1'},
                dist: {shasum: 'asdf1234', tarball: 'something.tgz'}
            };
            const infoStub = sinon.stub().resolves(data);
            const dist = proxyquire(modulePath, {
                'package-json': infoStub,
                '../../package.json': {version: '1.0.0'}
            }).subTasks.dist;
            const ctx = {version: '1.5.0', agent: false};

            return dist(ctx).then(() => {
                expect(false, 'error should have been thrown').to.be.true;
            }).catch((error) => {
                expect(error).to.be.an.instanceof(errors.SystemError);
                expect(error.message).to.equal(`Ghost v1.5.0 is not compatible with this version of the CLI. Your CLI version is 1.0.0, but Ghost v1.5.0 requires ^0.0.1`);
                expect(infoStub.calledOnce).to.be.true;
                expect(infoStub.calledWithExactly('ghost', {version: '1.5.0', agent: false})).to.be.true;
            });
        });

        it('resolves if Ghost version isn\'t compatible with CLI version, but CLI is a prerelease version', function () {
            const data = {
                engines: {node: process.versions.node, cli: '^1.9.0'},
                dist: {shasum: 'asdf1234', tarball: 'something.tgz'}
            };
            const infoStub = sinon.stub().resolves(data);
            const dist = proxyquire(modulePath, {
                'package-json': infoStub,
                '../../package.json': {version: '1.10.0-beta.0'}
            }).subTasks.dist;
            const ctx = {version: '1.5.0', agent: false};

            return dist(ctx).then(() => {
                expect(infoStub.calledOnce).to.be.true;
                expect(infoStub.calledWithExactly('ghost', {version: '1.5.0', agent: false})).to.be.true;
                expect(ctx).to.deep.equal({
                    agent: false,
                    version: '1.5.0',
                    shasum: 'asdf1234',
                    tarball: 'something.tgz'
                });
            });
        });

        it('adds shasum and tarball values to context', function () {
            const data = {dist: {shasum: 'asdf1234', tarball: 'something.tgz'}};
            const infoStub = sinon.stub().resolves(data);
            const dist = proxyquire(modulePath, {
                'package-json': infoStub
            }).subTasks.dist;
            const ctx = {version: '1.5.0', agent: false};

            return dist(ctx).then(() => {
                expect(infoStub.calledOnce).to.be.true;
                expect(infoStub.calledWithExactly('ghost', {version: '1.5.0', agent: false})).to.be.true;
                expect(ctx).to.deep.equal({
                    agent: false,
                    version: '1.5.0',
                    shasum: 'asdf1234',
                    tarball: 'something.tgz'
                });
            });
        });
    });

    describe('cacheRead subtask', function () {
        it('does nothing on cache miss', async function () {
            const existsStub = sinon.stub().returns(false);
            const cacheRead = proxyquire(modulePath, {
                'fs-extra': {existsSync: existsStub},
                '../utils/get-cache-dir': () => '/ghost/cache'
            }).subTasks.cacheRead;
            const onCacheHit = sinon.stub();
            const ctx = {version: '5.0.0', shasum: 'abc123'};

            await cacheRead(ctx, {onCacheHit});

            expect(ctx.cachedData).to.be.undefined;
            expect(onCacheHit.called).to.be.false;
        });

        it('sets cachedData and calls onCacheHit callback on cache hit with valid shasum', async function () {
            const fakeData = Buffer.from('tarball content');
            const existsStub = sinon.stub().returns(true);
            const readFileStub = sinon.stub().returns(fakeData);
            const shasumStub = sinon.stub().returns('abc123');
            const cacheRead = proxyquire(modulePath, {
                'fs-extra': {existsSync: existsStub, readFileSync: readFileStub},
                shasum: shasumStub,
                '../utils/get-cache-dir': () => '/ghost/cache'
            }).subTasks.cacheRead;
            const onCacheHit = sinon.stub();
            const ctx = {version: '5.0.0', shasum: 'abc123'};

            await cacheRead(ctx, {onCacheHit});

            expect(ctx.cachedData).to.equal(fakeData);
            expect(onCacheHit.calledOnce).to.be.true;
        });

        it('removes corrupt cache file and skips on shasum mismatch', async function () {
            const fakeData = Buffer.from('corrupted tarball');
            const existsStub = sinon.stub().returns(true);
            const readFileStub = sinon.stub().returns(fakeData);
            const shasumStub = sinon.stub().returns('badshasum');
            const removeStub = sinon.stub();
            const cacheRead = proxyquire(modulePath, {
                'fs-extra': {existsSync: existsStub, readFileSync: readFileStub, removeSync: removeStub},
                shasum: shasumStub,
                '../utils/get-cache-dir': () => '/ghost/cache'
            }).subTasks.cacheRead;
            const onCacheHit = sinon.stub();
            const ctx = {version: '5.0.0', shasum: 'abc123'};

            await cacheRead(ctx, {onCacheHit});

            expect(ctx.cachedData).to.be.undefined;
            expect(removeStub.calledWith('/ghost/cache/ghost-5.0.0.tgz')).to.be.true;
            expect(onCacheHit.called).to.be.false;
        });
    });

    describe('download subtask', function () {
        it('rejects if shasum does not match the sha hash of the downloaded data', function () {
            const downloadStub = sinon.stub().resolves({downloadedData: true});
            const shasumStub = sinon.stub().returns('badshasum');
            const downloadTask = proxyquire(modulePath, {
                download: downloadStub,
                shasum: shasumStub
            }).subTasks.download;
            const ctx = {
                tarball: 'something.tgz',
                shasum: 'asdf1234'
            };

            return downloadTask(ctx, {noCache: true}).then(() => {
                expect(false, 'error should have been thrown').to.be.true;
            }).catch((error) => {
                expect(error).to.be.an.instanceof(errors.CliError);
                expect(error.message).to.match(/download integrity compromised/);
                expect(downloadStub.calledOnce).to.be.true;
                expect(downloadStub.calledWithExactly('something.tgz'));
                expect(shasumStub.calledOnce).to.be.true;
                expect(shasumStub.calledWithExactly({downloadedData: true})).to.be.true;
            });
        });

        it('creates dir, decompresses and maps files', function () {
            const env = setupTestFolder();
            const downloadStub = sinon.stub().resolves({downloadedData: true});
            const shasumStub = sinon.stub().returns('asdf1234');
            const decompressStub = sinon.stub().resolves();
            const downloadTask = proxyquire(modulePath, {
                download: downloadStub,
                shasum: shasumStub,
                decompress: decompressStub
            }).subTasks.download;
            const ctx = {
                tarball: 'something.tgz',
                shasum: 'asdf1234',
                version: '1.0.0',
                installPath: path.join(env.dir, 'versions/1.0.0')
            };

            return downloadTask(ctx, {noCache: true}).then(() => {
                expect(downloadStub.calledOnce).to.be.true;
                expect(downloadStub.calledWithExactly('something.tgz'));
                expect(shasumStub.calledOnce).to.be.true;
                expect(shasumStub.calledWithExactly({downloadedData: true})).to.be.true;
                expect(decompressStub.calledOnce).to.be.true;
                expect(fs.existsSync(ctx.installPath)).to.be.true;

                expect(decompressStub.args[0][0]).to.deep.equal({downloadedData: true});
                expect(decompressStub.args[0][1]).to.equal(ctx.installPath);
                expect(decompressStub.args[0][2].map).to.exist;

                const files = [{path: 'package/index.js'}, {path: 'package/package.json'}, {path: 'package/yarn.lock'}];
                const mapResult = files.map(decompressStub.args[0][2].map);
                expect(mapResult).to.deep.equal([{path: 'index.js'}, {path: 'package.json'}, {path: 'yarn.lock'}]);
            });
        });

        it('catches errors from decompress and cleans up the install folder', function () {
            const env = setupTestFolder();
            const downloadStub = sinon.stub().resolves({downloadedData: true});
            const shasumStub = sinon.stub().returns('asdf1234');
            const decompressStub = sinon.stub().rejects(new Error('an error occurred'));
            const downloadTask = proxyquire(modulePath, {
                download: downloadStub,
                shasum: shasumStub,
                decompress: decompressStub
            }).subTasks.download;
            const ctx = {
                tarball: 'something.tgz',
                shasum: 'asdf1234',
                version: '1.0.0',
                installPath: path.join(env.dir, 'versions/1.0.0')
            };

            return downloadTask(ctx, {noCache: true}).then(() => {
                expect(false, 'Error should have been thrown').to.be.true;
            }).catch((error) => {
                expect(error.message).to.equal('an error occurred');
                expect(downloadStub.calledOnce).to.be.true;
                expect(downloadStub.calledWithExactly('something.tgz'));
                expect(shasumStub.calledOnce).to.be.true;
                expect(shasumStub.calledWithExactly({downloadedData: true})).to.be.true;
                expect(decompressStub.calledOnce).to.be.true;
                expect(fs.existsSync(ctx.installPath)).to.be.false;
            });
        });

        it('saves tarball to cache after successful download when noCache is false', async function () {
            const env = setupTestFolder();
            const fakeData = Buffer.from('tarball data');
            const downloadStub = sinon.stub().resolves(fakeData);
            const shasumStub = sinon.stub().returns('asdf1234');
            const decompressStub = sinon.stub().resolves();
            const writeFileStub = sinon.stub();
            const ensureDirStub = sinon.stub();
            const downloadTask = proxyquire(modulePath, {
                download: downloadStub,
                shasum: shasumStub,
                decompress: decompressStub,
                'fs-extra': {
                    ensureDirSync: ensureDirStub,
                    writeFileSync: writeFileStub,
                    removeSync: sinon.stub()
                },
                '../utils/get-cache-dir': () => '/ghost/cache'
            }).subTasks.download;
            const ctx = {
                tarball: 'something.tgz',
                shasum: 'asdf1234',
                version: '5.0.0',
                installPath: path.join(env.dir, 'versions/5.0.0')
            };

            await downloadTask(ctx, {noCache: false});

            expect(ensureDirStub.calledWith('/ghost/cache')).to.be.true;
            expect(writeFileStub.calledWith('/ghost/cache/ghost-5.0.0.tgz', fakeData)).to.be.true;
        });

        it('does not save tarball to cache when noCache is true', async function () {
            const env = setupTestFolder();
            const fakeData = Buffer.from('tarball data');
            const downloadStub = sinon.stub().resolves(fakeData);
            const shasumStub = sinon.stub().returns('asdf1234');
            const decompressStub = sinon.stub().resolves();
            const writeFileStub = sinon.stub();
            const downloadTask = proxyquire(modulePath, {
                download: downloadStub,
                shasum: shasumStub,
                decompress: decompressStub,
                'fs-extra': {
                    ensureDirSync: sinon.stub(),
                    removeSync: sinon.stub()
                },
                '../utils/get-cache-dir': () => '/ghost/cache'
            }).subTasks.download;
            const ctx = {
                tarball: 'something.tgz',
                shasum: 'asdf1234',
                version: '5.0.0',
                installPath: path.join(env.dir, 'versions/5.0.0')
            };

            await downloadTask(ctx, {noCache: true});

            expect(writeFileStub.called).to.be.false;
        });

        it('uses cachedData instead of downloading when available', async function () {
            const env = setupTestFolder();
            const fakeData = Buffer.from('cached tarball');
            const downloadStub = sinon.stub();
            const decompressStub = sinon.stub().resolves();
            const downloadTask = proxyquire(modulePath, {
                download: downloadStub,
                decompress: decompressStub,
                'fs-extra': {
                    ensureDirSync: sinon.stub(),
                    removeSync: sinon.stub()
                }
            }).subTasks.download;
            const ctx = {
                tarball: 'something.tgz',
                shasum: 'asdf1234',
                version: '5.0.0',
                installPath: path.join(env.dir, 'versions/5.0.0'),
                cachedData: fakeData
            };

            await downloadTask(ctx);

            expect(downloadStub.called).to.be.false;
            expect(decompressStub.calledOnce).to.be.true;
            expect(decompressStub.args[0][0]).to.equal(fakeData);
        });
    });
});
