const { exec } = require('child_process');
const MemoryManager = require('madden-file-tools/services/MemoryManager');
const maddenTypeService = require('madden-file-tools/services/maddenTypeService');

const PROCESS_NAME = 'Madden22_orig.exe';

module.exports.buildAndSaveTypes = async (options) => {
    if (!options || !options.path) { 
        throw new Error('buildAndSaveTypes() takes in a mandatory `path` argument which should be a string path to '
            + 'the Madden22.exe file, including Madden22.exe on the end.'); 
    }

    const manager = new MemoryManager(PROCESS_NAME);
    const isRunning = await manager.isProcessRunning();

    if (!isRunning) {
        exec(`"${options.path}"`);

        let processCheckIntervalPromise = new Promise((resolve, reject) => {
            // check every 750ms if the game is running. After 75s, stop checking.
            let currentTry = 0;
            const maxTries = 100;

            let processCheckInterval = setInterval(async () => {
                const isRunning = await manager.isProcessRunning();

                if (isRunning) {
                    clearInterval(processCheckInterval);
                    resolve();
                }
                else {
                    currentTry += 1;

                    if (currentTry >= maxTries) {
                        clearInterval(processCheckInterval);
                        reject('Timeout reached. Cannot attach to Madden22.exe. Please re-run and ensure the game is running on your machine.');
                    }
                }
            }, 750);
        });

        try {
            await processCheckIntervalPromise;
        }
        catch(err) {
            throw err;
        }
    }

    // parse types from the game process
    await maddenTypeService.parseTypes(PROCESS_NAME);

    // parse name hashes from the STD file
    

    // await fs.writeFile(path.join(envPathUtil.config, TYPE_CACHE_NAME), types);

    // return types;
};