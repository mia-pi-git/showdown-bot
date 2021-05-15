import {PSConnection} from './connection';
import * as utils from './lib/utils';
import * as fs from 'fs';
import {CommandBase} from './commands';

export interface BotSettings {
    name: string;
    pass: string | null;
    rooms?: string[];
    status?: string;
    commandToken: string;
}

export interface PLine {
    type: string;
    args: string[];
    roomid?: string;
}

export type BotCommand = (
    this: PSInterface, input: string, user: string, room: string | null, line: PLine
) => any;

export class PSInterface {
    connection: PSConnection;
    settings: BotSettings;
    curName = '';
    listeners: {[type: string]: (this: PSInterface, args: string[], line: PLine) => any} = {
        challstr(args) {
            const [key, challstr] = args;
            void this.login(challstr, parseInt(key));
        },
        updateuser(args) {
            const cur = this.curName.slice();
            this.curName = utils.splitFirst(args[0], '@!')[0];
            if (utils.toID(cur) !== utils.toID(this.curName)) {
                console.log(`name updated to ${this.curName}`);
            }
        },
        'c:'(args, line) {

        },
        pm(args, line) {

        },
        queryresponse(args, line) {
            const type = args.shift()!;
            const resolve = this.queries.get(type);
            if (resolve) {
                resolve(JSON.parse(args.join('|')));
                this.queries.delete(type);
            }
        },
    }
    /**
     * Use PSInterface#registerCommands to add to this.
     * (Or PSInterface#getCommandsFrom, which will load from the given filepath)
     */
    commands: {[k: string]: typeof CommandBase} = {};
    /**
     * Pending /crq requests.
     */
    queries = new Map<string, (data: {[k: string]: any}) => void>();
    constructor(settings: BotSettings | string) {
        this.settings = PSInterface.getConfig(settings);
        this.connection = new PSConnection();
        void this.listen();
        this.loadPlugins();
    }
    query(type: string, data = '') {
        return new Promise<any>(resolve => {
            this.send(`/crq ${type}${data ? ` ${data}` : ''}`);
            this.queries.set(type, resolve);
        });
    }
    send(data: string, roomid?: string) {
        if (!roomid || roomid === 'global') roomid = '';
        this.connection.send(`${roomid}|${data}`);
    }
    async listen() {
        for await (const {type, data} of this.connection) {
            switch (type) {
            case 'open': {
                console.log(`Bot connected to the server!`);
                break;
            }

            case 'message': {
                this.handleMessage(data as string);
                break;
            }

            case 'close': {
                console.log(`Bot socket closed - code ${data.code}, reason '${data.reason}'`);
                process.exit();
            }

            case 'error': {
                console.log(`bot encountered an error`);
                console.log(data);
                break;
            }

            }
        }
    }
    handleMessage(raw: string) {
        const line = PSInterface.parseLine(raw);
        this.listeners[line.type]?.call(this, line.args, line);
    }
    static parseLine(received: string): PLine {
        let [possibleRoomid, rest] = utils.splitFirst(received, '\n');
        const line: Partial<PLine> = {};
        if (possibleRoomid?.startsWith('>')) {
            line.roomid = utils.toID(possibleRoomid);
        } else {
            rest = received;
        }
        const parts = rest.split('|');
        parts.shift(); // always '';
        line.type = parts.shift() as string;
        line.args = parts;
        return line as PLine;
    }
    static getConfig(pathOrObj: BotSettings | string) {
        if (typeof pathOrObj === 'string') {
            return require('../' + pathOrObj);
        }
        return pathOrObj as BotSettings;
    }
    async login(challstr: string, challengekeyid: number) {
        const data = await utils.post(`https://play.pokemonshowdown.com/action.php`, {
            name: this.settings.name,
            pass: this.settings.pass,
            act: 'login',
            challstr,
            challengekeyid,
        });
        if (data.actionerror) {
            throw new Error(data.actionerror);
        }
        if (!data.assertion) {
            console.log(data);
            throw new Error(`Missing assertion - data logged above`);
        }
        if (data.assertion.startsWith(';;')) {
            throw new Error(data.assertion.slice(2));
        }
        this.send(`/trn ${this.settings.name},0,${data.assertion}`);
    }
    loadCommandsFrom(path: string) {
        const handler = require(`${__dirname}/../${path}`).default;
        this.commands[handler.cmdName] = handler;
    }
    loadPlugins() {
        try {
            const path = require.resolve('./commands');
            const files = fs.readdirSync(path);
            for (const file of files) {
                this.loadCommandsFrom(`${path}/${file}`);
            }
        } catch (e) {}
    }
}
