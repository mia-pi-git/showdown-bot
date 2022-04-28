**A simple, easily customizable bot for connecting to Pokemon Showdown.**

This package is meant to be as simple as possible. 
All you need to do to connect to PS is as follows:
(TS)
```ts
import {PS} from 'psim.us';

const bot = new PS.Client({
    name: 'uwu', pass: 'uwu',
});
```
Then you just call 
```ts
// note these are defaults, so you can just call bot.connect()
// if you want to connect to main
bot.connect('sim.smogon.com', 8000);
```

For receiving messages, all you need to do is set a listener.
```ts
bot.on('message', msg => {
    console.log(`${msg.from}: ${msg.test}`);
    msg.respond('Hello!');
});
```

To access rooms, all you need to do is call `client.rooms.get()`.
`client.users` has the same accessor API.

Settings:
```ts
export interface Settings {
    name: string;
    pass: string;
    rooms?: string[];
    /* Command prefix */
    prefix?: string;
    status?: string;
    avatar?: string;
    /* Number of MS to wait before attempting to reconnect.
    * Defaults to one minute. */
    reconnectMs?: number;
}
```

User methods:

```ts
export declare class User extends PSSendable {
    data: Record<string, any>;
    group: string;
    rooms: Record<string, {
        group: string;
        isPrivate?: boolean;
    }>;
    name: string;
    avatar: string;
    setData(data: any): void;
    send(message: string): void;
    update(): Promise<boolean>;
    toString(): string;
}
```

Room methods:
```ts
export declare class Room extends PSSendable {
    data: Record<string, any>;
    id: string;
    title: string;
    users: Record<string, User>;
    auth: Record<string, string[]>;
    setData(data: any): void;
    update(): Promise<boolean>;
    send(message: string): void;
    toString(): string;
}
```

Client methods:
```ts
export declare class Client extends EventEmitter {
    connection: ws.connection;
    settings: Settings;
    rooms: RoomList;
    users: UserList;
    constructor(settings: Settings);
    static parse(received: string): PLine[];
    connect(server?: string, port?: number): void;
    query(type: string, args: string[]): Promise<any>;
    send(message: string): void;
}
```

Message methods:
```ts
export declare class Message {
    client: Client;
    text: string;
    /** User if it's a pm, Room if it's in a room, null if it's a system message
     * (from &)
     */
    to: User | Room | null;
    room?: Room | null;
    from: User | null;
    isPSCommand: boolean;
    line: PLine;
    constructor(client: Client);
    static getUser(name: string, client: Client): Promise<false | User | null>;
    static from(line: PLine, client: Client): Promise<Message | null | undefined>;
    /** If the message has a room, sends the response to that room
     * - else PMs the user that it's from
     **/
    respond(text: string): void | undefined;
    /** Sends a reply in pms. */
    privateRespond(text: string): void | undefined;
    isPM(): boolean;
    isCommand(): boolean;
    isRank(rank: string): boolean;
    clone(): Message;
}

```

Page API:
```ts
// request for a page. sent when a user does /join view-bot-[name]-[pageid]
// to listen for this, use client.on('requestpage', listener);
export declare class PageRequest {
    client: Client;
    from: User;
    pageid: string;
    room: Room;
    constructor(client: Client);
    static from(client: Client, args: string[], roomId: string): Promise<PageRequest | undefined>;
    respond(page: PageBuilder | string): Page;
}
// made to make it easy to create page html
export declare class PageBuilder {
    private elem;
    constructor();
    toString(): string;
    html(text: string): this;
    querySelector(selector: string): cheerio.Cheerio<cheerio.Node>;
}
// page wrapper class
export declare class Page {
    user: User;
    room: Room;
    content: string;
    pageid: string;
    closed: boolean;
    constructor(req: {
        from: User;
        room: Room;
        pageid: string;
        content: string;
    });
    toString(): string;
    highlight(title: string, text: string): void;
    changeSelector(selector: string, html: string): void;
    close(): void;
    update(): void;
}
```

To listen for a specific message type, just call `client.on(type, listener)`.

The listener will be passed the arguments `args (string[])`, `room (string?)`, `line (PLine)`.