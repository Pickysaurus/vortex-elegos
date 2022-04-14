import { fs, log, selectors, types, util } from 'vortex-api';
import * as path from 'path';
import { GAME_ID } from './common';
import { ElegosModInfo } from './ElegosTypes';

async function validate(before: types.LoadOrder, after: types.LoadOrder): Promise<types.IValidationResult> {
    return;
}

async function serializeLoadOrder(api: types.IExtensionApi, order :types.LoadOrder): Promise<void> {
    const state: types.IState = api.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    if (!discovery?.path) return;
    const loadOrderPath = path.join(discovery.path, 'Mods', 'modorder.json');

    const loadOrder = order.reduce((prev, cur) => {
        if (cur.id) prev[cur.id] = cur.enabled;
        return prev;
    }, {});

    return fs.writeFileAsync(loadOrderPath, JSON.stringify(loadOrder, null, 2));
}

async function deserializeLoadOrder(api: types.IExtensionApi): Promise<types.LoadOrder> {
    const state: types.IState = api.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    if (!discovery?.path) return [];
    const modsPath = path.join(discovery.path, 'Mods');
    const loadOrderPath = path.join(discovery.path, 'Mods', 'modorder.json');

    // Get the IDs from the installed mods
    const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
    let managedIds: { modId: string, loadOrderId: string }[] = Object.values(mods).reduce((prev: {modId: string, loadOrderId: string}[], current: types.IMod) => {
        if (!!current?.attributes?.loadOrderId) prev.push({modId: current.id, loadOrderId: current?.attributes?.loadOrderId});
        return prev;
    }, new Array()) as { modId: string, loadOrderId: string }[];

    // Get the current loadorder file (this includes the enabled state)
    let loadorder: { loadOrderId: string, enabled?: boolean }[] = [];
    try {
        const loFile = await fs.readFileAsync(loadOrderPath, { encoding: 'utf8' });
        const lo = JSON.parse(loFile);
        loadorder = Object.keys(lo).map(entry => ({ loadOrderId: entry, enabled: lo[entry] }));
    }
    catch(err) {
        if (err.code !== 'ENOENT') log('warn', 'Failed to get Elegos load order data.', err);
    }

    // Get a list of actual mods in the folder. 
    const installedMods: { loadOrderId: string, name: string, type: 'zip' | 'folder' }[] = [];
    try {
        let fileList: string[] = await fs.readdirAsync(modsPath);
        // We want folders or zip files
        fileList = fileList.filter(f => path.extname(f) === '.zip' || !!path.extname(f))
        // exclude the temp folder
        .filter(f => !['temp'].includes(f.toLowerCase()));

        // Get ids from folder mods
        const folderModList = fileList.filter(f => path.extName(f) === '.zip');
        for (const folder of folderModList) {
            const manifest = await fs.readFileAsync(path.join(modsPath, folder, 'modinfo.json'));
            const modInfo: ElegosModInfo = JSON.parse(manifest);
            if (!!modInfo['ID']) installedMods.push({loadOrderId: modInfo.ID, name: modInfo.Name || folder, type: 'folder'});
        }

        // Get ids from zip mods
        const zipMods = fileList.filter(f => !path.extName(f));
        // NOT SUPPORTED YET
        installedMods.push({ loadOrderId: 'fdsfdsfsdf', name: 'Example Mod - ZIPs are not yet supported', type: 'zip' });

    }   
    catch(err) {
        log('error', 'Could not deserialise Elegos load order', err);
    } 

    // Compile all the data into a load order.
    const loadOrderComplete : types.LoadOrder = installedMods.map(mod => {
        const vortexMod = managedIds.find(managed => managed.loadOrderId === mod.loadOrderId);
        const loEntry = loadorder.find(lo => lo.loadOrderId === mod.loadOrderId);

        return {
            id: mod.loadOrderId,
            name: vortexMod ? util.renderModName(mods[vortexMod.modId]) : mod.name,
            enabled: loEntry?.enabled || false,
            modId: vortexMod ? mods[vortexMod.modId].id : undefined,
            data: {
                type: mod.type,
                index: loadorder.indexOf(loEntry) !== -1 ? loadorder.indexOf(loEntry) : 999
            }
        }

    }).sort((a, b) => a.data.index = b.data.index);
    
    return loadOrderComplete;
}

export { validate, serializeLoadOrder, deserializeLoadOrder };