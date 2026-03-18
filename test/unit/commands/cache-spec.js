'use strict';
const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const modulePath = '../../../lib/commands/cache';

describe('Unit: Commands > Cache', function () {
    let logStub;

    beforeEach(function () {
        logStub = sinon.stub();
    });

    afterEach(() => {
        sinon.restore();
    });

    function makeInstance(fsOverrides = {}) {
        const CacheCommand = proxyquire(modulePath, {
            'fs-extra': {existsSync: sinon.stub().returns(true), removeSync: sinon.stub(), ...fsOverrides},
            '../utils/get-cache-dir': () => '/ghost/cache'
        });
        const instance = new CacheCommand({}, {});
        instance.ui = {log: logStub};
        return instance;
    }

    describe('no flags', function () {
        it('prints the cache directory path', function () {
            const instance = makeInstance();
            instance.run({});
            expect(logStub.calledWith('/ghost/cache')).to.be.true;
        });
    });

    describe('--path', function () {
        it('prints the cache directory path', function () {
            const instance = makeInstance();
            instance.run({path: true});
            expect(logStub.calledWith('/ghost/cache')).to.be.true;
        });
    });

    describe('--clear', function () {
        it('removes the cache dir and logs confirmation when it exists', function () {
            const removeStub = sinon.stub();
            const instance = makeInstance({existsSync: sinon.stub().returns(true), removeSync: removeStub});
            instance.run({clear: true});
            expect(removeStub.calledWith('/ghost/cache')).to.be.true;
            expect(logStub.calledOnce).to.be.true;
            expect(logStub.args[0][0]).to.match(/cleared/i);
        });

        it('logs a message and does not remove when cache dir does not exist', function () {
            const removeStub = sinon.stub();
            const instance = makeInstance({existsSync: sinon.stub().returns(false), removeSync: removeStub});
            instance.run({clear: true});
            expect(removeStub.called).to.be.false;
            expect(logStub.calledOnce).to.be.true;
            expect(logStub.args[0][0]).to.match(/already empty/i);
        });
    });

    describe('--path --clear', function () {
        it('prints the directory then clears it', function () {
            const removeStub = sinon.stub();
            const instance = makeInstance({existsSync: sinon.stub().returns(true), removeSync: removeStub});
            instance.run({path: true, clear: true});
            expect(logStub.firstCall.args[0]).to.equal('/ghost/cache');
            expect(removeStub.calledWith('/ghost/cache')).to.be.true;
            expect(logStub.secondCall.args[0]).to.match(/cleared/i);
        });
    });
});
