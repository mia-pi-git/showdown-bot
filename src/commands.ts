/**
 * TODO: Each command file exports a `Handler` class (properties: static name, static? help)
 * Commands are set into the object by [handler.name (static)] = handler class;
 * when handler.name is called, instance is created with `new handler()`.
 * Arguments: 
 * - class for a PS room (with users, methods to send to that room, etc), 
 * - class for a user (method to check permissions, method to send a PM to)
 * - string input, 
 */
import {PSUser} from './user';
import {PSRoom} from './room';
import {splitFirst, toID} from './lib/utils';
import type * as express from 'express';

export enum CommandResponses {
    NOT_FOUND,
    NOT_COMMAND,
}

export class CommandError extends Error {
    constructor(message: string) {
        super(message);
        Error.captureStackTrace(this, CommandError);
    }
}

export abstract class CommandBase {
    room: PSRoom | null;
    user: PSUser;
    target: string;
    constructor(target: string, roomid: string | null, user: string) {
        this.user = PS.users.get(user);
        this.room = (roomid ? PS.rooms.get(roomid) : false) || null;
        this.target = target;
    }
    abstract run(): void | boolean | Promise<void | boolean>;
    init(): void | Promise<void> {};
    atLeast(group: string, room: PSRoom | null) {
        const uGroup = (room ? room.auth.get(this.user.id) : this.user.group) || this.user.group;
        const groups = [" ", "whitelist", "+", "☆", "%", "@", "★", "*", "#", "&"];
        const groupIdx = groups.indexOf(group);
        return groupIdx > 0 && groups.indexOf(uGroup) >= groupIdx;
    }
    is(group: string, room: PSRoom | null = null) {
        if (!room && this.room) room = this.room;
        if (!this.atLeast(group, room)) {
            throw new CommandError(`Access denied.`);
        }
    }
    send(message: string) {
        if (this.room?.auth.get(this.user.id)) {
            this.room.send(message);
        } else {
            this.user.send(message);
        }
    }
    isSysop() {
        if (!Config.sysops?.includes(this.user.id)) {
            throw new PS.CommandError(`Access denied.`);
        }
    }

    static responses = CommandResponses;
    static tryCommand(message: string, user: string, room?: string) {
        if (!message.startsWith(Config.commandToken)) return CommandResponses.NOT_COMMAND;
        const [rawCmd, rest] = splitFirst(message.slice(1), ' ');
        const cmd = toID(rawCmd);
        let handler = PS.commands[cmd];
        if (!handler) {
            for (const base of Object.values(PS.commands)) {
                if (base.aliases.includes(cmd)) {
                    handler = base;
                    break;
                }
            }
        }
        if (!handler) return CommandResponses.NOT_FOUND;
        const obj: CommandBase = new (handler as any)(rest, room || null, user);
        return Promise.resolve(obj.init())
            .then(() => obj.run())
            .catch(e => {
                if (e instanceof CommandError) obj.send(e.message);
                else throw e;
            });
    }
    static help: string[] | null = null;
    static aliases: string[] = [];
}

export abstract class FilterBase {
    message: string;
    user: PSUser;
    room: PSRoom | null;
    constructor(message: string, userid: string, room: string | null) {
        this.message = message;
        this.user = PS.users.get(userid);
        this.room = PS.rooms.get(room || "") || null;
    }
    abstract run(): void | boolean | Promise<void | boolean>;
    send(message: string) {
        if (this.room && this.room.auth.get(this.user.id)) {
            this.room.send(message);
        } else {
            this.user.send(message);
        }
    }
    hasAuth() {
        return this.room && this.room.auth.get(toID(Config.name)) === '*'
    }
    mute(reason?: string, hour = false) {
        if (this.hasAuth()) {
            this.send(`/${hour ? 'hour' : ''}mute ${this.user.id},${reason || ""}`);
        }
    }
    warn(reason?: string) {
        if (this.hasAuth()) {
            this.send(`/warn ${this.user.id},${reason || ""}`);
        }
    }
    ban(reason?: string) {
        if (this.hasAuth()) {
            this.send(`/ban ${this.user.id},${reason || ""}`);
        }
    }
    note(target: string) {
        if (this.hasAuth()) {
            this.send(`/mn ${target}`);
        }
    }
}

export abstract class PageBase {
    /** Set this to serve a specific path if you don't want it to be the same as the page name */
    static path = '';
    readonly req: express.Request;
    readonly res: express.Response;
    readonly body: any;
    constructor(req: express.Request, res: express.Response) {
        this.req = req;
        this.res = res;
        this.body = req.body;
    }
    /**
     * Web JS can be used in pages, as they are presently compiled on the server then served
     * to the user on the page.
     */
    abstract serve(): string | Promise<string | void> | void;
    send(content: string) {
        this.req.push(content);
    }
}