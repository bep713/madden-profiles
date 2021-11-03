const sinon = require('sinon');
const { expect } = require('chai');
const rewiremock = require('rewiremock/node');

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

class MemoryManagerSpy {
    constructor() {

    };

    async attach() {

    }

    async isProcessRunning() {
        return true;
    }
};

let memoryManagerSpy = sinon.spy(MemoryManagerSpy.prototype);

let childProcessSpy = {
    exec: sinon.spy(() => {})
};

let maddenTypeServiceSpy = {
    parseTypes: sinon.spy(() => { return Promise.resolve({ types: 'done' }); })
};

const typeUtil = rewiremock.proxy(() => require('../../../../src/madden22/util/typeUtil'), {
    'zlib': zlibSpy,
    'fs/promises': fsSpy,
    'child_process': childProcessSpy,
    '../../../../src/madden22/util/envPathUtil': envPathsUtilSpy,
    'madden-file-tools/services/MemoryManager': MemoryManagerSpy,
    'madden-file-tools/services/maddenTypeService': maddenTypeServiceSpy
});


let options = {
    path: 'test/path'
};

describe('type util unit tests', () => {
    beforeEach(() => {
        zlibSpy.gzip.resetHistory();
        zlibSpy.gunzip.resetHistory();
        fsSpy.readFile.resetHistory();
        fsSpy.writeFile.resetHistory();
        childProcessSpy.exec.resetHistory();
        memoryManagerSpy.attach.resetHistory();
        maddenTypeServiceSpy.parseTypes.resetHistory();
        memoryManagerSpy.isProcessRunning.resetHistory();
    });

    describe('can read types from the game', () => {
        it('method exists', () => {
            expect(typeUtil.buildAndSaveTypes).to.exist;
        });

        it('throws an error if the exe path is not passed as an argument', (done) => {
            const promise = typeUtil.buildAndSaveTypes();

            promise.then(() => {
                done(new Error('Expected promise rejection, but promise was successful.'))
            })
            .catch(() => {
                done();
            });
        });

        it('checks if the process is running', async () => {
            await typeUtil.buildAndSaveTypes(options);

            expect(memoryManagerSpy.isProcessRunning.callCount).to.equal(1);
        });

        it('runs the process if not already running', async () => {
            const currentFn = memoryManagerSpy.isProcessRunning;
            memoryManagerSpy.isProcessRunning = () => { return false; }

            let clock = sinon.useFakeTimers();

            typeUtil.buildAndSaveTypes(options);

            await clock.tickAsync(750);
            await clock.tickAsync(750);
            
            expect(childProcessSpy.exec.callCount).to.equal(1);
            expect(childProcessSpy.exec.firstCall.args[0]).to.equal('"test/path"');
            
            memoryManagerSpy.isProcessRunning = currentFn;
            clock.restore();
        });

        it('throws an error after 75s if process is still not running', async () => {
            const currentFn = memoryManagerSpy.isProcessRunning;
            memoryManagerSpy.isProcessRunning = () => { return false; }

            let clock = sinon.useFakeTimers();
            let error = '';

            const promise = typeUtil.buildAndSaveTypes(options);

            promise.then(() => {
                expect(1).to.equal(2);
                done(new Error('Expected promise rejection, but promise was successful.'))
            })
            .catch((err) => {
                error = err;
            });

            await clock.tickAsync(75000);
            expect(error).to.include('Timeout reached.')
                       
            memoryManagerSpy.isProcessRunning = currentFn;
            clock.restore();
        });

        it('does not run the process if already running', async () => {
            await typeUtil.buildAndSaveTypes(options);

            expect(childProcessSpy.exec.callCount).to.equal(0);
        });

        it('parses the types', async () => {
            await typeUtil.buildAndSaveTypes(options);

            expect(maddenTypeServiceSpy.parseTypes.callCount).to.equal(1);
            expect(maddenTypeServiceSpy.parseTypes.firstCall.args[0]).to.equal('Madden22.exe');
        });

        it('returns the types', async () => {
            const types = await typeUtil.buildAndSaveTypes(options);
            expect(types).to.eql({ types: 'done' });
        });

        it('writes the type cache to a file if option is passed in', async () => {
            await typeUtil.buildAndSaveTypes(options);

            expect(fsSpy.writeFile.callCount).to.equal(1);
            expect(fsSpy.writeFile.firstCall.args[0]).to.equal('C:\\test\\m22.types');
            expect(fsSpy.writeFile.firstCall.args[1]).to.eql({ types: 'done' });
        });
    });
});