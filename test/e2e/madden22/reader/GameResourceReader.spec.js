const { expect } = require('chai');

const cacheUtil = require('../../../../src/madden22/util/cacheUtil');
const GameResourceReader = require('../../../../src/madden22/reader/GameResourceReader');

const TOTAL_NUM_RESOURCES = 539134;
const MADDEN_LOCATION = 'D:\\Games\\Madden NFL 22\\Madden22.exe';

describe('Game resource reader e2e tests', () => {
    it('returns expected result', async function () {
        this.timeout(360000);

        const reader = new GameResourceReader();
        const data = await reader.read({
            path: MADDEN_LOCATION
        });

        expect(data.length).to.equal(TOTAL_NUM_RESOURCES);
    });

    it('builds and saves cache', async function () {
        this.timeout(360000);

        const reader = new GameResourceReader();

        reader.on('read-progress', (data) => {
            console.log(data.message);
        });

        await reader.read({
            path: MADDEN_LOCATION,
            buildCache: true
        });

        const cache = await cacheUtil.getCache();
        expect(cache.length).to.equal(TOTAL_NUM_RESOURCES)
    });

    it('reads from cache', async function () {
        const reader = new GameResourceReader();

        reader.on('read-progress', (data) => {
            console.log(data.message);
        });

        const cache = await reader.read({
            path: MADDEN_LOCATION
        });

        expect(cache.length).to.equal(TOTAL_NUM_RESOURCES);
    });
});