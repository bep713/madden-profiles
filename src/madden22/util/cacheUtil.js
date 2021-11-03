const path = require('path');
const zlib = require('zlib');
const fs = require('fs/promises');
const envPathUtil = require('./envPathUtil');

const CACHE_LOCATION = path.join(envPathUtil.config, 'm22.cache');

module.exports.buildAndSaveCache = (data) => {
    return new Promise(async (resolve, reject) => {
        zlib.gzip(JSON.stringify(data), async (err, compressedData) => {
            if (err) {
                reject(err);
            }

            await fs.writeFile(CACHE_LOCATION, compressedData);
            resolve(compressedData);
        });
    });
};

module.exports.getCache = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const compressedCache = await fs.readFile(CACHE_LOCATION);

            zlib.gunzip(compressedCache, (err, decompressedData) => {
                if (err) {
                    reject(err);
                }
    
                resolve(JSON.parse(decompressedData));
            });
        }
        catch (err) {
            reject(err);
        }
    });
};