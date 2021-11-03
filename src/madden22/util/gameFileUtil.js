const path = require('path');
const fs = require('fs/promises');

module.exports.getAllCasFilesFromExe = async (exePath) => {
    const DATA_PATH = 'Data/Win32/superbundlelayout';
    const PATCH_PATH = 'Patch/Win32/superbundlelayout';

    let casFiles = [];

    const dataReadPromises = await readCasFilesFromParentDirectory(exePath, DATA_PATH);
    const patchReadPromises = await readCasFilesFromParentDirectory(exePath, PATCH_PATH, true);
    await Promise.all([...dataReadPromises, ...patchReadPromises]);

    return casFiles;

    async function readCasFilesFromParentDirectory(exePath, parentPath, isPatch = false) {
        let promises = [];

        const fullPath = path.join(exePath, '..', parentPath);

        const installPackages = await fs.readdir(fullPath);
        installPackages.forEach((dataInstallPackageDir) => {
            promises.push(new Promise(async (resolve, reject) => {
                const installPackageIdRaw = dataInstallPackageDir.substring(dataInstallPackageDir.lastIndexOf('_') + 1);
                let installPackageId = installPackageIdRaw;

                if (installPackageIdRaw !== 'lcu') {
                    installPackageId = parseInt(installPackageIdRaw);
                }

                const casFilePath = path.join(fullPath, dataInstallPackageDir);
                const casFilesInDir = await fs.readdir(casFilePath);
    
                casFilesInDir.forEach((casFile) => {
                    const casId = parseInt(casFile.substring(casFile.lastIndexOf('_') + 1, casFile.indexOf('.')));

                    casFiles.push({
                        isPatch: isPatch,
                        casId: casId,
                        installPackageId: installPackageId,
                        path: path.join(casFilePath, casFile),
                        relativePath: path.join(parentPath, dataInstallPackageDir, casFile)
                    });
                });
    
                resolve();
            }));
        });

        return promises;
    }
};