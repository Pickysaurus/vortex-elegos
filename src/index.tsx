import { types, util } from 'vortex-api';
import * as path from 'path';

const GAME_ID = 'elegos';
const STEAMAPP_ID = '1882300';
const STEAMTESTINGAPP_ID = '1882320';



function findGame(): string {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID, STEAMTESTINGAPP_ID])
        .then((game: any) => game.gamePath);
}

function main(context: types.IExtensionContext) {

    context.registerGame({
        id: GAME_ID,
        name: 'Elegos',
        mergeMods: (mod: types.IMod) => util.renderModName(mod, { version: true }),
        queryPath: findGame,
        queryModPath: () => 'Mods',
        logo: 'gameart.jpg',
        executable: () => 'Elegos.exe',
        requiredFiles: [
            'Elegos.exe'
        ],
        details: {
            steamAppId: STEAMAPP_ID
        }
    });

    return true;
}

export default main;