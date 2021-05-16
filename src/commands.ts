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
        this.user = PSUser.get(user);
        this.room = (roomid ? PSRoom.get(roomid) : false) || null;
        this.target = target;
    }
    abstract run(): void | boolean | Promise<void | boolean>;
    abstract init(): any;
    is(group: string, room?: PSRoom) {
        const uGroup = room ? room.auth.get(this.user.id) || this.user.group : this.user.group;
        const groups = [" ", "whitelist", "+", "☆", "%", "@", "★", "*", "#", "&"];
        return groups.indexOf(uGroup) >= groups.indexOf(group);
    }
    send(message: string) {
        if (this.room?.auth.get(this.user.id)) {
            this.room.send(message);
        } else {
            this.user.send(message);
        }
    }
    isSysop() {
        if (!PS.settings.sysops?.includes(this.user.id)) {
            throw new PS.CommandError(`Access denied.`);
        }
    }

    static responses = CommandResponses;
    static tryCommand(message: string, user: string, room?: string) {
        if (!message.startsWith(PS.settings.commandToken)) return CommandResponses.NOT_COMMAND;
        const [rawCmd, rest] = splitFirst(message.slice(1), ' ');
        const cmd = toID(rawCmd);
        const handler = PS.commands[cmd];
        if (!handler) return CommandResponses.NOT_FOUND;
        const obj: CommandBase = new (handler as any)(rest, room || null, user);
        return Promise.resolve(obj.init())
            .then(() => obj.run())
            .catch(e => {
                if (e.name.endsWith('CommandError')) {
                    return obj.send(e.message);
                } else throw e;
            });
    }
}

export abstract class FilterBase {
    message: string;
    user: PSUser;
    room: PSRoom | null;
    constructor(message: string, userid: string, room: string | null) {
        this.message = message;
        this.user = PSUser.get(userid);
        this.room = PSRoom.get(room || "") || null;
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
        return this.room && this.room.auth.get(toID(PS.settings.name)) === '*'
    }
    mute(reason?: string) {
        if (this.hasAuth()) {
            this.send(`/mute ${this.user.id},${reason || ""}`);
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