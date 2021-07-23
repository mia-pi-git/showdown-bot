/**
 * Plugin for the Pokemon Go room.
 */
// ts-ignore
import {Dex} from 'pokemon-showdown';
import {SQLDatabase} from '../lib/database';

export interface Raid {
    by: string;
    mon: string;
    egg: boolean;
    time: number;
    code: string;
}

export const raids: {[k: string]: Raid} = (() => {
    let raidObj = PS.plugins.raids;
    if (!raidObj) {
        raidObj = PS.plugins.raids = {};
    }
    return raidObj;
})();

export const codeDB = new SQLDatabase({
    file: 'databases/pokemongo.db',
    tableName: '',
    keys: [],
});

export const Manager = new class {
    displayTimer!: NodeJS.Timeout;
    getRoom() {
        const room = PS.rooms.get('pokemongo');
        if (!room || room.auth.get(toID(Config.name)) !== '*') return null;
        return room;
    }
    requireRoom() {
        const room = this.getRoom();
        if (!room) throw new PS.CommandError(`GO! room not found.`);
        return room;
    }
    display(setTimer = false) {
        const room = this.getRoom();
        if (!room) return;
        let buf = '<div class="broadcast blue">';
        const raidKeys = Object.values(raids);
        if (!raidKeys.length) return;
        buf += raidKeys.map(raid => {
            return [
                `<div class="infobox"><b>${raid.by}</b> (${raid.code})`,
                `Hosting <b>${raid.mon}</b> ` + 
                `${raid.egg ? `<psicon pokemon="egg" />` : `<psicon pokemon="${raid.mon}" />`}`,
                `Until <b>${new Date(Date.now() + raid.time)}</b>`,
                `</div>`,
            ].join('<br />');
        }).join('<br />');
        buf += `<small><code>${Config.commandToken}endraid [username]</code> to end raids</small>`;
        buf += `</div>`;
        room.addHTML(buf, 'raids');
        if (setTimer) this.setTimer();
    }
    setTimer() {
        this.displayTimer = setTimeout(() => this.display(true), this.getTimerDuration());
    }
    getTimerDuration() {
        return this.getRoom()?.settings.raidShowTime || 10 * 60 * 1000;
    }
    pendingRaids = new Map<string, Raid>();
    async requestRaid(target: string, user: PSUser) {
        const room = this.getRoom();
        if (!room) throw new PS.CommandError(`GO Room not found.`);
        if (this.pendingRaids.has(user.id)) throw new PS.CommandError(`You already have a raid host request pending.`);
        const [mon, timeString, egg] = target.split(',').map(i => i.trim());
        if (!Dex.species.get(mon).exists) {
            throw new PS.CommandError(`That Pokemon does not exist.`);
        }
        const minutes = parseInt(timeString);
        if (minutes > 60 && minutes < 1) {
            throw new PS.CommandError(`Specify a time in minutes.`);
        }
        const time = minutes * 60 * 1000;

        const {code} = await codeDB.selectOne('code', 'userid = ?', [user.id]) || {};
        if (!code) throw new PS.CommandError(`Register a friend code with ${Config.commandToken}gocode [your name], [your code].`);
        
        const raid: Raid = {
            by: user.name,
            time,
            mon: Dex.species.get(mon).name,
            egg: !!egg,
            code,
        }
        if (!room.auth.get(user.id)) {
            this.pendingRaids.set(user.id, raid);
            room.sendMods([
                `${user.name} has requested to host a raid for ${raid.mon}`,
                `<button name="send" class="button" value="${Config.commandToken}approveraid ${user.name}">Approve</button>`,
                `<button name="send" class="button" value="${Config.commandToken}denyraid ${user.name}">Deny</button>`,
            ].join('<br />'), '%', 'raid-request-' + user.id);
        } else {
            raids[user.id] = raid;
            this.display();
        }
    }
    denyRaidRequest(target: string, user: PSUser) {
        target = toID(target);
        const room = this.requireRoom();
        const deleted = this.pendingRaids.get(target);
        if (!deleted) {
            throw new PS.CommandError(`That user does not have a raid request pending.`);
        }
        this.pendingRaids.delete(target);
        this.display();
        room.modlog(`${user.name} denied the raid request for ${deleted.mon} from ${target}`);
    }
    approveRaidRequest(target: string, user: PSUser) {
        target = toID(target);
        const room = this.requireRoom();
        const raid = this.pendingRaids.get(target);
        if (!raid) throw new PS.CommandError(`That user does not have a pending raid request.`);
        this.pendingRaids.delete(target);
        raids[target] = raid;
        this.display();
        room.modlog(`${user.name} approved the raid request from ${target} for ${raid.by}`);
    }
    endRaid(target: string, user: PSUser) {
        target = toID(target);
        const room = this.requireRoom();
        const raid = raids[target];
        if (!raid) throw new PS.CommandError(`That user does not have an ongoing raid.`);
        if (user.id !== toID(raid.by)) {
            if (!room.auth.get(user.id)) {
                throw new PS.CommandError(`You cannot end someone else's raid.`);
            }
            room.modlog(`${user.name} forcibly ended ${raid.by}'s hosted raid for ${raid.mon}.`);
        }
        delete raids[target];
        this.display();
    }
}

export class HostRaid extends PS.CommandBase {
    run() {
        Manager.requestRaid(this.target, this.user);
    }
}

export class EndRaid extends PS.CommandBase {
    run() {
        Manager.endRaid(this.target, this.user);
    }
}

export class DenyRaid extends PS.CommandBase {
    run() {
        const room = Manager.requireRoom();
        this.isStaff(room);
        Manager.denyRaidRequest(this.target, this.user);
    }
}

export class ApproveRaid extends PS.CommandBase {
    run() {
        const room = Manager.requireRoom();
        this.isStaff(room);
        Manager.approveRaidRequest(this.target, this.user);
    }
}

export class RegisterCode extends PS.CommandBase {
    async run() {
        const room = Manager.requireRoom();
        this.isStaff(room);
        let [target, code] = utils
            .splitFirst(this.target, ',')
            .map(i => i.trim());
        target = toID(target);
        if (!/[0-9]{4}-[0-9]{4}-[0-9]{4}/.test(code)) {
            return this.send("Invalid code.");
        }
        await codeDB.insert([target, code], true);
        room.modlog(`${this.user.name} set ${target}'s friend code to ${code}`);
        if (!this.room || this.room.id !== room.id) this.send(`Code updated.`);
    }
}

