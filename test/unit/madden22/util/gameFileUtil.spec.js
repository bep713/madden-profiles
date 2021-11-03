const path = require('path');
const { expect } = require('chai');
const m22GameFileUtil = require('../../../../src/madden22/util/gameFileUtil');

const M22_EXE_PATH = 'D:\\Games\\Madden NFL 22\\Madden22.exe';
const DATA_CAS_PATH = 'D:\\Games\\Madden NFL 22\\Data\\Win32\\superbundlelayout';
const PATCH_CAS_PATH = 'D:\\Games\\Madden NFL 22\\Patch\\Win32\\superbundlelayout';

describe('M22 Game File Util unit tests', () => {
    describe('get all cas files from an EXE file path', () => {
        it('method exists', () => {
            expect(m22GameFileUtil.getAllCasFilesFromExe).to.exist;
        });

        it('returns expected number of results', async () => {
            const casFiles = await m22GameFileUtil.getAllCasFilesFromExe(M22_EXE_PATH);
            expect(casFiles.length).to.equal(47);
        });

        it('isPatch is false for data CAS files', async () => {
            const casFiles = await m22GameFileUtil.getAllCasFilesFromExe(M22_EXE_PATH);
            const firstCasFile = casFiles.find((casFile) => {
                return casFile.casId === 1 && casFile.installPackageId === 0 && !casFile.isPatch;
            });

            expect(firstCasFile.path).to.equal(path.join(DATA_CAS_PATH, 'madden_installpackage_00', 'cas_01.cas'));
        });

        it('returns expected relative path', async () => {
            const casFiles = await m22GameFileUtil.getAllCasFilesFromExe(M22_EXE_PATH);
            const firstCasFile = casFiles.find((casFile) => {
                return casFile.casId === 1 && casFile.installPackageId === 0 && !casFile.isPatch;
            });

            expect(firstCasFile.relativePath).to.equal(path.join('Data/Win32/superbundlelayout', 'madden_installpackage_00', 'cas_01.cas'));
        });
    });
});