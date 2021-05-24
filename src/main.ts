import {PSConnection} from './connection';
import * as utils from './lib/utils';
import * as fs from 'fs';
import {CommandBase, CommandError, FilterBase, PageBase} from './commands';
import {PSUser} from './user';
import {PSRoom} from './room';

export interface PLine {
    type: string;
    args: string[];
    roomid?: string;
}

export type PLineHandler = (this: PSInterface, args: string[], line: PLine) => any;

export type BotCommand = (
    this: PSInterface, input: string, user: string, room: string | null, line: PLine
) => any;

export class PSInterface {
    connection: PSConnection;
    curName = '';
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
                if (Config.rooms) {
                    for (const room of Config.rooms) {
                        this.join(room);
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
            if (utils.toID(receiver) !== utils.toID(Config.name)) return;
            this.debug(`[${new Date().toTimeString()}] Received PM from ${sender.slice(1)}: ${message}`);
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

    customListeners: {[k: string]: PLineHandler[]} = {}
    commands: {[k: string]: typeof CommandBase} = {};
    pages: {[k: string]: typeof PageBase} = {};
    filters: typeof FilterBase[] = [];
    /**
     * Pending /crq requests.
     */
    queries = new Map<string, (data: {[k: string]: any}) => void>();
    constructor() {
        this.connection = new PSConnection();
        void this.listen();
        process.nextTick(() => {
            this.loadPlugins();
            require('./web');
        });
        // in case this is required in and wrapped by another project
        if (!global.PS) (global as any).PS = this;
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
        if (!Config.loglevel || Config.loglevel < 3) return;
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
        } catch (e) {
            console.log(
                `Err in${isCustom ? ` custom ` : ' '}` + 
                `${line.type} handler: ${e.message} - ${line.args}`
            );
        }
    }
    async handleMessage(raw: string) {
        const line = PSInterface.parseLine(raw);
        if (this.listeners[line.type]) {
            await this.runListener(this.listeners[line.type], line);
        }
        // re: toID, see PS#watchPline comment
        if (this.customListeners[toID(line.type)]) {
            for (const handler of this.customListeners[toID(line.type)]) {
                await this.runListener(handler, line, true);
            }
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
    async login(challstr: string, challengekeyid: number) {
        const data = await utils.post(`https://play.pokemonshowdown.com/action.php`, {
            name: Config.name,
            pass: Config.pass,
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
        this.send(`/trn ${Config.name},0,${data.assertion}`);
        this.joinRooms();
    }

    inRooms = new Set<PSRoom>();

    join(room: string) {
        this.send(`/join ${toID(room)}`);
        this.inRooms.add(new PSRoom(toID(room)));
    }
    saveRooms() {
        return utils.writeJSON([...this.inRooms].map(i => i.id), 'config/rooms.json');
    }

    joinRooms() {
        try {
            const rooms = require('../config/rooms.json');
            for (const room of rooms) this.join(room);
        } catch {}
    }

    /************************************
     * Plugin stuff
     ************************************/
    loadPluginsFrom(path: string) {
        const imports = require(path);
        for (const k in imports) {
            const cur = imports[k];
            if (cur.prototype instanceof PS.FilterBase) {
                this.filters.push(cur);
            }
            if (cur.prototype instanceof PS.CommandBase) {
                this.commands[toID(cur.name)] = cur;
            }
            if (cur.prototype instanceof PS.PageBase) {
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
        } catch (e) {
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
    /************************************
     * REPL tools
    ************************************/
    eval = (cmd: string) => eval(cmd);
    repl = (() => {
        if (Config.repl) {
            const stream = new utils.Stream<string>({nodeStream: process.stdin});
            void (async () => {
                for await (const line of stream) {
                    const res = await utils.cleanEval(line, code => this.eval(code));
                    console.log(`< ${res}`);
                }
            })();
            return stream;
        }
        return new utils.Stream<string>();
    })();
}
