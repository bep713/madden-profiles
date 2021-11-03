const path = require('path');
const workerpool = require('workerpool');
const { EventEmitter } = require('events');

const cacheUtil = require('../util/cacheUtil');
const CASBlockReader = require('./CASBlockReader');
const gameFileUtil = require('../util/gameFileUtil');

class GameResourceReader extends EventEmitter {
    constructor() {
        super();

        this._data = [];

        this._pool = workerpool.pool(path.join(__dirname, '../worker/worker.js'), {
            workerType: 'process'
        });
    };

    async read(options) {
        if (!options || !options.path) {
            throw new Error('read() takes in a mandatory `options` parameter specifying the Madden 22 EXE path.');
        }

        const emitReadProgress = (data) => {
            this.emit('read-progress', data);
        };

        const readFromGameFiles = async () => {
            const casFilesToRead = await gameFileUtil.getAllCasFilesFromExe(options.path);
            progressTracker.totalSteps = casFilesToRead.length;

            let chunkParsePromises = [];
    
            for (let i = 0; i < casFilesToRead.length; i++) {
                const casFilePath = casFilesToRead[i];
    
                emitReadProgress(progressTracker.format(`[${i+1}/${progressTracker.totalSteps}]: Reading ${casFilePath.path}.`));
    
                const casBlockReader = new CASBlockReader(casFilePath.path);
    
                casBlockReader.on('chunk', (chunk) => {
                    chunkParsePromises.push(this._pool.exec('parseChunk', [{
                        data: chunk,
                        relativePath: casFilePath.relativePath
                    }]));
                });
    
                await casBlockReader.read();
                progressTracker.step();
            }
    
            this._data = await Promise.all(chunkParsePromises);
    
            emitReadProgress(progressTracker.format(`Finished reading CAS files.`));
    
            if (options && options.buildCache) {
                progressTracker.totalSteps = 1;
                progressTracker.reset();

                emitReadProgress(progressTracker.format(`Starting to build cache.`));
                await cacheUtil.buildAndSaveCache(this._data);
    
                progressTracker.step();
                emitReadProgress(progressTracker.format(`Cache built successfully.`));
            }
        };

        const progressTracker = new ProgressTracker(1);

        if (options && options.buildCache) {
            await readFromGameFiles();
        }
        else {
            try {
                this._data = await cacheUtil.getCache();
                emitReadProgress(progressTracker.format('Cache found.'));
            }
            catch (err) {
                emitReadProgress(progressTracker.format('Cache not found. Reading from game files...'));
                await readFromGameFiles();
            }
        }
        
        return this._data;
    };

    get data() {
        return this._data;
    };

    async getResource(name) {
        if (!name) { throw new Error('getResource() takes in a mandatory `name` parameter. The `name` parameter must be the name of the EBX file to read.'); }
        if (!this._data) { throw new Error('No cache data. You must call the `read()` function before calling this function.'); }
    };
};

module.exports = GameResourceReader;

class ProgressTracker {
    constructor(totalSteps) {
        this._currentStep = 0;
        this._totalSteps = totalSteps;
    };

    get totalSteps() {
        return this._totalSteps;
    };

    set totalSteps(steps) {
        this._totalSteps = steps;
    };

    step() {
        this._currentStep += 1;
    };

    format(message) {
        return {
            currentStep: this._currentStep,
            totalSteps: this._totalSteps,
            progress: (this._currentStep / this._totalSteps) * 100,
            message: message
        }
    };

    reset() {
        this._currentStep = 0;
    };
};