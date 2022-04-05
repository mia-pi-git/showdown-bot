import {PSConnection} from './connection';
import * as utils from './lib/utils';
import {toID} from './lib/utils';
import * as fs from 'fs';
import {CommandBase, CommandError, FilterBase, PageBase} from './commands';
import {PSUser} from './user';
import {PSRoom} from './room';
import fetch from 'node-fetch'; // ugh

export interface PLine {
    type: string;
    args: string[];
    roomid?: string;
}

export type PLineHandler = ((
    this: PSInterface, args: string[], line: PLine
) => any) & {isOnce?: boolean};

export type BotCommand = (
    this: PSInterface, input: string, user: string, room: string | null, line: PLine
) => any;

export type Fetcher = (url: string, opts?: {[k: string]: any}) => Promise<{
    json: () => Promise<any>,
    text: () => Promise<string>,
}>;

export interface Configuration {
    name: string;
    pass: string | null;
    rooms?: string[];
    status?: string;
    commandToken: string;
    loglevel?: number;
    sysops?: string[];
    avatar?: string | number;
    repl?: boolean;
    reload?: () => Configuration;
    [k: string]: any;
}

export class PSInterface {
    connection: PSConnection;
    curName = '';
    fetch: typeof fetch;
    config: Configuration;
    // these are core to functionality. do not modify them.
    // Register additional handlers with PS#watchPline
    readonly listeners: {[type: string]: PLineHandler} = {
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
            if (!toID(this.curName).startsWith('guest')) {
                if (!this.named) {
                    this.named = true;
                    if (this.config.rooms?.length) {
                        this.send(`/autojoin ${this.config.rooms.join(', ')}`);
                    }
                    if (this.config.status) {
                        this.send(`/status ${this.config.status}`);
                    }
                    if (this.config.avatar) {
                        this.send(`/avatar ${this.config.avatar}`);
                    }
                }
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
            const [sender, receiver, ...parts] = args;
            const message = parts.join('|');
            if (utils.toID(receiver) !== utils.toID(this.config.name)) return;
            this.debug(`[${new Date().toTimeString()}] Received PM from ${sender.slice(1)}: ${message}`);
            const res = await CommandBase.tryCommand(message, sender.slice(1));
            if (res === CommandBase.responses.NOT_FOUND) {
                this.send(`/pm ${sender},Command not found.`);
            }
        },
        title(args) {
            for (const [i, join] of this.roomJoins.entries()) {
                if (toID(join[0]) === toID(args[0])) {
                    join[1]();
                    this.roomJoins.splice(i, 1);
                }
            }
        },
        noinit(args, line) {
            const room = /"([^"]+)"/.exec(args[1])?.[1];
            if (!room) return;
            for (const [i, join] of this.roomJoins.entries()) {
                if (toID(join[0]) === toID(room)) {
                    this.roomJoins.splice(i, 1);
                    join[2](new Error(args[1]));
                    break;
                }
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
    };

    customListeners: {[k: string]: PLineHandler[]} = {}
    commands: {[k: string]: typeof CommandBase} = {};
    named = false;
    pages: {[k: string]: typeof PageBase} = {};
    filters: typeof FilterBase[] = [];
    /**
     * Pending /crq requests.
     */
    queries = new Map<string, (data: {[k: string]: any}) => void>();
    /** Config can be an absolute path pointing to a file with config settings. */
    constructor(
        config: Configuration | string,
        fetcher: Fetcher | null,
        websocketType: typeof WebSocket
    ) {
        if (typeof config === 'string') {
            config = require(config) as Configuration;
        }
        this.config = config;
        this.fetch = fetch;
        this.connection = new PSConnection(websocketType);
        void this.listen();
        process.nextTick(() => {
            this.loadPlugins();
        });
        // in case this is required in and wrapped by another project
        if (!(global as any).PS) (global as any).PS = this;
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
        if (!this.config.loglevel || this.config.loglevel < 3) return;
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
    private async runListener(handler: PLineHandler, line: PLine, isCustom = false) {
        try {
            await handler.call(this, line.args, line);
        } catch (e: any) {
            console.log(
                `Err in${isCustom ? ` custom ` : ' '}` + 
                `${line.type} handler: ${e.message} - ${line.args}`
            );
            console.log(e.stack);
        }
    }
    async handleMessage(raw: string) {
        const lines = PSInterface.parseChunk(raw);
        for (const line of lines) {
            await this.handleLine(line);
        }
    }
    async handleLine(line: PLine) {
        if (this.listeners[line.type]) {
            await this.runListener(this.listeners[line.type], line);
        }
        // re: toID, see PS#watchPline comment
        const type = toID(line.type);
        if (this.customListeners[type]?.length) {
            for (const [i, handler] of this.customListeners[type].entries()) {
                await this.runListener(handler, line, true);
                if (handler.isOnce) {
                    this.customListeners[type].splice(i, 1);
                }
            }
        }
    }
    static parseChunk(received: string): PLine[] {
        const out: PLine[] = [];
        let [possibleRoomid, rest] = utils.splitFirst(received, '\n');
        let roomid;
        if (possibleRoomid?.startsWith('>')) {
            roomid = utils.toID(possibleRoomid);
        } else {
            rest = received;
        }
        const chunks = rest.split('\n');
        for (const chunk of chunks) {
            const [, type, ...args] = chunk.split('|');
            out.push({
                type,
                args,
                roomid,
            });
        }
        return out;
    }
    async login(challstr: string, challengekeyid: number) {
        const res = await utils.Net(`https://play.pokemonshowdown.com/action.php`).post({
            body: {
                name: this.config.name,
                pass: this.config.pass || "",
                act: 'login',
                challstr,
                challengekeyid: `${challengekeyid}`,
            },
        });
        const data = JSON.parse(res.slice(1));
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
        this.send(`/trn ${this.config.name},0,${data.assertion}`);
    }

    inRooms = new Set<PSRoom>();
    roomJoins: [string, (data: void) => void, (err?: any) => void][] = [];

    join(room: string) {
        this.send(`/join ${room}`);
        this.inRooms.add(new PSRoom(toID(room)));
        return new Promise<void>((resolve, reject) => {
            this.roomJoins.push([room, resolve, reject]);
        });
    }
    /************************************
     * Plugin stuff
     ************************************/
    loadPluginsFrom(path: string) {
        if (path.endsWith('.d.ts')) return;
        const imports = require(path);
        for (const k in imports) {
            const cur = imports[k];
            if (cur.prototype instanceof this.FilterBase) {
                this.filters.push(cur);
            }
            if (cur.prototype instanceof this.CommandBase) {
                this.commands[toID(cur.name)] = cur;
            }
            if (cur.prototype instanceof this.PageBase) {
                this.pages[toID(cur.name)] = cur;
            }
        }
    }
    loadPlugins() {
        try {
            const path = `${__dirname}/plugins`;
            const files = fs.readdirSync(path);
            for (const file of files) {
                this.loadPluginsFrom(`${path}/${file}`);
            }
        } catch (e: any) {
            console.log(e);
        }
    }
    CommandBase = CommandBase;
    FilterBase = FilterBase;
    PageBase = PageBase;
    CommandError = CommandError;
    User = PSUser;
    Room = PSRoom;
    users = new utils.TableCache<PSUser, PSUser>(name => new PSUser(name));
    rooms = new utils.TableCache<PSRoom>();
    /** Used by misc plugins to persist over ""hotpatches"" */
    plugins: {[k: string]: any} = {};

    watchPline(type: string, handler: PLineHandler) {
        // to address things like |N|, |J|, and |B| that can be lowercase
        // we toID this so that we can standardize handling / not have to duplicate code
        type = toID(type);
        if (!this.customListeners[type]) this.customListeners[type] = [];
        this.customListeners[type].push(handler);
    }
    on(type: string, handler: PLineHandler) {
        this.watchPline(type, handler);
    }
    once(type: string, handler: PLineHandler) {
        handler.isOnce = true;
        this.watchPline(type, handler);
    }
    eval = (cmd: string) => eval(cmd);
}
