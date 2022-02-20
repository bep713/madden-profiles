const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { expect } = require('chai');

const STDReader = require('../../../../src/madden22/reader/SharedTypeDescriptorReader');

const m22TypesPath = path.join(__dirname, '../../../data/types/M22Types.json');
const sharedTypeDescriptorsM22Path = path.join(__dirname, '../../../data/ebx/SharedTypeDescriptors.ebx_M22.dat');

let reader, types;

describe('M22 STD Reader unit tests', () => {
    before(async () => {
        reader = new STDReader(fs.createReadStream(sharedTypeDescriptorsM22Path), m22TypesPath);
        types = await reader.read();
    });

    it('returns expected result', () => {
        expect(types).to.be.a('TypeDescriptorList');
        expect(types.types.length).to.equal(3233);
    });

    it('can read the types from cache', async () => {
        const typesGzip = fs.readFileSync(path.join(__dirname, '../../../data/types/m22.type.cache'));
        const loadedTypes = JSON.parse(zlib.gunzipSync(typesGzip));

        const reader = new STDReader();
        types = await reader.readFromCache(loadedTypes);
       
        expect(types).to.be.a('TypeDescriptorList');
        expect(types.types.length).to.equal(3232);
    });
});