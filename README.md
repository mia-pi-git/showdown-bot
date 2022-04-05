**A simple, easily customizable bot for connecting to Pokemon Showdown.**

This package has one requirement for connecting to PS.
- A WebSocket instance (we recommend sockjs-client or WebSocket.)
(We used to require a HTTP fetcher, and in fact still support it, but we have a native version in src/utils, so it is not required.)
For customizing fetch, just pass the fetcher instead of null in the second argument.

From there, all you need to do is as follows:
(TS)
```ts
import PS from 'psim.us';

const bot = new PS.Client({
    name: 'uwu', pass: 'uwu',
});
```
Then you just call 
```ts
bot.connect('sim3'); // assumes .psim.us if there's no .
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
    prefix?: string;
    status?: string;
    avatar?: string;
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
To listen for a specific message type, just call `client.on(type, listener)`.

The listener will be passed the arguments `args (string[])`, `room (string?)`, `line (PLine)`.