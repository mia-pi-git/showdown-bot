import {Net} from './lib/net';
import * as ws from 'websocket';
import {splitFirst, toID, defer} from './lib';
import EventEmitter from 'events';
import {UserList} from './user';
import {RoomList} from './room';
import {Message} from './message';
import {PageBuilder, PageRequest} from './page';

export interface Settings {
    name: string;
    pass: string;
    rooms?: string[];
    prefix?: string;
    status?: string;
    avatar?: string;
    /* Number of MS to wait before attempting to reconnect. Defaults to one minute. */
    reconnectMs?: number;
}

export interface PLine {
    type: string;
    args: string[];
    roomid?: string;
}

export class Client extends EventEmitter {
    connection!: ws.connection;
    settings: Settings;
    rooms = new RoomList(this);
    users = new UserList(this);
    private messageQueue = new Promise<void>(resolve => resolve());
    constructor(settings: Settings) {
        super();
        this.settings = settings;
        this.listen();
    }
    private listen() {
        this.on('queryresponse', (args) => {
            const [type, ...data] = args;
            const requestData = this.queryResolvers[type]?.shift();
            if (requestData) {
                requestData[1].resolve(JSON.parse(data.join('|')));
            }
        });
        this.on('ready', () => {
            if (this.settings.rooms) {
                for (const room of this.settings.rooms) {
                    this.send(`|/join ${room}`);
                }
            }
            if (this.settings.avatar) this.send(`|/avatar ${this.settings.avatar}`);
            if (this.settings.status) this.send(`|/status ${this.settings.status}`);
        });
        this.on('pm', async (args, room, line) => {
            /* room ? room.roomid : 'lobby',
			`|pm|${user.getIdentity()}|${bot.getIdentity()}||requestpage|${user.name}|${pageid}`
            */
            const [, , , type] = args;
            if (type !== 'requestpage') return;
            const req = await PageRequest.from(this, args, room);
            if (!req) return;
            this.emit('requestpage', req);
        });
    }
    static parse(received: string): PLine[] {
        const out: PLine[] = [];
        let [possibleRoomid, rest] = splitFirst(received, '\n');
        let roomid;
        if (possibleRoomid?.startsWith('>')) {
            roomid = toID(possibleRoomid, true);
        } else {
            rest = received;
        }
        const chunks = rest.split('\n');
        for (const chunk of chunks) {
            const [, type, ...args] = chunk.split('|');
            out.push({
              type,
              args,
              roomid,
            });
        }
        return out;
      }
    connect(server = 'sim.smogon.com', port = 8000) {
        if (!server.includes('.')) server = `${server}.psim.us`;
        if (this.connection?.connected) this.connection.close();
        const client = new ws.client();
        client.on('connect', this.onConnect.bind(this));
        client.on('connectFailed', this.onFailure.bind(this));
        client.connect(`ws://${server}:${port}/showdown/websocket`, []);
    }
    private onFailure(err: Error) {
        this.emit('error', err);

        console.log('reconnecting...');
        setTimeout(this.connect.bind(this), this.settings.reconnectMs || 60 * 1000);
    }

    private queryResolvers: Record<string, [
        number, import('./lib').Deferred<any>
    ][]> = {};
    async query(type: string, args: string[]) {
        const promise = defer<any>();
        const id = Math.random() * Math.random() * 10000;
        if (!this.queryResolvers[type]) this.queryResolvers[type] = [];
        this.queryResolvers[type].push([id, promise]);
        this.send(`|/cmd ${type} ${args.join(' ')}`);

        const timeout = setTimeout(() => {
            promise.reject(new Error("Request timeout"));
            this.queryResolvers[type].splice(
                this.queryResolvers[type].findIndex(k => k[0] === id), 1
            );
        }, 5000);

        promise.finally(() => clearTimeout(timeout));
        promise.then(data => {
            this.emit('queryresult', data);
        });
        return promise;
    }

    send(message: string) {
        if (!this.connection.connected) return;
        // thanks to pre for the inspiration here 
        this.messageQueue = this.messageQueue.then(() => {
            this.connection!.send(message);
            return new Promise(resolve => {
                setTimeout(resolve, 100);
            });
        });
    }
    private async handleChallstr(parts: string[]) {
        const [id, ...str] = parts;
        try {
            const res = await Net(`https://play.pokemonshowdown.com/action.php`).post({
                body: {
                    name: this.settings.name,
                    pass: this.settings.pass || "",
                    act: 'login',
                    challstr: str.join('|'),
                    challengekeyid: `${id}`,
                },
            });
            const result = JSON.parse(res.replace(/^]/, ''));
            this.emit('login', result);
            this.send(`|/trn ${this.settings.name},0,${result.assertion}`);
            this.once('updateuser', () => {
                this.emit('ready');
            });
        } catch (e) {
            this.emit('loginfailed', e);
            this.emit('error', e);
            throw new Error("Error in logging in: " + e);
        }
    }
    private async onMessage(message: ws.Message) {
        if (message.type !== 'utf8' || !message.utf8Data) return;
        this.emit('raw', message.utf8Data);
        const messages = Client.parse(message.utf8Data);
        for (const m of messages) {
            if (m.type === 'challstr') {
                void this.handleChallstr(m.args);
            }
            const messageObj = await Message.from(m, this);
            if (messageObj) {
                return this.emit('message', messageObj.clone());
            }
            this.emit(m.type, [...m.args], m.roomid, {...m});
            
        }
    }
    private onConnect(connection: ws.connection) {
        this.connection = connection;

        connection.on('error', this.onFailure.bind(this));
        // @ts-ignore yes it exists :(
        connection.on('close', this.onFailure.bind(this));
        connection.on('message', this.onMessage.bind(this));

        console.info('Connected!');
    }
}