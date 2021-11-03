const zstd = require('@fstnetwork/cppzst');
const EBXParser = require('../parser/EBXParser');
const { Readable, pipeline } = require('stream');
const utilService = require('madden-file-tools/services/utilService');
const CASBlockParser = require('madden-file-tools/streams/CASBlockParser');

async function parseChunk(message) {
    let chunk = message.data;

    const firstBlock = chunk.blocks[0];

    if (firstBlock.meta.isCompressed) {
        switch(firstBlock.meta.compressionType) {
            case CASBlockParser.COMPRESSION_TYPE.ZSTD:
                return _onZstdCompressedBlock(chunk);
            default:
                return {
                    event: 'parse-chunk',
                    result: null
                };
        };
    }
    else {
        return{
            event: 'parse-chunk',
            result: null
        };
    }

    function _onZstdCompressedBlock(chunk) {
        return new Promise(async (resolve, reject) => {
            let decompressionPromises = chunk.blocks.map((block, index) => {
                return new Promise(async (resolve, reject) => {
                    try {
                        const decompressedData = await zstd.decompress(Buffer.from(block.data));
                        resolve({
                            index: index,
                            data: decompressedData
                        });
                    }
                    catch (err) {
                        resolve({
                            index: index,
                            data: null
                        });
                    }
                });
            });
            
            const decompressedDataBufferMetadata = await Promise.all(decompressionPromises);
            decompressedDataBufferMetadata.sort((a, b) => {
                return a.index - b.index;
            });
            
            const decompressedDataBuffers = decompressedDataBufferMetadata.filter((meta) => {
                return meta.data !== null;
            }).map((meta) => {
                return meta.data;
            });
            
            const decompressedData = Buffer.concat(decompressedDataBuffers);
            const readStream = Readable.from(decompressedData);
            let ebxParser = new EBXParser();
            
            pipeline(
                readStream,
                ebxParser,
                (err) => {
                    if (err) {
                        reject({
                            event: 'parse-chunk',
                            result: null
                        });
                    }
                    
                    let ebxFile = ebxParser._file;
                    ebxFile.offset = chunk.offset;
                    ebxFile.sizeInCas = chunk.sizeInCas;

    
                    resolve({
                        id: ebxFile.ebx.ebxd.fileGuid,
                        name: ebxFile.name,
                        file: message.relativePath,
                        offset: ebxFile.offset,
                        size: ebxFile.sizeInCas,
                    });
                }
            );
        });
        
    };
};

async function parseTree(message) {
    const treeHierarchy = utilService.listToFileNameHierarchy(message.list);
    return treeHierarchy;
};

module.exports = {
    parseTree: parseTree,
    parseChunk: parseChunk
};
