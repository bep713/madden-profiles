const sinon = require('sinon');
const { expect } = require('chai');
const { EventEmitter } = require('events');
const rewiremock = require('rewiremock/node');

const dummyCasPath = 'D:\\Games\\Madden NFL 22\\Data\\Win32\\superbundlelayout\\madden_installpackage_00\\cas_01.cas';

let gameFileUtilSpy = {
    getAllCasFilesFromExe: sinon.spy(() => {
        return [{
            path: dummyCasPath,
            relativePath: 'test'
        }]
    }),
    getInitFsPathFromExe: sinon.spy(async () => {
        return {
            patch: 'initfs/patch/path',
            data: 'initfs/data/path'
        }
    })
};

const chunk = {
    blocks: [
        {
            meta: {
                isCompressed: true,
                compressionType: 15
            },
            data: {
                data: Buffer.from([0x00])
            }
        }
    ],
    offset: 123,
    sizeInCas: 456
};

class CasBlockReaderSpy extends EventEmitter {
    constructor() {
        super();
    }

    async read() {
        this.emit('chunk', chunk);
    }
};

const casBlockReaderSpy = sinon.spy(CasBlockReaderSpy.prototype, 'read');

class InitFsReaderSpy {
    constructor() {
        
    }

    async read() {
        return {
            root: {
                '_entries': [{
                    '$file': {
                        name: 'SharedTypeDescriptors.ebx',
                        payload: Buffer.alloc(100)
                    }
                }]
            }
        };
    }
};

let initFsReaderSpy = sinon.spy(InitFsReaderSpy.prototype, 'read');

const typesResult = [{
    type: 'test'
}]
class SharedTypeDescriptorReader {
    constructor() {

    }

    async read() {
        return typesResult;
    }
};

const stdReaderSpy = sinon.spy(SharedTypeDescriptorReader.prototype, 'read');

const execResult = {
    id: 1,
    name: 'test'
};

let execSpy = sinon.spy((event) => {
    if (event === 'parseChunk') {
        return execResult;
    }
});

const workerpoolSpy = {
    pool: sinon.spy(() => {
        return {
            exec: execSpy
        }
    })
};

let cacheUtilSpy = {
    buildAndSaveCache: sinon.spy(() => { return Promise.resolve(); }),
    getCache: sinon.spy(() => { return Promise.reject(); }),
    CACHES: {
        GAME: 'game',
        TYPES: 'types'
    }
};

class EventEmitterStub {
    constructor() {

    }

    emit(event, data) {

    }
}

let emitEventSpy = sinon.spy(EventEmitterStub.prototype, 'emit');

let typeUtilSpy = {
    buildAndSaveTypes: sinon.spy(() => { return Promise.resolve(); })
};

let gameKeyUtilSpy = {
    getKey: sinon.spy(() => { return Promise.resolve('key'); }),
    saveKey: sinon.spy(() => { return Promise.resolve() })
};

const GameResourceReader = rewiremock.proxy(() => require('../../../../src/madden22/reader/GameResourceReader'), {
    'events': { EventEmitter: EventEmitterStub },
    'workerpool': workerpoolSpy,
    '../../../../src/madden22/util/typeUtil': typeUtilSpy,
    '../../../../src/madden22/util/cacheUtil': cacheUtilSpy,
    '../../../../src/madden22/util/gameKeyUtil': gameKeyUtilSpy,
    '../../../../src/madden22/util/gameFileUtil': gameFileUtilSpy,
    '../../../../src/madden22/reader/InitFsReader': InitFsReaderSpy,
    '../../../../src/madden22/reader/CASBlockReader': CasBlockReaderSpy,
    '../../../../src/madden22/reader/SharedTypeDescriptorReader': SharedTypeDescriptorReader
});

const BASE_GAME_PATH = 'C:\\path\\to\\exe';

let reader = new GameResourceReader();

describe('GameResourceReader unit tests', () => {
    beforeEach(() => {
        rewiremock.enable();

        execSpy.resetHistory();
        emitEventSpy.resetHistory();
        stdReaderSpy.resetHistory();
        initFsReaderSpy.resetHistory();
        casBlockReaderSpy.resetHistory();
        workerpoolSpy.pool.resetHistory();
        cacheUtilSpy.getCache.resetHistory();
        gameKeyUtilSpy.getKey.resetHistory();
        gameKeyUtilSpy.saveKey.resetHistory();
        typeUtilSpy.buildAndSaveTypes.resetHistory();
        cacheUtilSpy.buildAndSaveCache.resetHistory();
        gameFileUtilSpy.getInitFsPathFromExe.resetHistory();
        gameFileUtilSpy.getAllCasFilesFromExe.resetHistory();

        reader = new GameResourceReader(BASE_GAME_PATH);
    });

    afterEach(() => {
        rewiremock.disable();
    });

    describe('read()', () => {
        let options = {
            buildCache: true
        };

        it('gets the CAS files in the directories', async () => {
            await reader.read(options);

            expect(gameFileUtilSpy.getAllCasFilesFromExe.callCount).to.equal(1);
            expect(gameFileUtilSpy.getAllCasFilesFromExe.firstCall.args[0]).to.equal(BASE_GAME_PATH);
        });

        it('reads the CAS file', async () => {
            await reader.read(options);

            expect(casBlockReaderSpy.callCount).to.equal(1);
        });

        it('calls the worker for each chunk returned', async () => {
            await reader.read(options);

            expect(execSpy.withArgs('parseChunk').callCount).to.equal(1);
            expect(execSpy.withArgs('parseChunk').firstCall.args[1]).to.eql([{
                data: chunk,
                relativePath: 'test'
            }]);
        });

        describe('emits expected events', () => {
            it('emits expected event for each CAS file', async () => {
                await reader.read(options);
    
                expect(emitEventSpy.callCount).to.be.greaterThan(0);
                expect(emitEventSpy.firstCall.args[0]).to.equal('read-progress');
                expect(emitEventSpy.firstCall.args[1]).to.eql({
                    progress: 0,
                    totalSteps: 1,
                    currentStep: 0,
                    message: `[1/1]: Reading ${dummyCasPath}.`
                });
            });
    
            it('emits expected event at the end of the flow', async () => {
                await reader.read(options);

                expect(emitEventSpy.secondCall.args[0]).to.equal('read-progress');
                expect(emitEventSpy.secondCall.args[1]).to.eql({
                    progress: 100,
                    totalSteps: 1,
                    currentStep: 1,
                    message: `Finished reading CAS files.`
                });
            });
        });

        it('returns the data', async () => {
            const result = await reader.read(options);

            expect(result).to.eql([execResult])
        });

        it('keeps the data in memory', async () => {
            await reader.read(options);
            expect(reader.data).to.eql([execResult])
        });

        describe('cache', () => {
            const options = {
                path: 'test/path'
            };

            it('will attempt to read from the cache by default', async () => {
                await reader.read(options);
                expect(cacheUtilSpy.getCache.callCount).to.equal(1);
                expect(cacheUtilSpy.getCache.firstCall.args[0]).to.equal(cacheUtilSpy.CACHES.GAME);
            });

            it('will read from game files if cache DNE', async () => {
                await reader.read(options);
                expect(gameFileUtilSpy.getAllCasFilesFromExe.callCount).to.equal(1);
                expect(emitEventSpy.firstCall.args[1].message).to.equal('Cache not found. Reading from game files...');
            });

            it('will not read from game files if cache is present', async () => {
                const currentFn = cacheUtilSpy.getCache;
                cacheUtilSpy.getCache = sinon.spy(() => { return Promise.resolve(Buffer.from([0x01])); });

                await reader.read(options);

                expect(cacheUtilSpy.getCache.callCount).to.equal(1);
                expect(cacheUtilSpy.getCache.firstCall.args[0]).to.equal(cacheUtilSpy.CACHES.GAME);
                cacheUtilSpy.getCache = currentFn;

                expect(gameFileUtilSpy.getAllCasFilesFromExe.callCount).to.equal(0);
                expect(casBlockReaderSpy.callCount).to.equal(0);

                expect(emitEventSpy.firstCall.args[1].message).to.equal('Cache found.');
            });
        });

        describe('build cache option', () => {
            const cacheOptions = {
                path: 'test/path',
                buildCache: true
            }

            it('does not build a cache if no option passed', async () => {
                await reader.read({
                    path: 'test/path'
                });

                expect(cacheUtilSpy.buildAndSaveCache.callCount).to.equal(0);
            });

            it('builds a cache if an option is passed', async () => {
                await reader.read(cacheOptions);

                expect(cacheUtilSpy.buildAndSaveCache.callCount).to.equal(1);
                expect(cacheUtilSpy.buildAndSaveCache.firstCall.args[0]).to.eql(cacheUtilSpy.CACHES.GAME);
                expect(cacheUtilSpy.buildAndSaveCache.firstCall.args[1]).to.eql([execResult]);
            });

            it('emits expected events', async () => {
                await reader.read(cacheOptions);

                expect(emitEventSpy.callCount).to.equal(4);

                expect(emitEventSpy.firstCall.args[1].progress).to.equal(0);
                expect(emitEventSpy.secondCall.args[1].progress).to.equal(100);
                expect(emitEventSpy.secondCall.args[1]).to.eql({
                    currentStep: 1,
                    totalSteps: 1,
                    progress: 100,
                    message: 'Finished reading CAS files.'
                });

                expect(emitEventSpy.thirdCall.args[0]).to.equal('read-progress');
                expect(emitEventSpy.thirdCall.args[1]).to.eql({
                    currentStep: 0,
                    totalSteps: 1,
                    progress: 0,
                    message: 'Starting to build cache.'
                });

                expect(emitEventSpy.getCall(3).args[0]).to.equal('read-progress');
                expect(emitEventSpy.getCall(3).args[1]).to.eql({
                    currentStep: 1,
                    totalSteps: 1,
                    progress: 100,
                    message: 'Cache built successfully.'
                });
            });

            it('reads from files even if cache is already present', async () => {
                await reader.read(cacheOptions);
                
                expect(cacheUtilSpy.getCache.callCount).to.equal(0);                
                expect(gameFileUtilSpy.getAllCasFilesFromExe.callCount).to.equal(1);
                expect(casBlockReaderSpy.callCount).to.equal(1);
            });
        });
    });

    describe('readTypes', () => {
        it('tries to read types from cache by default', async () => {
            await reader.readTypes();

            expect(cacheUtilSpy.getCache.callCount).to.equal(1);
            expect(cacheUtilSpy.getCache.firstCall.args[0]).to.equal(cacheUtilSpy.CACHES.TYPES);
        });

        it('returns type cache if found', async () => {
            const currentFn = cacheUtilSpy.getCache;
            cacheUtilSpy.getCache = sinon.spy(() => { return Promise.resolve(Buffer.from([0x01])); });

            const cache = await reader.readTypes();
            expect(cacheUtilSpy.getCache.callCount).to.equal(1);
            cacheUtilSpy.getCache = currentFn;

            expect(typeUtilSpy.buildAndSaveTypes.callCount).to.equal(0);

            expect(cache).to.eql(Buffer.from([0x01]));
        });

        it('calls type util if cache was not found', async () => {
            await reader.readTypes();
            expect(typeUtilSpy.buildAndSaveTypes.callCount).to.equal(1);
            expect(typeUtilSpy.buildAndSaveTypes.firstCall.args[0]).to.eql({ path: BASE_GAME_PATH });
        });

        it('gets init fs path', async () => {
            await reader.readTypes();
            expect(gameFileUtilSpy.getInitFsPathFromExe.callCount).to.equal(1);
            expect(gameFileUtilSpy.getInitFsPathFromExe.firstCall.args[0]).to.equal(BASE_GAME_PATH);
        });

        it('gets m22 encryption key', async () => {
            await reader.readTypes();
            expect(gameKeyUtilSpy.getKey.callCount).to.equal(1);
        });

        it('throws an error if m22 encryption key is missing and no key is passed in', (done) => {
            const currentFn = gameKeyUtilSpy.getKey;
            gameKeyUtilSpy.getKey = sinon.spy(() => { return Promise.reject(); });

            reader.readTypes()
                .then(() => {
                    gameKeyUtilSpy.getKey = currentFn;
                    done(new Error('Expected promise rejection, but promise was sucessful'))
                })
                .catch(() => {
                    gameKeyUtilSpy.getKey = currentFn;
                    done();
                })
        });

        it('calls initFsReader to read the file', async () => {
            await reader.readTypes();
            expect(initFsReaderSpy.callCount).to.equal(1);
            expect(initFsReaderSpy.firstCall.args[0]).to.eql({
                key: 'key',
                path: 'initfs/patch/path'
            });
        });

        it('calls initFsReader with overridden key if passed in', async () => {
            await reader.readTypes({
                key: 'other-key'
            });

            expect(initFsReaderSpy.callCount).to.equal(1);
            expect(initFsReaderSpy.firstCall.args[0]).to.eql({
                key: 'other-key',
                path: 'initfs/patch/path'
            });
        });

        it('calls init fs parser again if the STD types aren\'t found', async () => {
            initFsReaderSpy.restore();
            let initFsReadStub = sinon.stub(InitFsReaderSpy.prototype, 'read');
            initFsReadStub.withArgs({
                key: 'key',
                path: 'initfs/patch/path'
            }).returns({
                root: {
                    '_entries': [{
                        '$file': {
                            name: 'test'
                        }
                    }]
                }
            });
            
            initFsReadStub.withArgs({
                key: 'key',
                path: 'initfs/data/path'
            }).returns({
                root: {
                    '_entries': [{
                        '$file': {
                            name: 'SharedTypeDescriptors.ebx',
                            payload: Buffer.alloc(100)
                        }
                    }]
                }
            });

            await reader.readTypes();
            initFsReadStub.restore();
            initFsReaderSpy = sinon.spy(InitFsReaderSpy.prototype, 'read');

            expect(initFsReadStub.callCount).to.equal(2);
            expect(initFsReadStub.firstCall.args[0]).to.eql({
                key: 'key',
                path: 'initfs/patch/path'
            });
            expect(initFsReadStub.secondCall.args[0]).to.eql({
                key: 'key',
                path: 'initfs/data/path'
            });
        });

        it('calls std parser', async () => {
            await reader.readTypes();
            expect(stdReaderSpy.callCount).to.equal(1);
        });

        it('keeps types in memory', async () => {
            await reader.readTypes();
            expect(reader._types).to.exist;
        });

        it('builds a cache if an option is passed', async () => {
            await reader.readTypes({
                buildCache: true
            });

            expect(cacheUtilSpy.buildAndSaveCache.callCount).to.equal(1);
            expect(cacheUtilSpy.buildAndSaveCache.firstCall.args[0]).to.eql(cacheUtilSpy.CACHES.TYPES);
            expect(cacheUtilSpy.buildAndSaveCache.firstCall.args[1]).to.eql(typesResult);
        });

        it('can force build the cache', async () => {
            await reader.readTypes({
                buildCache: true
            });

            expect(cacheUtilSpy.getCache.callCount).to.equal(0);
        });
    });

    describe('getResource()', () => {
        it('throws an error if resource name is empty', (done) => {
            const promise = reader.getResource();

            promise.then(() => {
                done(new Error('Expected promise rejection, but promise was successful.'))
            })
            .catch((err) => {
                done();
            });
        });

        it('throws an error if read() wasn\'t called first', (done) => {
            reader._data = null;
            const promise = reader.getResource('name');

            promise.then(() => {
                done(new Error('Expected promise rejection, but promise was successful.'))
            })
            .catch((err) => {
                done();
            });
        });
    });
});