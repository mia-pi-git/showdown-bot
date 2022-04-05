/**
 * Room handling.
 */

import {PSSendable} from './sendable';
import {Client} from './ps';
import {User} from './user';

export class Room extends PSSendable {
    data: Record<string, any> = {};
    id = '';
    title = '';
    users: Record<string, User> = {};
    auth: Record<string, string[]> = {};
    setData(data: any) {
        Object.assign(this.data, data);
        if (data.roomid) this.id = data.roomid;
        if (data.title) this.title = data.title;
        if (data.auth) this.auth = data.auth;
    }
    async update() {
        try {
            if (!this.id) throw new Error();
            const data = await this.client.query('roominfo', [this.id]);
            this.setData(data);
        } catch {
            return false;
        }
        return true;
    }
    send(message: string) {
        this.client.send(`${this.id}|${message}`);
    }
    toString() { return this.id; }
}

export class RoomList {
    private rooms = new Map<string, Room>();
    constructor(private client: Client) {}
    async get(id: string) {
        let room = this.rooms.get(id);
        if (room) return room;
        try {
            const data = await this.client.query('roominfo', [id]);
            room = new Room(this.client);
            room.setData(data);
            this.rooms.set(room.id, room);
            return room;
        } catch {
            return null;
        }
    }
}