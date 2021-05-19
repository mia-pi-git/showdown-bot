/**
 * Example command.
 */
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
    async run() {
        this.isSysop();

        this.send(`!code >> ${this.target}`);
        const res = await utils.cleanEval(this.target, eval);
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

export class Help extends PS.CommandBase {
    run() {
        let cmd;
        const target = toID(this.target);
        for (const [k, handler] of Object.entries(PS.commands)) {
            if (k === target || handler.aliases.includes(target)) {
                cmd = k;
            }
        }
        if (!cmd) {
            return this.send(`Command ${target} not found.`);
        }
        const help = PS.commands[cmd].help;
        if (!help) {
            return this.send(`That command has no help info.`);
        }
        return this.send(`Help for ${cmd}: ` + PS.commands[cmd].help?.join(' '));
    }
    static aliases = ['guide'];
    static help = ['/help [command] - get info on the given command.'];
}

export const commands = {Eval, Kill, Ping, ReloadCommands, Help};
export const filters = [];
