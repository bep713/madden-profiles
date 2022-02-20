const sinon = require('sinon');
const { expect } = require('chai');
const rewiremock = require('rewiremock/node');

let fsSpy = {
    readFile: sinon.spy(async () => { return Buffer.alloc(100); }),
    writeFile: sinon.spy(async () => {})
};

let envPathUtilSpy = {
    config: 'env/path'
};

const gameKeyUtil = rewiremock.proxy(() => require('../../../../src/madden22/util/gameKeyUtil'), {
    'fs/promises': fsSpy,
    '../../../../src/madden22/util/envPathUtil': envPathUtilSpy
});

describe('game key util unit tests', () => {
    beforeEach(() => {
        fsSpy.readFile.resetHistory();
        fsSpy.writeFile.resetHistory();
    });

    it('can save a key', async () => {
        await gameKeyUtil.saveKey(Buffer.from([0x1]));
        expect(fsSpy.writeFile.callCount).to.equal(1);
        expect(fsSpy.writeFile.firstCall.args[0]).to.equal('env\\path\\m22.key');
    });

    it('can get a key', async () => {
        const key = await gameKeyUtil.getKey();
        expect(fsSpy.readFile.callCount).to.equal(1);
        expect(fsSpy.readFile.firstCall.args[0]).to.equal('env\\path\\m22.key');
        expect(key.length).to.equal(16);
    });
});