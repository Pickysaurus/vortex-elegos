export interface ElegosModInfo {
    ID?: string;
    Name?: string;
    Description?: string;
    Author?: string;
    ModVersion?: string;
    GameVersion?: string;
    Tags?: string;
}

export interface ElegosLoadOrder {
    [id: string] : boolean;
}

export interface ElegosSettings {
    'modding.enabled'? : boolean;
}

export interface ElegosVersionInfo {
    // This is the version.json file in the game's data folder.
    buildConfiguration?: string;
    buildFolder?: string;
    compressed?: boolean;
    buildNumber?: number;
    buildDate?: string;
    majorVersion?: number;
    minorVersion?: number;
    name?: string;
    hideFlags?: string; 
}