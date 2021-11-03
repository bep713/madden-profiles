const { PluginLoaderBase } = require('plugnplay');

module.exports = class Madden22Loader extends PluginLoaderBase {
    export() {
        return Promise.resolve({
            parse: () => {
                console.log('Parsing M22');
            },

            getResource: (name) => {
                console.log('M22: Fetching resource', name);
            }
        })
    }
};