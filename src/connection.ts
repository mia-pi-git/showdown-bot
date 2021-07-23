import {Streams} from './lib/utils';
type PSStreamMessage = {
    type: 'open';
    data: boolean;
} | {
    type: 'message';
    data: string;
} | {
    type: 'close';
    data: boolean;
} | {
    type: 'error';
    data: Error;
}

export class PSConnection extends Streams.ObjectReadStream<PSStreamMessage> {
    socket: WebSocket;
    url: string;
    recoverErrors: boolean;
    constructor(
        type: typeof WebSocket,
        server = 'sim3',
        port = 443, 
        recoverErrors?: boolean
    ) {
        super({read() {}});
        this.url = `https://${server}.psim.us:${port}/showdown`;
        this.recoverErrors = recoverErrors || false;
        this.socket = this.open(type);
    }
    send(data: string) {
        this.socket.send(data);
    }
    open(type: typeof WebSocket) {
        const ws: WebSocket = new type(this.url);
        ws.onmessage = message => this.push({type: 'message', data: message.data});
        ws.onopen = () => this.push({type: 'open', data: true});
        ws.onclose = () => this.push({type: 'close', data: true});
        ws.onerror = e => this.error(new Error(e as any));
        return ws;
    }
    destroy() {
        this.pushEnd();
        this.socket.close();
    }
    error(err: Error) {
        if (this.recoverErrors) {
            this.push({type: 'error', data: err});
        } else {
            this.pushError(err);
        }
    }
}
