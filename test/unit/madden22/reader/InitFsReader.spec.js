const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const { expect } = require('chai');
const rewiremock = require('rewiremock/node');

const PATH_TO_INITFS = 'D:\\Games\\Madden NFL 22\\Data\\initfs_Win32';
const key = fs.readFileSync(path.join(__dirname, '../../../data/madden22.key'));

const InitFsReader = rewiremock.proxy(() => require('../../../../src/madden22/reader/InitFsReader'), {
    
});

let reader = new InitFsReader();

describe('InitFsReader unit tests', () => {
    beforeEach(() => {
        reader = new InitFsReader();
    });

    describe('read()', () => {
        let options = {
            path: PATH_TO_INITFS,
            key: key.slice(0, 16)
        };

        it('throws an error if options are not passed in', (done) => {
            const promise = reader.read();

            promise.then(() => {
                done(new Error('Expected promise rejection, but promise was successful.'))
            })
            .catch((err) => {
                done();
            });
        });

        it('throws an error if path is null', (done) => {
            const promise = reader.read({});

            promise.then(() => {
                done(new Error('Expected promise rejection, but promise was successful.'))
            })
            .catch((err) => {
                done();
            });
        });

        it('throws an error if key is null', (done) => {
            const promise = reader.read({ path: '' });

            promise.then(() => {
                done(new Error('Expected promise rejection, but promise was successful.'))
            })
            .catch((err) => {
                done();
            });
        });

        it('reads in the initFs file', async () => {
            const initFsFile = await reader.read(options);
            expect(initFsFile.root._entries.length).to.equal(268);

            const std = initFsFile.root._entries.find((entry) => {
                return entry['$file'].name === 'SharedTypeDescriptors.ebx';
            });

            expect(std).to.exist;
            expect(std['$file'].payload.length).to.equal(421944);
        });
    });
});