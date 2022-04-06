/**
 * Page handling
 */
import {User, Client, Room} from './';
import * as cheerio from 'cheerio';

export class PageRequest {
    from!: User;
    pageid!: string;
    room!: Room;
    constructor(public client: Client) {}
    static async from(client: Client, args: string[], roomId: string) {
        const [, , , type, name, pageid] = args;
        const user = await client.users.get(name);
        const room = await client.rooms.get(roomId);
        if (!user || !room) return; // ???
        const req = new PageRequest(client);
        req.from = user;
        req.pageid = pageid;
        req.room = room;
        return req;
    }
    respond(page: PageBuilder | string) {
        page = page.toString();
        this.room.send(`/sendhtmlpage ${this.from.id},${this.pageid},${page}`);
        return new Page({...this, content: page});
    }
}

export class PageBuilder {
    private elem: cheerio.CheerioAPI;
    constructor() {
        this.elem = cheerio.load('<div class="pad"></div>');
    }
    toString() { return this.elem.html() || ""; }
    html(text: string) {
        this.elem.html(text);
        return this;
    }
    querySelector(selector: string) {
        return this.elem(selector);
    }
}

export class Page {
    user: User;
    room: Room;
    content: string;
    pageid: string;
    closed = false;
    constructor(req: {from: User, room: Room, pageid: string, content: string}) {
        this.user = req.from;
        this.room = req.room;
        this.content = req.content;
        this.pageid = req.pageid;
    }
    toString() { return this.content; }
    highlight(title: string, text: string) {
        this.room.send(
            `/highlighthtmlpage ${this.user.id},${this.pageid},${title},${text}`
        );
    }
    changeSelector(selector: string, html: string) {
        this.room.send(
            `/changehtmlpageselector ${this.user.id},` +
            `${this.pageid},${selector},${html}`
        );
        const $ = cheerio.load(this.content);
        $(selector).html(html);
        this.content = $.html() || this.content;
    }
    close() {
        this.closed = true;
        this.room.send(`/closehtmlpage ${this.user.id},${this.pageid}`)
    }
    update() {
        this.room.send(`/sendhtmlpage ${this.user.id},${this.pageid},${this.content}`);
    }
}