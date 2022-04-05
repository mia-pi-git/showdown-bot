/**
 * Abstract base class.
 */
import type {Client} from './ps';

export abstract class PSSendable {
    abstract update(): Promise<boolean>;
    abstract setData(data: any): void;
    abstract send(message: string): void;
    id = '';
    sendHTML(message: string) {
        this.send(`!htmlbox ${message}`);
    }
    constructor(public client: Client) {}
}