/**
 * Various moderation functions.
 */
export const messageCounts: {[roomid: string]: {[userid: string]: number}} = {};
export const spamPunishments: {[roomid: string]: {[userid: string]: number}} = {};
export const altsDB = utils.SQL(`databases/alts.db`, ['databases/alts.sql']);

export class SpamFilter extends PS.FilterBase {
    run() {
        if (!this.room || !this.room.settings.spamFilterLimit || this.room.auth.has(this.user.id)) return;
        const count = this.incrementMessageCount();
        if (count > this.room.settings.spamFilterLimit) {
            this.getPunishmentType()();
        }
    }
    incrementMessageCount() {
        if (!this.room) return 0;
        if (!messageCounts[this.room.id]) messageCounts[this.room.id] = {};
        if (!messageCounts[this.room.id][this.user.id]) messageCounts[this.room.id][this.user.id] = 0;
        messageCounts[this.room.id][this.user.id]++;
        return messageCounts[this.room.id][this.user.id];
    }
    getPunishmentType() {
        if (!this.room) return () => {};
        if (!spamPunishments[this.room.id]) spamPunishments[this.room.id] = {};
        if (!spamPunishments[this.room.id][this.user.id]) spamPunishments[this.room.id][this.user.id] = 0;
        const count = spamPunishments[this.room.id][this.user.id] += this.getSpamIncrement();
        switch (count) {
        case 1: return () => this.send(`${this.user.id}, do not spam.`);
        case 2: return () => this.warn(`Automated moderation: Please do not spam.`);
        case 3: return () => this.mute(`Automated moderation: Spam.`);
        case 4: return () => this.mute(`Automated moderation: Spam.`, true);
        case 5: return () => {
            this.ban(`Automated moderation: Continued spam.`);
            delete spamPunishments[this.room!.id][this.user.id];
        }
        default: return () => {};
        }
    }
    getSpamIncrement() {
        return this.room?.settings.notolerance?.includes(this.user.id) ? 2 : 1;
    }
}

export class AutoModeration extends PS.CommandBase {
    run() {
        this.is('@');
        let [setting, roomid] = utils.splitFirst(this.target, ' ').map(u => u.trim());
        if (!roomid && !this.room) {
            throw new PS.CommandError(`Specify a room.`);
        }
        const room = roomid ? PS.rooms.get(roomid) : this.room;
        if (!room) {
            throw new PS.CommandError(`Invalid room.`);
        }
        const num = parseInt(setting);
        if (isNaN(num)) {
            if (toID(setting) === 'off') {
                if (!room.settings.spamFilterLimit) {
                    throw new PS.CommandError(`Spam filter not enabled for that room.`);
                }
                delete room.settings.spamFilterLimit;
                room.saveSettings();
                return this.send(`Disabled spamfilter for ${room.title}`);
            }
            throw new PS.CommandError(`Invalid setting - ${setting}. Must be a number or 'off'.`);
        }
        room.settings.spamFilterLimit = num;
        room.saveSettings();
        this.send(`Set spam filter limit for ${room.title} to ${num}.`);
    }
}

export class NoTolerance extends PS.CommandBase {
    run() {
        this.is('@');
        if (this.room) this.room = null;
        const [roomid, name] = utils.splitFirst(this.target, ' ');
        const room = PS.rooms.get(roomid);
        if (!room) throw new PS.CommandError(`Room not found.`);
        if (!room.settings.notolerance) room.settings.notolerance = [];
        const id = toID(name);
        const idx = room.settings.notolerance.indexOf(id);
        if (idx > 0) {
            throw new PS.CommandError(`User already on the notol list for that room.`);
        }
        room.settings.notolerance.push(id);
        room.saveSettings();
        room.modlog(`${this.user.name} added ${id} to the no-tol list.`);
        this.send(`Added user to no-tol list.`);
    }
}

export class RemoveNoTolerance extends PS.CommandBase {
    run() {
        this.is('@');
        if (this.room) this.room = null;
        const [roomid, name] = utils.splitFirst(this.target, ' ');
        const room = PS.rooms.get(roomid);
        if (!room) throw new PS.CommandError(`Room not found.`);
        if (!room.settings.notolerance) {
            throw new PS.CommandError(`That room has no users on the no-tolerance list.`);
        }
        const id = toID(name);
        const idx = room.settings.notolerance.indexOf(id);
        if (idx < 0) {
            throw new PS.CommandError(`User not on the notol list for that room.`);
        }
        room.settings.notolerance.splice(idx, 1);
        room.saveSettings();
        room.modlog(`${this.user.name} removed ${id} from the no-tolerance list.`);
        this.send(`Removed user from no-tol list.`);
    }
}

export class Alts extends PS.CommandBase {
    run() {
        if (this.room) {
            return this.send(`This command can only be used in PMs.`);
        }
        this.is('%');
        const target = toID(this.target);
        if (!target) {
            return this.send(`Specify a username.`);
        }
        const altsList = altsDB
            .all(`SELECT * FROM alts WHERE cur = ? OR prev = ?`, target, target)
            .map(entry => Object.values(entry).filter(k => k !== target)[0]) as string[];

        if (!altsList.length) {
            return this.send(`No alts found for ${target}.`);
        }
        this.send(`${target}'s alts:`);
        this.send(`!code ${altsList.join(', ')}`);
    }
}

PS.watchPline('N', (args) => {
    const [newID, oldID] = args.map(
        // split('@') to ensure status is removed
        i => toID(i.split('@').shift()!)
    );
    if (
        newID === oldID || !(oldID && newID) || 
        [oldID, newID].some(i => i.startsWith('guest'))
    ) {
        return;
    }
    // console.log([newID, oldID]);
    altsDB.run(`REPLACE INTO alts (cur, prev) VALUES (?, ?)`, newID, oldID);
});
