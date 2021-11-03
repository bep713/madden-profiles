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
    getCache: sinon.spy(() => { return Promise.reject(); })
};

class EventEmitterStub {
    constructor() {

    }

    emit(event, data) {

    }
}

let emitEventSpy = sinon.spy(EventEmitterStub.prototype, 'emit');

const GameResourceReader = rewiremock.proxy(() => require('../../../../src/madden22/reader/GameResourceReader'), {
    'events': { EventEmitter: EventEmitterStub },
    'workerpool': workerpoolSpy,
    '../../../../src/madden22/util/cacheUtil': cacheUtilSpy,
    '../../../../src/madden22/util/gameFileUtil': gameFileUtilSpy,
    '../../../../src/madden22/reader/CASBlockReader': CasBlockReaderSpy,
});

let reader = new GameResourceReader();

describe('GameResourceReader unit tests', () => {
    beforeEach(() => {
        rewiremock.enable();

        execSpy.resetHistory();
        emitEventSpy.resetHistory();
        casBlockReaderSpy.resetHistory();
        workerpoolSpy.pool.resetHistory();
        cacheUtilSpy.getCache.resetHistory();
        cacheUtilSpy.buildAndSaveCache.resetHistory();
        gameFileUtilSpy.getAllCasFilesFromExe.resetHistory();

        reader = new GameResourceReader();
    });

    afterEach(() => {
        rewiremock.disable();
    });

    describe('read()', () => {
        let options = {
            path: 'C:/path/to/exe',
            buildCache: true
        };

        it('throws an error if options are empty', (done) => {
            const promise = reader.read();

            promise.then(() => {
                done(new Error('Expected promise rejection, but promise was successful.'))
            })
            .catch((err) => {
                done();
            });
        });

        it('throws an error if option path is empty', (done) => {
            const promise = reader.read({});

            promise.then(() => {
                done(new Error('Expected promise rejection, but promise was successful.'))
            })
            .catch((err) => {
                done();
            });
        });

        it('gets the CAS files in the directories', async () => {
            await reader.read(options);

            expect(gameFileUtilSpy.getAllCasFilesFromExe.callCount).to.equal(1);
            expect(gameFileUtilSpy.getAllCasFilesFromExe.firstCall.args[0]).to.equal(options.path);
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
                expect(cacheUtilSpy.buildAndSaveCache.firstCall.args[0]).to.eql([execResult]);
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