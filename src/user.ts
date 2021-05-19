/**
 * Wrapper around PS users.
 */
import {toID} from './lib/utils';

const MIN_FETCH_TIME = 10 * 60 * 1000; // every 10m

export class PSUser {
    name: string;
    id: string;
    group: string = ' ';
    avatar: string | number = 0;
    autoconfirmed = false;
    status = '';
    rooms = new Set<string>();
    connected = false;
    lastFetch: number | null = null;
    constructor(name: string) {
        this.name = name;
        this.id = toID(name);
    }
    async fetchData() {
        const info = await PS.query('userdetails', this.id);
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
        this.lastFetch = Date.now();
    }
    send(message: string) {
        if (this.needsFetch()) void this.fetchData();
        PS.send(`/pm ${this.id},${message}`);
    }
    needsFetch() {
        if (this.lastFetch === null) return true;
        return Date.now() - this.lastFetch > MIN_FETCH_TIME;
    }
}