/**
 * Message handling.
 */
import { toID } from './lib';
import {Client, PLine} from './ps';
import {Room} from './room';
import {User} from './user';

export class Message {
    text!: string;
    /** User if it's a pm, Room if it's in a room, null if it's a system message 
     * (from &)
     */
    to!: User | Room | null;
    from: User | null = null;
    isCommand = false;
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
            if (!line.roomid) break;
            const [, senderName, ...rest] = line.args;
            const sender = await client.users.get(senderName);
            if (sender?.toString() === toID(client.settings.name)) return null;
            message.from = sender;
            message.to = await client.rooms.get(line.roomid);
            message.text = rest.join('|');
            break;
        } case 'c': {
            if (!line.roomid) break;
            const [senderName, ...rest] = line.args;
            const sender = await client.users.get(senderName);
            if (sender?.toString() === toID(client.settings.name)) return null;
            message.from = sender;
            message.to = await client.rooms.get(line.roomid);
            message.text = rest.join('|');
            break;
        } default: return null;
        }
        message.isCommand = message.text.startsWith('!');
        return message;
    }
    respond(text: string) {
        return this.from?.send(text);
    }
}