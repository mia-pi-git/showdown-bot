import * as fs from 'fs';

import * as https from 'https';
import * as http from 'http';
import * as url from 'url';

export {Net} from './net';

export type Deferred<T> = Promise<T> & {
	resolve: (data: T) => void;
	reject: (error: any) => void;
}

export function defer<T = unknown>() {
	const methods: any = {};
	const promise = new Promise<T>((resolve, reject) => {
		methods.resolve = resolve;
		methods.reject = reject;
	});
	return Object.assign(promise, methods) as Deferred<T>;
}

export function safeJSON(str: string) {
	try {
		return JSON.parse(str);
	} catch {
		return str;
	}
}

const roomRegex = /[^a-z0-9-]+/g;
const noRoomRegex = /[^a-z0-9]+/g;
export function toID(text: any, isRoom = false) {
	if (text && text.id) {
		text = text.id;
	} else if (text && text.userid) {
		text = text.userid;
	} else if (text && text.roomid) {
		text = text.roomid;
	}
	if (typeof text !== 'string' && typeof text !== 'number') return '';
	return ('' + text)
		.toLowerCase()
		.replace(isRoom ? roomRegex : noRoomRegex, '') as string;
}

export function makeAsyncEval(evalFunct: (code: string) => any) {
	return (async (code: string) => {
		let res = evalFunct(code);
		if (typeof res?.then === 'function') {
            res = await res;
        }
		return res;
	});
}

export async function cleanEval(code: string, evalFunct: (code: string) => any) {
	let res;
    try {
        res = await makeAsyncEval(evalFunct)(code);
        res = require('util').inspect(res);
    } catch (e: any) {
        res = e.stack;
    }
	return res;
}

export function requireJSON(requireFunction: NodeJS.Require, path: string) {
	try {
		return requireFunction(path);
	} catch {
		return {};
	}
}

export function writeJSON(obj: any, path: string) {
	fs.writeFileSync(`${__dirname}/../../${path}`, JSON.stringify(obj));
}

export function instanceOf(cur: any, tar: Function & {prototype: any}) {
	if (cur.prototype) {
		return cur.prototype instanceof tar;
	}
	return cur instanceof tar;
}

export function splitFirst(str: string, delimiter: string, limit = 1) {
	const splitStr: string[] = [];
	while (splitStr.length < limit) {
		const delimiterIndex = str.indexOf(delimiter);
		if (delimiterIndex >= 0) {
			splitStr.push(str.slice(0, delimiterIndex));
			str = str.slice(delimiterIndex + delimiter.length);
		} else {
			splitStr.push(str);
			str = '';
		}
	}
	splitStr.push(str);
	return splitStr;
}

export * as Streams from './streams';

export interface FetchResult {
	text: () => Promise<string>;
	json: () => Promise<any>;
	status?: number;
	headers?: Record<string, any>
}

export function request(uri: string, opts: any = {}) {
	return new Promise<FetchResult>((resolve, reject) => {
		if (!opts) opts = {};
		let body = opts.body;
		if (body && typeof body !== 'string') {
		if (!opts.headers) opts.headers = {};
		if (!opts.headers['Content-Type']) {
			opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
		}
		body = encodeQuery(body);
	}

	if (opts.query) {
		uri += (uri.includes('?') ? '&' : '?') + encodeQuery(opts.query);
	}

		if (body) {
			if (!opts.headers) opts.headers = {};
			if (!opts.headers['Content-Length']) {
				opts.headers['Content-Length'] = Buffer.byteLength(body);
			}
		}

		const protocol = url.parse(uri).protocol as string;
		const net = protocol === 'https:' ? https : http;

		let resolveResponse: ((value: http.IncomingMessage | null) => void) | null;

		const result: string[] = [];
		const request = net.request(uri, opts, response => {

			response.setEncoding('utf-8');
			resolveResponse!(response);
			resolveResponse = null;

			response.on('data', data => {
				result.push(data);
			});
			response.on('end', () => {
				resolve({
					text: () => Promise.resolve(result.join('')),
					json: () => Promise.resolve(JSON.parse(result.join(''))),
					headers: response.headers,
					status: response.statusCode,
				});
			});
		});
		request.on('close', () => {
			resolve({
				text: () => Promise.resolve(result.join('')),
				json: () => Promise.resolve(JSON.parse(result.join(''))),
			});
		});
		request.on('error', error => {
			reject(error);
		});
		if (opts.timeout || opts.timeout === undefined) {
			request.setTimeout(opts.timeout || 5000, () => {
				reject(new Error("Request timeout"));
				request.abort();
			});
		}

		if (body) {
			request.write(body);
			request.end();
			if (opts.writable) {
				throw new Error(`options.body is what you would have written to a NetStream - you must choose one or the other`);
			}
		} else {
			request.end();
		}
	});
}

function encodeQuery(data: any) {
	let out = '';
	for (const key in data) {
		if (out) out += `&`;
		out += `${key}=${encodeURIComponent('' + data[key])}`;
	}
	return out;
}