/**
 * Wrapper around PS users.
 */
import {toID} from './lib/utils';

export class PSUser {
    static users = new Map<string, PSUser>();
    static get(name: string) {
        const id = toID(name);
        let user = this.users.get(id);
        if (!user) {
            user = new PSUser(name);
            this.users.set(id, user);
        }
        return user;
    }

    name: string;
    id: string;
    group: string = ' ';
    avatar: string | number = 0;
    autoconfirmed = false;
    status = '';
    rooms = new Set<string>();
    connected = false;
    constructor(name: string) {
        this.name = name;
        this.id = toID(name);
        void this.fetchData();
    }
    async fetchData() {
        const info = await PS.query('userinfo', this.id);
        if (!info) {
            return;
        }
        if (!this.connected) this.connected = true;
        for (const prop of ['id', 'name', 'avatar', 'group', 'autoconfirmed', 'status'] as const) {
            if (prop in info && info[prop] !== this[prop]) {
                this[prop] = info[prop] as never;
            }
        }
        this.rooms = new Set(Object.keys(info.rooms || {}));
    }
    send(message: string) {
        PS.send(`/pm ${this.id},${message}`);
    }
}