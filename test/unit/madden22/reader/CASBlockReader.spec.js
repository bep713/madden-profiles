const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { pipeline, Transform } = require('stream');

const M22CasBlockReader = require('../../../../src/madden22/reader/CASBlockReader');
const M22STDReader = require('../../../../src/madden22/reader/SharedTypeDescriptorReader');

const m22TypesPath = path.join(__dirname, '../../../data/types/M22Types.json');
const sharedTypeDescriptorsM22Path = path.join(__dirname, '../../../data/ebx/SharedTypeDescriptors.ebx_M22.dat');

const CAS_PATH = 'D:\\Games\\Madden NFL 22\\Data\\Win32\\superbundlelayout\\madden_installpackage_lcu\\cas_01.cas';

let stdReader, reader, ebxList, types;

describe('M22 CAS Block Reader unit tests', () => {
    before(async function () {
        this.timeout(10000);
        stdReader = new M22STDReader(fs.createReadStream(sharedTypeDescriptorsM22Path), m22TypesPath);
        types = await stdReader.read();
    });

    describe('single CAS read', () => {
        before(async function () {
            this.timeout(40000);
            reader = new M22CasBlockReader(CAS_PATH, types, {
                readEbxData: true,
                decompressChunks: true
            });
            ebxList = await reader.read();
        });

        it('expected result', () => {
            expect(ebxList.length).to.equal(574);
        });

        it('contains offset and name', () => {
            expect(ebxList[0].name).to.equal('Sound/Speech/TV/SoundWaves/secondary_LCU/bINTRO_STUDIO_MUT_SOLO_CHALLENGE_P1_GOAL_SPEC');
            expect(ebxList[0].offset).to.equal(0x720C);
            expect(ebxList[0].sizeInCas).to.equal(0x17E);
        });
    });

    describe('single CAS read - decompress false', () => {
        let emittedChunks = [];

        before(async function () {
            this.timeout(40000);
            reader = new M22CasBlockReader(CAS_PATH, types, {
                readEbxData: true,
                decompressChunks: false
            });

            reader.on('chunk', (chunk) => {
                emittedChunks.push(chunk);
            });

            ebxList = await reader.read();
        });

        it('emits the chunks', () => {
            expect(emittedChunks.length).to.equal(574);
        });
    });

    describe('single chunk CAS read - without data', () => {
        before(async function () {
            this.timeout(40000);
            reader = new M22CasBlockReader(CAS_PATH, types, {
                start: 0x720C,
                size: 0x17E,
                decompressChunks: true
            });

            ebxList = await reader.read();
        });

        it('expected result', () => {
            expect(ebxList.length).to.equal(1);
        });

        it('contains offset and name', () => {
            expect(ebxList[0].name).to.equal('Sound/Speech/TV/SoundWaves/secondary_LCU/bINTRO_STUDIO_MUT_SOLO_CHALLENGE_P1_GOAL_SPEC');
            expect(ebxList[0].offset).to.equal(0);
            expect(ebxList[0].sizeInCas).to.equal(0x17E);
            expect(ebxList[0].data.length).to.equal(0);
        });
    });

    describe('single chunk CAS read - with data', () => {
        before(async function () {
            this.timeout(40000);
            reader = new M22CasBlockReader(CAS_PATH, types, {
                start: 0x720C,
                size: 0x17E,
                readEbxData: true,
                decompressChunks: true
            });

            ebxList = await reader.read();
        });

        it('expected result', () => {
            expect(ebxList.length).to.equal(1);
        });

        it('contains offset and name', () => {
            expect(ebxList[0].name).to.equal('Sound/Speech/TV/SoundWaves/secondary_LCU/bINTRO_STUDIO_MUT_SOLO_CHALLENGE_P1_GOAL_SPEC');
            expect(ebxList[0].offset).to.equal(0);
            expect(ebxList[0].sizeInCas).to.equal(0x17E);
            expect(ebxList[0].data).not.be.undefined;
        });
    });

    describe('single chunk CAS read - export uncompressed data', () => {
        before(async function () {
            this.timeout(40000);
            reader = new M22CasBlockReader(CAS_PATH, types, {
                start: 0x738A,
                size: 0x183,
                exportOptions: {
                    export: true,
                    uncompressed: true
                },
                decompressChunks: true
            });

            ebxList = await reader.read();
        });

        it('expected result', () => {
            expect(ebxList.length).to.equal(1);

            const ebxFile = ebxList[0];
            expect(ebxFile.data).to.exist;
            expect(ebxFile.data.length).to.equal(546);
        });
    });

    describe('multiple CAS reads at once (without worker pool)', () => {
        let ebxLists = [];

        before(async function () {
            this.timeout(100000);

            let ebxReadPromises = [];
    
            for (let i = 1; i < 7; i++) {
                const casPath = `D:\\Games\\Madden NFL 22\\Data\\Win32\\superbundlelayout\\madden_installpackage_00\\cas_0${i}.cas`;
                let reader = new M22CasBlockReader(casPath, types, {
                    decompressChunks: true
                });
                ebxReadPromises.push(reader.read());
            }

            ebxLists = await Promise.all(ebxReadPromises);
        });

        it('expected result', () => {
            expect(ebxLists.length).to.equal(6);
        });
    });

    // describe('multiple CAS reads at once (using worker pool)', () => {
    //     let ebxLists = [];

    //     before(async function () {
    //         this.timeout(100000);

    //         const staticPool = new StaticPool({
    //             size: 6,
    //             task: async function (fileName, types) {
    //                 const M22CasBlockReader = require('./readers/m22/Madden22CASBlockReader');
    //                 const zstd = require('@fstnetwork/cppzst');
    //                 let reader = new M22CasBlockReader(fileName, types);
    //                 const ebxList = await reader.read();
    //                 return ebxList;
    //             }
    //         });

    //         let ebxReadPromises = [];
    
    //         for (let i = 1; i < 7; i++) {
    //             const casPath = `D:\\Games\\Madden NFL 22\\Data\\Win32\\superbundlelayout\\madden_installpackage_00\\cas_0${i}.cas`;
    //             ebxReadPromises.push(staticPool.exec(casPath, types));
    //         }

    //         ebxLists = await Promise.all(ebxReadPromises);
    //     });

    //     it('expected result', () => {
    //         expect(ebxLists.length).to.equal(6);
    //     });
    // });
});