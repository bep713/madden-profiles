const sinon = require('sinon');
const { expect } = require('chai');
const rewiremock = require('rewiremock/node');

const FileParser = require('madden-file-tools/filetypes/abstract/FileParser');

const ebxParserFile = {
    name: 'Test',
    ebx: {
        ebxd: {
            fileGuid: '1'
        }
    }
};

class EbxParserSpy extends FileParser {
    constructor() {
        super();
        
        this._file = ebxParserFile;
        this.skipBytes(Infinity);
    };
};

let zstdMock = {
    decompress: sinon.spy(() => {
        return Promise.resolve(Buffer.from([0x00]))
    })
};

const listToFileNameHierarchyResult = [{
    treeHierarchy: true
}];

let utilServiceSpy = {
    listToFileNameHierarchy: sinon.spy(() => {
        return listToFileNameHierarchyResult;
    })
};

const worker = rewiremock.proxy(() => require('../../../../src/madden22/worker/workerUtil'), {
    '@fstnetwork/cppzst': zstdMock,
    'madden-file-tools/services/utilService': utilServiceSpy,
    '../../../../src/madden22/parser/EBXParser': EbxParserSpy
});

describe('worker utility unit tests', () => {
    beforeEach(() => {
        zstdMock.decompress.resetHistory();
        utilServiceSpy.listToFileNameHierarchy.resetHistory();
    });

    describe('parseChunk()', () => {
        const message = {
            relativePath: 'fakepath/to/cas',
            data: {
                blocks: [
                    {
                        meta: {
                            isCompressed: true,
                            compressionType: 15
                        },
                        data: Buffer.from([0x00])
                    }
                ],
                offset: 123,
                sizeInCas: 456
            }
        };

        it('decompresses the compressed input', async () => {
            await worker.parseChunk(message);
            
            expect(zstdMock.decompress.callCount).to.equal(1);
            expect(zstdMock.decompress.firstCall.args[0]).to.eql(message.data.blocks[0].data);
        });

        it('expected result', async () => {
            const result = await worker.parseChunk(message);

            expect(result).to.eql({
                id: ebxParserFile.ebx.ebxd.fileGuid,
                name: ebxParserFile.name,
                file: message.relativePath,
                offset: message.data.offset,
                size: message.data.sizeInCas
            })
        });
    });

    describe('parseTreeHierarchy()', () => {
        const list = [
            {
                'test': 'test'
            }
        ];

        it('parses the tree hierarchy', async () => {
            await worker.parseTree({
                list: list
            });

            expect(utilServiceSpy.listToFileNameHierarchy.callCount).to.equal(1);
            expect(utilServiceSpy.listToFileNameHierarchy.firstCall.args[0]).to.eql(list);
        });

        it('returns expected result', async () => {
            const result = await worker.parseTree({
                list: list
            });

            expect(result).to.eql(listToFileNameHierarchyResult);
        });
    });
});