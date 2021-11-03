const workerpool = require('workerpool');
const { parseChunk } = require('./workerUtil');

workerpool.worker({
    parseChunk: parseChunk
});