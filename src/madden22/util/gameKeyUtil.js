const path = require('path');
const zlib = require('zlib');
const fs = require('fs/promises');
const envPathUtil = require('./envPathUtil');

const KEY_PATH = path.join(envPathUtil.config, 'm22.key');

module.exports.saveKey = async (key) => {
    await fs.writeFile(KEY_PATH, key);
};

module.exports.getKey = async () => {
    const fullKey = await fs.readFile(KEY_PATH);
    return fullKey.slice(0, 16);
};