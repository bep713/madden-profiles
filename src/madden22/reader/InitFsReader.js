const fs = require('fs');
const crypto = require('crypto');
const { pipeline, Readable } = require('stream');
const TocParser = require('madden-file-tools/streams/TOCParser');

class InitFsReader {
    constructor() {
        this._encryptedParser = new TocParser();
        this._decryptedParser = new TocParser();
    };

    read(options) {
        return new Promise((resolve, reject) => {
            if (!options || !options.path || !options.key) {
                throw new Error('read() takes in a mandatory `options` parameter specifying the Madden 22 initfs_Win32 path.');
            }
            
            pipeline(
                fs.createReadStream(options.path),
                this._encryptedParser,
                (err) => {
                    if (err) {
                        reject(err);
                    }

                    const encryptedEntry = this._encryptedParser._file.root._fields[0];
                    let decipher = crypto.createDecipheriv('aes-128-cbc', options.key, options.key);
                    let decrypted = Buffer.concat([ Buffer.alloc(556), decipher.update(encryptedEntry._value), decipher.final() ]);

                    pipeline(
                        Readable.from(decrypted),
                        this._decryptedParser,
                        (err) => {
                            if (err) {
                                reject(err);
                            }

                            resolve(this._decryptedParser._file);
                        }
                    )
                }
            )
        });
    };
};

module.exports = InitFsReader;