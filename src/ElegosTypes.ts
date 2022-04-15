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