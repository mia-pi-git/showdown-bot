/**
 * Message handling.
 */
import { toID } from './lib';
import {Client, PLine} from './ps';
import {Room} from './room';
import {User} from './user';

const RANK_ORDER = ['', '+', '%', '@', '*', '#', '&'];

export class Message {
    text!: string;
    /** User if it's a pm, Room if it's in a room, null if it's a system message 
     * (from &)
     */
    to!: User | Room | null;
    room?: Room | null;
    from: User | null = null;
    isPSCommand = false;
    line!: PLine;
    constructor(public client: Client) {}
    static async getUser(name: string, client: Client) {
        if (name === '&') return null;
        return (await client.users.get(name)) || false;
    }
    static async from(line: PLine, client: Client) {
        const message = new Message(client);
        message.line = line;
        switch (line.type) {
        case 'pm': {
            const [senderName, receiverName, ...rest] = line.args;
            const sender = await this.getUser(senderName, client);
            if (sender?.toString() === toID(client.settings.name)) return null;
            if (sender === false) return; // ??
            const receiver = await this.getUser(receiverName, client) || null;
            message.from = sender;
            message.to = receiver;
            message.text = rest.join('|');
            break;
        } case 'c:': {
            if (!line.roomid) {
                line.roomid = 'lobby'; // REEE
            }
            const [, senderName, ...rest] = line.args;
            const sender = await client.users.get(senderName);
            if (sender?.toString() === toID(client.settings.name)) return null;
            const room = await client.rooms.get(line.roomid);
            message.from = sender;
            message.room = room;
            message.to = room;
            message.text = rest.join('|');
            break;
        } case 'c': {
            if (!line.roomid) {
                line.roomid = 'lobby'; // REEE
            }
            const [senderName, ...rest] = line.args;
            const sender = await client.users.get(senderName);
            if (sender?.toString() === toID(client.settings.name)) return null;
            const room = await client.rooms.get(line.roomid);
            message.from = sender;
            message.to = room;
            message.room = room;
            message.text = rest.join('|');
            break;
        } default: return null;
        }
        message.isPSCommand = message.text.startsWith('!');
        return message;
    }
    /** If the message has a room, sends the response to that room 
     * - else PMs the user that it's from
     **/
    respond(text: string) {
        return (this.room || this.from)?.send(text);
    }
    /** Sends a reply in pms. */
    privateRespond(text: string) {
        return this.from?.send(text);
    }
    isPM() {
        return this.room === undefined;
    }
    isCommand() {
        const prefix = this.client.settings.prefix;
        return !!(prefix && this.text.startsWith(prefix));
    }
    isRank(rank: string) {
        if (!this.from) return false;
        let auth = this.from.group;
        if (this.room) {
            for (const k in this.room.auth) {
                if (this.room.auth[k].includes(this.from.id)) {
                    if (RANK_ORDER.indexOf(k) > RANK_ORDER.indexOf(rank)) {
                        // higher than global rank
                        auth = k;
                    }
                }
            }
        }
        return RANK_ORDER.indexOf(auth) >= RANK_ORDER.indexOf(rank);
    }
    clone() {
        const message = new Message(this.client);
        Object.assign(message, this);
        return message;
    }
}