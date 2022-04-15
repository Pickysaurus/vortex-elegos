import { fs, types, log } from 'vortex-api';
import * as path from 'path';
import { GAME_ID, MANIFEST_FILE } from './common';
import { ElegosModInfo } from './ElegosTypes';

function testElegosMod(files: string[], gameId: string) {
    // Check that this is the right game and there is a modinfo file.
    const supported = ((gameId === GAME_ID) && !!files.find(f => f.toLowerCase() === MANIFEST_FILE));
    return { supported, requiredFiles: [] };
}

async function installElegosMod(files: string[], destinationPath: string): Promise<types.IInstallResult> {
    // Extract attributes from the modinfo file
    let instructions: types.IInstruction[] = [];
    const modinfoFile: string = files.find(f => f.toLowerCase() === MANIFEST_FILE);
    const modinfoPath: string = path.join(destinationPath, modinfoFile);
    try {
        const info: string = await fs.readFileAsync(modinfoPath, { encoding: 'utf8' });
        const modinfo: ElegosModInfo = JSON.parse(info);
        instructions = instructions.concat(modInfoToAttributes(modinfo));
    }
    catch(err) {
        log('warn', 'Unable to resolve modinfo.json data', err);
    }

    // Build the file list
    const fileInstructions: types.IInstruction[] = files.filter(f => !!path.extname(f))
    .map(f => ({ type: 'copy', source: f, destination: f }));

    // Combine the instructions and attributes.
    instructions = instructions.concat(fileInstructions);

    return { instructions };
}

function modInfoToAttributes(modInfo: ElegosModInfo): types.IInstruction[] {
    let results: types.IInstruction[] = [];
    if (modInfo.ID) results.push({ type:'attribute', key: 'loadOrderId', value: modInfo.ID });
    if (modInfo.Name) results.push({ type:'attribute', key: 'customFileName', value: modInfo.Name });
    if (modInfo.Author) results.push({ type: 'attribute', key: 'author', value: modInfo.Author });
    if (modInfo.Description) results.push({ type: 'attribute', key: 'shortDescription', value: modInfo.Description });
    if (modInfo.GameVersion) results.push({ type: 'attribute', key: 'minGameVersion', value: modInfo.GameVersion });
    if (modInfo.ModVersion) results.push({ type: 'attribute', key: 'version', value: modInfo.ModVersion });
    return results;
}

export { testElegosMod, installElegosMod };