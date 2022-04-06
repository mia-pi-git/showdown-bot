/**
 * User handling.
 */

import {PSSendable, PSList} from './bases';
import {Page, PageBuilder} from './page';
import {toID} from './lib';
import {Room} from '.';

export class User extends PSSendable {
    data: Record<string, any> = {};
    group = '';
    rooms: Record<string, {group: string, isPrivate?: boolean}> = {};
    name = '';
    avatar = '';
    setData(data: any) {
        Object.assign(this.data, data);
        if (data.group) this.group = data.group;
        if (data.name) this.name = data.name;
        if (data.id) this.id = data.id;
        if (data.avatar) this.avatar = data.avatar;
        if (data.rooms) {
            for (const roomWithRank in data.rooms) {
                let id, group;
                if (toID(roomWithRank) !== roomWithRank) {
                    group = roomWithRank.charAt(0);
                    id = toID(roomWithRank);
                } else {
                    id = toID(roomWithRank);
                    group = '';
                }
                this.rooms[id] = {
                    isPrivate: data.rooms[roomWithRank].isPrivate,
                    group,
                }
            }
        }
    }
    send(message: string) {
        return this.client.send(`|/pm ${this.id},${message}`);
    }
    async update() {
        try {
            if (!this.id) throw new Error();
            const data = await this.client.query('userdetails', [this.id]);
            if (data.rooms === false) return false;
            this.setData(data);
        } catch {
            return false;
        }
        return true;
    }
    toString() { return this.id; }
    sendPage(room: Room, pageid: string, html: string | PageBuilder) {
        const page = new Page({
            from: this,
            room,
            pageid, 
            content: html.toString(),
        });
        page.update();
        return page;
    }
}

export class UserList extends PSList<User> {
    users = new Map<string, User>();
    async get(id: string) {
        id = toID(id);
        let user = this.users.get(id);
        if (user) return user;
        try {
            const data = await this.client.query('userdetails', [id]);
            if (data.rooms === false) {
                throw new Error("User offline");
            }
            user = new User(this.client);
            user.setData(data);
            this.users.set(id, user);
            return user;
        } catch {
            return null;         
        }
    } 
    values() { return this.users.values() }
    entries() { return this.users.entries() }
    keys() { return this.users.keys() }
}