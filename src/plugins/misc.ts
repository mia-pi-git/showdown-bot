/**
 * Misc commands (help, etc).
 */

import {toID} from '../lib/utils';

export class Git extends PS.CommandBase {
    run() {
        return this.send(`Bot repo: https://github.com/mia-pi-git/showdown-bot`);
    }
    static aliases = ['github', 'repo'];
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
