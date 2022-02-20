const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');

const maddenTypeService = require('madden-file-tools/services/maddenTypeService'); 
const SharedTypeDescriptorParser = require('../parser/SharedTypeDescriptorParser');

const Type = require('madden-file-tools/filetypes/EBX/types/Type');
const Field = require('madden-file-tools/filetypes/EBX/types/Field');
const TypeDescriptorList = require('madden-file-tools/filetypes/EBX/types/TypeDescriptorList');

class Madden22SharedTypeDescriptorReader {
    constructor(typeDescriptorFileStream, m22ClassDefinitionFilePath) {
        this._typeDescriptorFileStream = typeDescriptorFileStream;
        this._classDefinitionFilePath = m22ClassDefinitionFilePath;

        this._sharedTypeParser = new SharedTypeDescriptorParser();
    };

    async read() {
        return new Promise((resolve, reject) => {
            pipeline(
                this._typeDescriptorFileStream,
                this._sharedTypeParser,
                (err) => {
                    if (err) {
                        reject(err);
                    }

                    if (this._classDefinitionFilePath) {
                        maddenTypeService.types = JSON.parse(fs.readFileSync(this._classDefinitionFilePath));
                    }
                    
                    maddenTypeService.mergeTypes(this._sharedTypeParser._file.types);
                    resolve(this._sharedTypeParser._file.types);
                }
            );
        });
    };

    async readFromCache(types) {
        const list = new TypeDescriptorList();

        types._types.forEach((type, index) => {

            let newType = new Type(type._nameHash, type._alignment, type._type, type._size, type._headerSize, 
                type._classGuid, type._typeInfoGuid, index);

            newType.name = type._name;

            type._fields.forEach((field, index) => {
                let newField = new Field(field._nameHash, field._offset, field._rawType, field._classRef, index);
                newField.name = field._name;

                newType.addField(newField);
            });

            list.addType(newType);
        });

        return list;
    };
};

module.exports = Madden22SharedTypeDescriptorReader;