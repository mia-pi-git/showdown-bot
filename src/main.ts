import {PSConnection} from './connection';
import * as utils from './lib/utils';
import * as fs from 'fs';
import {CommandBase, CommandError, FilterBase} from './commands';
import {PSUser} from './user';
import {PSRoom} from './room';

export interface BotSettings {
    name: string;
    pass: string | null;
    rooms?: string[];
    status?: string;
    commandToken: string;
    loglevel?: number;
    sysops?: string[];
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
            return this.login(challstr, parseInt(key));
        },
        updateuser(args) {
            const cur = this.curName.slice();
            this.curName = utils.splitFirst(args[0], '@!')[0];
            if (utils.toID(cur) !== utils.toID(this.curName)) {
                console.log(`name updated to ${this.curName}`);
            }
        },
        async 'c:'(args, line) {
            const [, identity, message] = args;
            const res = await CommandBase.tryCommand(message, identity.slice(1), line.roomid as string);
            if (res === CommandBase.responses.NOT_FOUND) {
                this.send(`/pm ${identity},Command not found.`);
            }
            if (res === CommandBase.responses.NOT_COMMAND) {
                if (identity.charAt(0) === ' ') {
                    for (const filter of this.filters) {
                        const f = new (filter as any)(message, identity.slice(1), line.roomid as string);
                        await f.run();
                    }
                }
            }
        },
        async pm(args) {
            const [sender, receiver, message] = args;
            if (utils.toID(receiver) !== utils.toID(this.settings.name)) return;
            this.debug(`Received PM from ${sender.slice(1)}: ${message}`);
            const res = await CommandBase.tryCommand(message, sender.slice(1));
            if (res === CommandBase.responses.NOT_FOUND) {
                this.send(`/pm ${sender},Command not found.`);
            }
        },
        queryresponse(args, line) {
            const type = args.shift()!;
            const resolve = this.queries.get(type);
            if (resolve) {
                resolve(JSON.parse(args.join('|')));
                this.queries.delete(type);
                if (this.waitingQueries[type]) {
                    const next = this.waitingQueries[type].shift();
                    if (!next) {
                        delete this.waitingQueries[type];
                        return;
                    }
                    const [data, resolve] = next;
                    this.queries.set(type, resolve);
                    this.send(`/crq ${type}${data ? ` ${data}` : ''}`);
                }
            }
        },
    }

    commands: {[k: string]: typeof CommandBase} = {};
    filters: typeof FilterBase[] = [];
    /**
     * Pending /crq requests.
     */
    queries = new Map<string, (data: {[k: string]: any}) => void>();
    constructor(settings: BotSettings | string) {
        this.settings = PSInterface.getConfig(settings);
        this.connection = new PSConnection();
        void this.listen();
        process.nextTick(() => this.loadPlugins());
    }
    waitingQueries: {[k: string]: [string, (data: any) => void][]} = {};
    query(type: string, data = '') {
        return new Promise<any>(resolve => {
            if (this.queries.has(type)) {
                if (!this.waitingQueries[type]) this.waitingQueries[type] = [];
                this.waitingQueries[type].push([data, resolve]);
            } else {
                this.send(`/crq ${type}${data ? ` ${data}` : ''}`);
                this.queries.set(type, resolve);
            }
        });
    }
    send(data: string, roomid?: string) {
        if (!roomid || roomid === 'global') roomid = '';
        this.connection.send(`${roomid}|${data}`);
    }
    debug(message: string) {
        if (!this.settings.loglevel || this.settings.loglevel < 3) return;
        console.log(message);
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
                console.log(`Bot socket closed`);
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
    async handleMessage(raw: string) {
        const line = PSInterface.parseLine(raw);
        try {
            await this.listeners[line.type]?.call(this, line.args, line);
        } catch (e) {
            console.log(`Err in data handler: ${e.message} - ${raw}`);
        }
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
        }, data => data.slice(1));
        if (data.actionerror) {
            throw new Error(data.actionerror);
        }
        if (!data.assertion) {
            console.log(data);
            throw new Error(`Missing assertion (data logged above) `);
        }
        if (data.assertion.startsWith(';;')) {
            throw new Error(data.assertion.slice(2));
        }
        this.send(`/trn ${this.settings.name},0,${data.assertion}`);
    }
    loadPluginsFrom(path: string) {
        const imports = require(path);
        const handlers = imports.commands;
        for (const name in handlers) {
            this.commands[utils.toID(name)] = handlers[name];
        }
        if (imports.filters) {
            this.filters.push(...imports.filters);
        }
    }
    loadPlugins() {
        try {
            const path = `${__dirname}/plugins`;
            const files = fs.readdirSync(path);
            for (const file of files) {
                this.loadPluginsFrom(`${path}/${file}`);
            }
        } catch (e) {}
    }
    CommandBase = CommandBase;
    FilterBase = FilterBase;
    CommandError = CommandError;
    User = PSUser;
    Room = PSRoom;
}
