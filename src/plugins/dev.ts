/**
 * Example command.
 */
import {exec} from 'child_process';
import * as utils from '../lib/utils';
import {toID} from '../lib/utils';

function bash(cmd: string) {
    return new Promise(resolve => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                resolve(`Err in execution: ${err.message}`);
            }
            if (stderr) {
                resolve(`Stderr: ${stderr}`);
            }
            resolve(stdout || "");
        });
    });
}

export class Eval extends PS.CommandBase {
    async run() {
        this.isSysop();

        this.send(`!code >> ${this.target}`);
        const res = await utils.cleanEval(this.target, target => eval(target));
        this.send(`!code << ${res}`);
    }
}

export class Kill extends PS.CommandBase {
    async run() {
        this.isSysop();
        console.log(`${this.user.name} used /kill`);
        process.exit();
    }
    static aliases = ['restart'];
}

export class Ping extends PS.CommandBase {
    async run() {
        this.send(`Pong!`);
    }
    static help = ['/ping - Ping the bot.'];
}

export class ReloadCommands extends PS.CommandBase {
    async run() {
        this.isSysop();
        this.send(`Reloading...`);
        delete require.cache[require.resolve('../commands')];
        for (const key of ['CommandBase', "FilterBase"] as const) {
            PS[key] = require('../commands')[key];
        }
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

export class Update extends PS.CommandBase {
    async run() {
        this.isSysop();
        await bash('git stash'); // for local stuff
        this.send(`Code stashed.`);
        await bash('git pull https://github.com/mia-pi-git/showdown-bot.git');
        this.send('Code pulled.');
        await bash('git stash pop');
        this.send('Stash popped.');
        this.send(`DONE.`);
    }
}

export class Join extends PS.CommandBase {
    async run() {
        if (!PS.config.sysops?.includes(this.user.id)) {
            return this.send(`PM Mia to have her add the bot to rooms.`);
        }
        const target = toID(this.target);
        const info = await PS.query('roominfo', target);
        if (!info) {
            return this.send(`Room not found.`);
        }
        PS.join(target);
        PS.saveRooms();
    }
}