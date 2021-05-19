/**
 * Container around a PS room - made for easy access / messaging.
 */
import {toID, requireJSON, writeJSON} from './lib/utils';

const roomSettings: {
    [roomid: string]: {
        [k: string]: any,
    }
} = requireJSON(require, '../config/roomsettings.json');

export class PSRoom {
    static settingsList = roomSettings;
    static rooms = new Map<string, PSRoom>();
    static get(id: string) {
        return this.rooms.get(toID(id));
    }
    id: string;
    title: string;
    auth = new Map<string, string>();
    type = 'chat';
    visibility = 'public';
    modchat: string | null = null;
    users = new Map<string, string>();
    settings: {[k: string]: any};
    constructor(title: string) {
        this.title = title;
        this.id = toID(title);
        this.settings = roomSettings[this.id] || {};
        PSRoom.rooms.set(this.id, this);
        void this.fetchData();
    }
    async fetchData() {
        const info = await PS.query('roominfo', this.id);
        if (!info) {
            return;
        }
        this.title = info.title;
        this.id = toID(this.title);
        for (const prop of ['type', 'visibility', 'modchat'] as const) {
            if (prop in info && this[prop] !== info[prop]) {
                this[prop] = info[prop];
            }
        }
        for (const identity of info.users) {
            this.users.set(toID(identity.slice(1)), identity); // todo PSUser
        }
        for (const group in info.auth) {
            for (const id of info.auth[group]) {
                this.auth.set(id, group);
            }
        }
    }
    send(message: string) {
        PS.send(message, this.id);
    }

    saveSettings() {
        writeJSON(roomSettings, 'config/roomsettings.json');
    }

    modlog(message: string) {
        this.send(`/mn ${message}`);
    }

    private usedUHTML: {[k: string]: boolean} = {};
    addHTML(html: string, uhtmlID: string) {
        const used = !!this.usedUHTML[uhtmlID];
        const cmd = used ? `/changeuhtml ${uhtmlID},` : `/adduhtml ${uhtmlID},`;
        if (!used) this.usedUHTML[uhtmlID] = true;
        this.send(`${cmd}${html}`);
    }
}