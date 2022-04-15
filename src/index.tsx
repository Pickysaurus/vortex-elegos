import { fs, types, util } from 'vortex-api';
import * as path from 'path';
import { GAME_ID } from './common';
import { testElegosMod, installElegosMod } from './installers';
import { validate, serializeLoadOrder, deserializeLoadOrder, usageInstructions } from './loadorder';

const STEAMAPP_ID = '1882300';
const STEAMTESTINGAPP_ID = '1882320';

function findGame(): string {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID, STEAMTESTINGAPP_ID])
        .then((game: any) => game.gamePath);
}

async function setup(discovery: types.IDiscoveryResult) {
    // Ensure that the Mods folder exists.
    const modsFolder = path.join(discovery.path, 'Mods');
    try {
        await fs.ensureDirAsync(modsFolder);
    }
    catch(err) {
        throw new util.SetupError('Unable to create the Mods folder for Elegos, please try creating it manually before trying again.');
    }

    const settingsPath = path.join(discovery.path, 'data', 'settings.json');
    try {
        const settingsRaw: string = await fs.readFileAsync(settingsPath, { encoding: 'utf8' });
        const settings: Object = JSON.parse(settingsRaw);
        if (settings?.['modding.enabled'] === true) return;
        // We need to enable modding in the game settings.
        else {
            settings['modding.enabled'] = true;
            await fs.writeFileAsync(settingsPath, JSON.stringify(settings, null, 2));
        }
    }
    catch(err) {
        // Most like the settings.json is missing. 
        throw new util.SetupError('Unable to enable modding for Elegos, please make sure you have started the game at least once before managing it.');
    }
}

function santizeModName(input: string): string {
    // Make the mod name file system safe. 
    const illegalRe = /[\/\?<>\\:\*\|":]/g;
    const controlRe = /[\x00-\x1f\x80-\x9f]/g;
    const reservedRe = /^\.+$/;
    const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

    return input
    .replace(illegalRe, ' ')
    .replace(controlRe, '')
    .replace(reservedRe, '')
    .replace(windowsReservedRe, ''); 
}



function main(context: types.IExtensionContext) {

    context.registerGame({
        id: GAME_ID,
        name: 'Elegos',
        mergeMods: (mod: types.IMod) => santizeModName(util.renderModName(mod)),
        queryPath: findGame,
        queryModPath: () => 'Mods',
        setup,
        logo: 'gameart.jpg',
        executable: () => 'Elegos.exe',
        requiredFiles: [
            'Elegos.exe'
        ],
        details: {
            steamAppId: STEAMAPP_ID
        }
    });

    // Register the installer to extract the modinfo data.
    context.registerInstaller('elegos-mod', 25, testElegosMod, installElegosMod);

    // Register the load order page.
    context.registerLoadOrder({
        gameId: GAME_ID,
        toggleableEntries: true,
        serializeLoadOrder: (lo) => serializeLoadOrder(context.api, lo),
        deserializeLoadOrder: () => deserializeLoadOrder(context.api),
        validate,
        usageInstructions
    });

    return true;
}

export default main;