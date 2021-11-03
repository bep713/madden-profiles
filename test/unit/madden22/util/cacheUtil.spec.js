const sinon = require('sinon');
const { expect } = require('chai');
const rewiremock = require('rewiremock/node');

let confUtilSpy = {
    get: sinon.spy(() => { return Buffer.from([0x01]); }),
    set: sinon.spy(() => {} ),
    delete: sinon.spy(() => {} ),
    path: 'C:/test'
};

let envPathsUtilSpy = {
    config: 'C:/test'
};

let fsSpy = {
    readFile: sinon.spy(() => { return Promise.resolve(Buffer.from([0x01])); }),
    writeFile: sinon.spy(() => { return Promise.resolve(); })
};

let zlibSpy = {
    gzip: sinon.spy((data, cb) => { return cb(null, Buffer.from([0x00])); }),
    gunzip: sinon.spy((data, cb) => { return cb(null, JSON.stringify([{ test: 'test' }])) })
};

const cacheUtil = rewiremock.proxy(() => require('../../../../src/madden22/util/cacheUtil'), {
    'zlib': zlibSpy,
    'fs/promises': fsSpy,
    '../../../../src/madden22/util/confUtil': confUtilSpy,
    '../../../../src/madden22/util/envPathUtil': envPathsUtilSpy
});

describe('cache util unit tests', () => {
    beforeEach(() => {
        zlibSpy.gzip.resetHistory();
        zlibSpy.gunzip.resetHistory();
        fsSpy.readFile.resetHistory();
        fsSpy.writeFile.resetHistory();
        confUtilSpy.get.resetHistory();
        confUtilSpy.set.resetHistory();
        confUtilSpy.delete.resetHistory();
    });

    describe('can build and save the cache', () => {
        it('method exists', () => {
            expect(cacheUtil.buildAndSaveCache).to.exist;
        });

        it('returns a promise', () => {
            expect(cacheUtil.buildAndSaveCache()).to.be.an.instanceOf(Promise);
        });

        it('compresses the data', async () => {
            const cacheArgs = [{
                id: 1,
                name: 'test'
            }];

            await cacheUtil.buildAndSaveCache(cacheArgs);

            expect(zlibSpy.gzip.callCount).to.equal(1);
            expect(zlibSpy.gzip.firstCall.args[0]).to.eql(JSON.stringify(cacheArgs));
        });

        it('saves the cache', async () => {
            await cacheUtil.buildAndSaveCache([{}]);

            expect(fsSpy.writeFile.callCount).to.equal(1);
            expect(fsSpy.writeFile.firstCall.args[0]).to.equal('C:\\test\\m22.cache');
            expect(fsSpy.writeFile.firstCall.args[1]).to.eql(Buffer.from([0x00]));
        });

        it('returns the expected result', async () => {
            const result = await cacheUtil.buildAndSaveCache([{}]);
            expect(result).to.eql(Buffer.from([0x00]));
        });
    });

    describe('can get the cache', () => {
        it('method exists', () => {
            expect(cacheUtil.getCache).to.exist;
        });

        it('gets the cache', async () => {
            await cacheUtil.getCache();

            expect(fsSpy.readFile.callCount).to.equal(1);
            expect(fsSpy.readFile.firstCall.args[0]).to.equal('C:\\test\\m22.cache');
        });

        it('decompresses the cache', async () => {
            await cacheUtil.getCache();

            expect(zlibSpy.gunzip.callCount).to.equal(1);
            expect(zlibSpy.gunzip.firstCall.args[0]).to.eql(Buffer.from([0x01]));
        });

        it('returns expected result', async () => {
            const cache = await cacheUtil.getCache();
            expect(cache).to.eql([{ test: 'test' }]);
        });
    });
});