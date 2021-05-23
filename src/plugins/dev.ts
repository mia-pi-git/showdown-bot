/**
 * Example command.
 */
import {exec} from 'child_process';
import {SQL} from '../lib/sqlite';
import fs from 'fs';

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
    async run() {
        this.isSysop();

        this.send(`!code >> ${this.target}`);
        const res = await utils.cleanEval(this.target, target => eval(target));
        this.send(`!code << ${res}`);
    }
}

class Kill extends PS.CommandBase {
    async run() {
        this.isSysop();
        console.log(`${this.user.name} used /kill`);
        process.exit();
    }
    static aliases = ['restart'];
}

class Ping extends PS.CommandBase {
    async run() {
        this.send(`Pong!`);
    }
    static help = ['/ping - Ping the bot.'];
}

class ReloadCommands extends PS.CommandBase {
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

export class EvalSql extends PS.CommandBase {
    run() {
        const [file, query] = utils.splitFirst(this.target, ',');
        if (!file || !fs.existsSync(`${__dirname}/../databases/${file}`)) {
            return this.send(`Specify a valid filename to access.`);
        }
        const db = SQL(file);
        let result;
		try {
			// presume it's attempting to get data first
			result = db.all(query);
		} catch (err) {
			// it's not getting data, but it might still be a valid statement - try to run instead
			if (err.message?.includes(`Use run() instead`)) {
				try {
					result = db.run(query);
				} catch (e) {
					result = ('' + e.stack);
				}
			} else {
				result = ('' + err.stack);
			}
		}
        this.send(utils.visualize(result));
    }
}

export const commands = {Eval, Kill, Ping, ReloadCommands, EvalSql};
export const filters = [];
