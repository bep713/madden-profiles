const path = require('path');
const { Readable } = require('stream');
const workerpool = require('workerpool');
const { EventEmitter } = require('events');

const typeUtil = require('../util/typeUtil');
const cacheUtil = require('../util/cacheUtil');
const gameKeyUtil = require('../util/gameKeyUtil');
const gameFileUtil = require('../util/gameFileUtil');

const InitFsReader = require('./InitFsReader');
const CASBlockReader = require('./CASBlockReader');
const SharedTypeDescriptorReader = require('./SharedTypeDescriptorReader');

class GameResourceReader extends EventEmitter {
    constructor(m22Path) {
        super();

        this._data = [];
        this._types = [];

        this._basePath = m22Path;

        this._pool = workerpool.pool(path.join(__dirname, '../worker/worker.js'), {
            workerType: 'process'
        });
    };

    async read(options) {
        const emitReadProgress = (data) => {
            this.emit('read-progress', data);
        };

        const readFromGameFiles = async () => {
            const casFilesToRead = await gameFileUtil.getAllCasFilesFromExe(this._basePath);
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
                await cacheUtil.buildAndSaveCache(cacheUtil.CACHES.GAME, this._data);
    
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
                this._data = await cacheUtil.getCache(cacheUtil.CACHES.GAME);
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

    async readTypes(options) {
        const emitTypeProgress = (data) => {
            this.emit('type-progress', data);
        };

        const createTypeCache = async () => {
            progressTracker.totalSteps = 5;

            // read types from game SDK
            emitTypeProgress(progressTracker.format('Building types by reading the game memory...'));
            await typeUtil.buildAndSaveTypes({
                path: this._basePath
            });
            progressTracker.step();

            // get initFS path
            emitTypeProgress(progressTracker.format('Retrieving initfs path and key...'));
            const initFsPaths = await gameFileUtil.getInitFsPathFromExe(this._basePath);

            let key;

            // get initFS key
            if (options && options.key) {
                key = options.key;
            }
            else {
                try {
                    key = await gameKeyUtil.getKey();
                }
                catch (err) {
                    throw new Error('Reading types requires an encryption key passed in options. Usage: readTypes({ key: Buffer }).\n\tStack error: ' + err);
                }
            }
            progressTracker.step();

            const getStandardTypeDescriptors = async (path) => {
                let reader = new InitFsReader();
                const initFsFile = await reader.read({
                    key: key,
                    path: path
                });
                progressTracker.step();

                // Get shared type descriptors entry
                emitTypeProgress(progressTracker.format('Reading shared type descriptiors...'));
                return initFsFile.root._entries.find((entry) => {
                    return entry['$file'].name === 'SharedTypeDescriptors.ebx';
                });  
            };

            // Read InitFs patch first. If STDs not found, read from data.
            emitTypeProgress(progressTracker.format('Reading initfs patch...'));
            let std = await getStandardTypeDescriptors(initFsPaths.patch);
            
            if (!std) {
                emitTypeProgress(progressTracker.format('Type descriptors not found. Reading initfs from Data...'));
                std = await getStandardTypeDescriptors(initFsPaths.data);
            }

            const stream = Readable.from(std['$file'].payload);
            const stdReader = new SharedTypeDescriptorReader(stream);
            this._types = await stdReader.read();
            emitTypeProgress(progressTracker.format('Type descriptors read successfully.'));
            progressTracker.step();

            if (options && options.buildCache) {
                progressTracker.totalSteps = 1;
                progressTracker.reset();

                emitTypeProgress(progressTracker.format(`Starting to build cache...`));
                await cacheUtil.buildAndSaveCache(cacheUtil.CACHES.TYPES, this._types);
    
                progressTracker.step();
                emitTypeProgress(progressTracker.format(`Cache built successfully.`));
            }
        };

        let progressTracker = new ProgressTracker(1);

        if (options && options.buildCache) {
            await createTypeCache();
        }
        else {
            // Check if type cache exists
            try {
                const stdReader = new SharedTypeDescriptorReader();
                const typesFromCache = await cacheUtil.getCache(cacheUtil.CACHES.TYPES);
                this._types = await stdReader.readFromCache(typesFromCache);

                emitTypeProgress(progressTracker.format('Type cache found.'));
            }
            catch (err) {
                emitTypeProgress(progressTracker.format('Type cache not found. Creating type cache...'));
                await createTypeCache();
            }
        }

        return this._types;
    };

    async getResource(name) {
        if (!name) { throw new Error('getResource() takes in a mandatory `name` parameter. The `name` parameter must be the name of the EBX file to read.'); }
        if (!this._data) { throw new Error('No cache data. You must call the `read()` function before calling this function.'); }
        
        // Find the resource from cache
        const entry = this._data.find((entry) => {
            return entry.name.toLowerCase() === name.toLowerCase();
        });

        if (!entry) {
            throw new Error(`Cannot find an entry in the cache with name: ${name}.`);
        }

        const reader = new CASBlockReader(path.join(this._basePath, '../', entry.file), this._types, {
            size: entry.size,
            readEbxData: true,
            start: entry.offset,
            decompressChunks: true,
        });

        const resources = await reader.read();
        return resources[0];
    };

    async getResourceData(name) {
        if (!name) { throw new Error('getResource() takes in a mandatory `name` parameter. The `name` parameter must be the name of the EBX file to read.'); }
        if (!this._data) { throw new Error('No cache data. You must call the `read()` function before calling this function.'); }
        
        // Find the resource from cache
        const entry = this._data.find((entry) => {
            return entry.name.toLowerCase() === name.toLowerCase();
        });

        if (!entry) {
            throw new Error(`Cannot find an entry in the cache with name: ${name}.`);
        }

        const reader = new CASBlockReader(path.join(this._basePath, '../', entry.file), this._types, {
            size: entry.size,
            start: entry.offset,
            decompressChunks: true,
            exportOptions: {
                export: true
            }
        });

        const file = await reader.read();
        return file[0].data;
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