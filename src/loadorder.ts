import { fs, log, selectors, types, util } from 'vortex-api';
import * as path from 'path';
import { GAME_ID, MANIFEST_FILE } from './common';
import { ElegosLoadOrder, ElegosModInfo } from './ElegosTypes';

const usageInstructions = (): string => {
    return 'Elegos loads mods for folders or zip archives located in the Mods directory of the game installation. '+
    'The load order controls which changes will be used where multiple mods edit the same game assets. '+
    'Load order entries with a lower index number will overwrite any others (e.g. The mod in slot 1 overwrites anything below it that makes the same edits). '+
    'The icon on each mod indicates if they are loaded from a folder (📂) or a zip file (🗜️).';
}

async function validate(before: types.LoadOrder, after: types.LoadOrder): Promise<types.IValidationResult> {
    // Check for duplicate IDs
    const counts = after.reduce((prev, cur) => {
        if (!!prev[cur.data.id]) prev[cur.data.id].push(cur.id);
        else prev[cur.data.id] = [cur.id];
        return prev;
    }, {});

    const duplicates = Object.keys(counts).reduce((prev, cur) => {
        const value: string[] = counts[cur];
        if (value.length > 1) prev[cur] = counts[cur];
        return prev;
    }, {});

    if (!duplicates || !Object.keys(duplicates).length) return;

    const invalid = Object.keys(duplicates).map(id => {
        const dupes: types.ILoadOrderEntry[] = duplicates[id].map(d => after.find(e => e.id === d));
        const lastEntry = dupes.pop();
        const invalidEntry = { id: lastEntry.id, reason: `${lastEntry.name} has the same ID in the ${MANIFEST_FILE} as ${dupes.map(d => d.name)}. IDs must be unique. ${lastEntry.data.id}` };
        return invalidEntry;             
    });

    return { invalid };
}

async function serializeLoadOrder(api: types.IExtensionApi, order :types.LoadOrder): Promise<void> {
    const state: types.IState = api.getState();
    const discovery = selectors.discoveryByGame(state, GAME_ID);
    if (!discovery?.path) return;
    const loadOrderPath = path.join(discovery.path, 'Mods', 'modorder.json');
    
    const loadOrder = order.reduce((prev, cur) => {
        if (cur.data?.id) prev[cur.data.id] = cur.enabled;
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

    // Initialise the load order.
    const loadOrderResult: types.LoadOrder = [];

    // Get a list of actual mods in the folder. 
    try {
        let fileList: string[] = await fs.readdirAsync(modsPath);
        // We want folders or zip files
        fileList = fileList.filter(f => path.extname(f) === '.zip' || !path.extname(f))
        // exclude the temp folder
        .filter(f => !['temp'].includes(f.toLowerCase()));

        // Get ids from folder mods
        const folderModList = fileList.filter(f => !path.extname(f));
        for (const folder of folderModList) {
            const manifest = await fs.readFileAsync(path.join(modsPath, folder,  MANIFEST_FILE));
            const modInfo: ElegosModInfo = JSON.parse(manifest);
            if (!!modInfo['ID']) loadOrderResult.push({id: `folder-${folder.toLowerCase()}`, name: `📂 ${modInfo.Name}` || folder, enabled: false, data: { type: 'folder', id: modInfo.ID }});
        }

        // Get ids from zip mods
        const zipMods = fileList.filter(f => path.extname(f) === '.zip');

        if (zipMods.length) {
            const zipper = new util.SevenZip();
            for (const zip of zipMods) {
                try {
                    // Extract the zip to read the modinfo file, then delete it. 
                    const zipPath = path.join(modsPath, zip);
                    const tempPath = path.join(modsPath, 'temp', path.basename(zip, path.extname(zip)));
                    await zipper.extract(zipPath, tempPath);
                    const info = await fs.readFileAsync(path.join(tempPath, MANIFEST_FILE), { encoding: 'utf8' });
                    const modInfo: ElegosModInfo = JSON.parse(info);
                    if (!!modInfo['ID']) loadOrderResult.push({ id: `zip-${zip.toLowerCase()}`, name: `🗜️ ${modInfo.Name}`, enabled: false, data: { type: 'zip', id: modInfo.ID } });
                    await fs.removeAsync(tempPath);
                }
                catch(err) {
                    log('warn', 'Unable to process Elegos mod archive', { name: zip, error: err });
                }
            }
        }

    }   
    catch(err) {
        log('error', 'Failed to read mods from the Elegos mod directory', err);
    }

    // Get the IDs from the installed mods and map them as appropraite. 
    const mods: { [id: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
    const profile: types.IProfile = selectors.activeProfile(state);
    const managedMods: types.IMod[] = Object.values(mods).filter((mod: types.IMod) => profile.modState?.[mod.id]?.enabled === true);
    for (const mod of managedMods) {
        const loId = mod.attributes.loadOrderId;
        const loEntry = loadOrderResult.find(i => i.data?.id === loId && i.data?.type === 'folder');
        if (!loEntry) continue;
        loEntry.modId = mod.id;
        loEntry.name = `📂 ${util.renderModName(mod)}`;
    }

    // Get the current loadorder file (this includes the enabled state)
 
    try {
        const loFile = await fs.readFileAsync(loadOrderPath, { encoding: 'utf8' });
        const lo: ElegosLoadOrder = JSON.parse(loFile);
        const loKeys = Object.keys(lo);
        for (const key of loKeys) {
            const state = lo[key];
            const loEntry = loadOrderResult.find(e => e.data?.id === key);
            if (!loEntry) continue;
            loEntry.enabled = state;
        }
        // Order the load order to match the 
        loadOrderResult.sort((a : types.ILoadOrderEntry, b: types.ILoadOrderEntry) => {
            const aIndex = loKeys.indexOf(a.data?.id) !== -1 ? loKeys.indexOf(a.data?.id) : 999;
            const bIndex = loKeys.indexOf(b.data?.id) !== -1 ? loKeys.indexOf(b.data?.id) : 999;
            return aIndex - bIndex;
        });
    }
    catch(err) {
        if (err.code !== 'ENOENT') log('warn', 'Failed to get Elegos load order data.', err);
    } 

    return loadOrderResult;
}

export { validate, serializeLoadOrder, deserializeLoadOrder, usageInstructions };