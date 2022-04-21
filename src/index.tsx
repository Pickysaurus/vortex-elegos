import { fs, log, types, util } from 'vortex-api';
import * as path from 'path';
import { GAME_ID } from './common';
import { testElegosMod, installElegosMod } from './installers';
import { validate, serializeLoadOrder, deserializeLoadOrder, usageInstructions } from './loadorder';
import { ElegosSettings, ElegosVersionInfo } from './ElegosTypes';

const STEAMAPP_ID = '1882300';
const STEAMTESTINGAPP_ID = '1882320';

function findGame(): string {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID, STEAMTESTINGAPP_ID])
        .then((game: any) => game.gamePath);
}

async function setup(discovery: types.IDiscoveryResult): Promise<void> {
    // Ensure that the Mods folder exists.
    const modsFolder = path.join(discovery.path, 'Mods');
    try {
        await fs.ensureDirAsync(modsFolder);
    }
    catch(err) {
        throw new util.SetupError('Unable to create the Mods folder for Elegos, please try creating it manually before trying again. '+modsFolder);
    }

    const settingsPath = path.join(discovery.path, 'data', 'settings.json');
    try {
        const settingsRaw: string = await fs.readFileAsync(settingsPath, { encoding: 'utf8' });
        const settings: ElegosSettings = JSON.parse(settingsRaw);
        if (settings?.['modding.enabled'] === true) return;
        // We need to enable modding in the game settings.
        else {
            settings['modding.enabled'] = true;
            await fs.writeFileAsync(settingsPath, JSON.stringify(settings, null, 2));
        }
    }
    catch(err) {
        // If the settings.json file isn't present, modding is on by default.
        if (err.code !== 'ENOENT') log('error', 'Error checking Elegos settings.json for modding.enabled toggle', err);
        return;
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

async function getGameVersion(gamePath: string): Promise<string> {
    const versionFilePath = path.join(gamePath, 'data', 'version.json');
    try {
        const versionData = await fs.readFileAsync(versionFilePath, { encoding: 'utf8' });
        const versionJson: ElegosVersionInfo = JSON.parse(versionData);
        const version = `${versionJson.majorVersion || 0}.${versionJson.minorVersion || 0}.${versionJson.buildNumber || 0}`;
        return version;
    }
    catch(err) {
        log('warn', 'Could not resolve Elegos version number from JSON file', err);
        return '0.0.0';
    }
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
        getGameVersion,
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