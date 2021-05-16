/**
 * Example command.
 */
import {visualize} from '../lib/utils';
import {exec} from 'child_process';

function bash(cmd: string) {
    return new Promise(resolve => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                throw new PS.CommandError(`Err in execution: ${err.message}`);
            }
            if (stderr) {
                throw new PS.CommandError(`Exec resolved to stderr: ${stderr}`);
            }
            resolve(stdout || "");
        });
    });
}

export class Eval extends PS.CommandBase {
    async init() {}
    async run() {
        this.isSysop();

        this.send(`!code >> ${this.target}`);
        let res;
        try {
            res = eval(this.target);
            if (typeof res?.then === 'function') {
                res = `Promise -> ${visualize(await res)}`;
            }
        } catch (e) {
            res = `Err: ${e.message}\n${e.stack}`;
        }
        this.send(`!code << ${visualize(res)}`);
    }
}

class Kill extends PS.CommandBase {
    async init() {}
    async run() {
        this.isSysop();
        console.log(`${this.user.name} used /kill`);
        process.exit();
    }
}

class Ping extends PS.CommandBase {
    async init() {}
    async run() {
        this.send(`Pong!`);
    }
}

class ReloadCommands extends PS.CommandBase {
    async init() {}
    async run() {
        this.isSysop();
        this.send(`Reloading...`);
        this.clearCache();
        await bash('npx tsc');
        PS.commands = {};
        PS.loadPlugins();
        this.send(`Done.`);
    }
    clearCache() {
        for (const k in require.cache) {
            if (k.includes('/plugins/')) {
                delete require.cache[k];
            }
        }
    }
}

export const commands = {Eval, Kill, Ping, ReloadCommands};
export const filters = [];
