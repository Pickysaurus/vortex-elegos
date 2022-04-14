import { types, util } from 'vortex-api';
import * as path from 'path';

const GAME_ID = 'elegos';
const STEAMAPP_ID = '1328670';



function findGame(): string {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID])
        .then((game: any) => game.gamePath);
}

function main(context: types.IExtensionContext) {

    context.registerGame({
        id: GAME_ID,
        name: 'Elegos',
        mergeMods: true,
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