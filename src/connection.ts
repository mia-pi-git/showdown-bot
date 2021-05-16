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
        this.url = `https://${server}.psim.us:${port}/showdown`;
        this.recoverErrors = recoverErrors || false;
        this.socket = this.open();
    }
    send(data: string) {
        this.socket.send(data);
    }
    open() {
        const ws: WebSocket = new (require('sockjs-client'))(this.url);
        ws.onmessage = message => this.push({type: 'message', data: message.data});
        ws.onopen = () => this.push({type: 'open', data: true});
        ws.onclose = () => this.push({type: 'close', data: true});
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
