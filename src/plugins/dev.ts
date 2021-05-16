/**
 * Example command.
 */
import {visualize} from '../lib/utils';

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

export const commands = {Eval, Kill};
