import WebSocket from 'ws';
import {DataStream} from './lib/streams';

interface PSStreamMessage {
    type: 'open' | 'message' | 'close' | 'error';
    data: any;
}

export class PSConnection extends DataStream<PSStreamMessage> {
    socket: WebSocket;
    url: string;
    recoverErrors: boolean;
    constructor(server = 'sim3', port = 443, recoverErrors?: boolean) {
        super();
        this.url = `wss://${server}.psim.us:${port}/showdown`;
        this.recoverErrors = recoverErrors || false;
        this.socket = this.open();
    }
    send(data: string) {
        this.socket.send(data, err => {
            if (err) this.error(err);
        });
    }
    open() {
        const ws = new WebSocket(this.url);
        ws.once('open', () => this.push({type: 'open', data: true}));
        ws.once('close', (code, reason) => this.push({type: 'close', data: {code, reason}}));
        ws.on('message', message => this.push({type: 'message', data: message}));
        ws.on('error', err => this.error(err));
        return ws;
    }
    destroy() {
        this.pushEnd();
        this.socket.terminate();
    }
    error(err: Error) {
        if (this.recoverErrors) {
            this.push({type: 'error', data: err});
        } else {
            this.pushError(err);
        }
    }
}
