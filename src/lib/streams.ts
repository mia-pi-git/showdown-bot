/**
 * Stream code partially borrowed from Pokemon Showdown.
 * Added some things I do need, and removed some that I do not.
 */


 export class DataStream<T> {
	buf: T[];
	readSize: number;
	atEOF: boolean;
	errorBuf: Error[] | null;
	nextPushResolver: (() => void) | null;
	nextPush: Promise<void>;
	awaitingPush: boolean;
	onEnd?: (() => any)[];

	constructor(options: {[k: string]: any} = {}) {
		this.buf = [];
		this.readSize = 0;
		this.atEOF = false;
		this.errorBuf = null;
		this.nextPushResolver = null;
		this.nextPush = new Promise(resolve => {
			this.nextPushResolver = resolve;
		});
		this.awaitingPush = false;

		if (options.nodeStream) {
			const nodeStream = options.nodeStream;
			options = {
				read() {
					nodeStream.resume();
				},
				pause() {
					nodeStream.pause();
				},
			}
			nodeStream.on('data', (data: any) => {
				this.push(data);
			});
			nodeStream.on('end', () => {
				this.pushEnd();
			});
			nodeStream.on('error', (err: Error) => {
				if (err) this.pushError(err);
			});
		}

		if (options.read) this._read = options.read;
		if (options.pause) this._pause = options.pause;
		if (options.destroy) this._destroy = options.destroy;
	}

	push(elem: T) {
		if (this.atEOF) return;
		this.buf.push(elem);
		if (this.buf.length > this.readSize && this.buf.length >= 16) this._pause();
		this.resolvePush();
	}

	awaitEnd(callback?: () => any) {
		return new Promise<void>(resolve => {
			if (!this.onEnd) this.onEnd = [];
			this.onEnd.push(() => {
				resolve();
				callback?.();
			});
		});
	}

	pushEnd() {
		this.atEOF = true;
		this.resolvePush();
		if (this.onEnd) {
			for (const cb of this.onEnd) cb();
		}
	}

	pushError(err: Error, recoverable?: boolean) {
		if (!this.errorBuf) this.errorBuf = [];
		this.errorBuf.push(err);
		if (!recoverable) this.atEOF = true;
		this.resolvePush();
	}

	readError() {
		if (this.errorBuf) {
			const err = this.errorBuf.shift()!;
			if (!this.errorBuf.length) this.errorBuf = null;
			throw err;
		}
	}

	peekError() {
		if (this.errorBuf) {
			throw this.errorBuf[0];
		}
	}

	resolvePush() {
		if (!this.nextPushResolver) throw new Error(`Push after end of read stream`);
		this.nextPushResolver();
		if (this.atEOF) {
			this.nextPushResolver = null;
			return;
		}
		this.nextPush = new Promise(resolve => {
			this.nextPushResolver = resolve;
		});
	}

	_read(): void | Promise<void> {}

	_destroy() {}
	_pause() {}

	async loadIntoBuffer(count: number | true = 1, readError?: boolean) {
		this[readError ? 'readError' : 'peekError']();
		if (count === true) count = this.buf.length + 1;
		if (this.buf.length >= count) return;
		this.readSize = Math.max(count, this.readSize);
		while (!this.errorBuf && !this.atEOF && this.buf.length < this.readSize) {
			const readResult = this._read();
			if (readResult) {
				await readResult;
			} else {
				await this.nextPush;
			}
			this[readError ? 'readError' : 'peekError']();
		}
	}

	async peek() {
		if (this.buf.length) return this.buf[0];
		await this.loadIntoBuffer();
		return this.buf[0];
	}

	async read() {
		if (this.buf.length) return this.buf.shift();
		await this.loadIntoBuffer(1, true);
		if (!this.buf.length) return null;
		return this.buf.shift()!;
	}

	async peekArray(count: number | null = null) {
		await this.loadIntoBuffer(count === null ? 1 : count);
		return this.buf.slice(0, count === null ? Infinity : count);
	}

	async readArray(count: number | null = null) {
		await this.loadIntoBuffer(count === null ? 1 : count, true);
		const out = this.buf.slice(0, count === null ? Infinity : count);
		this.buf = this.buf.slice(out.length);
		return out;
	}

	async readAll() {
		await this.loadIntoBuffer(Infinity, true);
		const out = this.buf;
		this.buf = [];
		return out;
	}

	async peekAll() {
		await this.loadIntoBuffer(Infinity);
		return this.buf.slice();
	}

	destroy() {
		this.atEOF = true;
		this.buf = [];
		this.resolvePush();
		return this._destroy();
	}

	[Symbol.asyncIterator]() { return this; }

	async next() {
		if (this.buf.length) return {value: this.buf.shift() as T, done: false as const};
		await this.loadIntoBuffer(1, true);
		if (!this.buf.length) return {value: undefined, done: true as const};
		return {value: this.buf.shift() as T, done: false as const};
	}
}
