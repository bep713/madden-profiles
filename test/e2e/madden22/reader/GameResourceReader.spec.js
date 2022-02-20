const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const cacheUtil = require('../../../../src/madden22/util/cacheUtil');
const GameResourceReader = require('../../../../src/madden22/reader/GameResourceReader');

const TOTAL_NUM_RESOURCES = 547288;
const MADDEN_LOCATION = 'D:\\Games\\Madden NFL 22\\Madden22.exe';

describe('Game resource reader e2e tests', () => {
    it('returns expected result', async function () {
        this.timeout(360000);

        const reader = new GameResourceReader(MADDEN_LOCATION);
        const data = await reader.read({
            path: MADDEN_LOCATION
        });

        expect(data.length).to.equal(TOTAL_NUM_RESOURCES);
    });

    it('builds and saves cache', async function () {
        this.timeout(360000);

        const reader = new GameResourceReader(MADDEN_LOCATION);

        reader.on('read-progress', (data) => {
            console.log(data.message);
        });

        await reader.read({
            buildCache: true
        });

        const cache = await cacheUtil.getCache();
        expect(cache.length).to.equal(TOTAL_NUM_RESOURCES)
    });

    it('reads from cache', async () => {
        const reader = new GameResourceReader(MADDEN_LOCATION);

        reader.on('read-progress', (data) => {
            console.log(data.message);
        });

        const cache = await reader.read();

        expect(cache.length).to.equal(TOTAL_NUM_RESOURCES);
    });

    it('can build types cache', async function () {
        this.timeout(100000);
        const key = fs.readFileSync(path.join(__dirname, '../../../data/madden22.key'));
        const reader = new GameResourceReader(MADDEN_LOCATION);
        
        reader.on('type-progress', (data) => {
            console.log(data.message);
        });

        await reader.readTypes({
            buildCache: true,
            key: key.slice(0, 16),
        });

        expect(reader._types._types.length).to.equal(3232);
        expect(Object.keys(reader._types._typeHashTableLookup).length).to.equal(3232);
    });

    it('can read types', async function () {
        this.timeout(100000);
        const key = fs.readFileSync(path.join(__dirname, '../../../data/madden22.key'));
        const reader = new GameResourceReader(MADDEN_LOCATION);
        
        reader.on('type-progress', (data) => {
            console.log(data.message);
        });

        await reader.readTypes({
            key: key.slice(0, 16)
        });

        expect(reader._types._types.length).to.equal(3232);
        expect(Object.keys(reader._types._typeHashTableLookup).length).to.equal(3232);
    });

    it('can get a resource from the cache', async () => {
        const reader = new GameResourceReader(MADDEN_LOCATION);

        reader.on('read-progress', (data) => {
            console.log(data.message);
        });

        await reader.read();

        const soundFile = await reader.getResource('Sound/CoreAudio/Samples/Music/MaddenMusicSystem/Segments/Primary/CORE_MX_DYNM_MMS_P1_24kGoldn_TheTop_69BPM_4.4TS_Segment');
        console.log(soundFile);
        expect(soundFile).to.exist;
    });
});