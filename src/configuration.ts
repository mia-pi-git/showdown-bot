/**
 * Configuration.
 */

export interface Configuration {
    name: string;
    pass: string | null;
    rooms?: string[];
    status?: string;
    commandToken: string;
    loglevel?: number;
    sysops?: string[];
    repl?: boolean;
    reload: () => Configuration;
    [k: string]: any;
}

export function load(renew = false) {
    const path = require.resolve('../config/config');
    if (renew) delete require.cache[path];
    const imports = require(path);
    Object.assign(imports, {
        reload: () => load(true),
    });
    if (renew) Object.assign(Config, imports);
    return imports as Configuration;
}

export const Config = load();

