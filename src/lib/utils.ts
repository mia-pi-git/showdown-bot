import * as fs from 'fs';

export {TableCache} from './cache';
export {SQLDatabase} from './database';
import * as https from 'https';
import * as http from 'http';
import fetch from 'node-fetch';
import * as url from 'url';

export function safeJSON(str: string) {
	try {
		return JSON.parse(str);
	} catch (e) {
		return str;
	}
}

export async function post(url: string, body: {[k: string]: any}, transformer?: (data: any) => any) {
	const data = await fetch(url, body).then(res => res.text());
	return safeJSON(transformer ? transformer(data) : data);
}

export function toID(text: any) {
	if (text && text.id) {
		text = text.id;
	} else if (text && text.userid) {
		text = text.userid;
	} else if (text && text.roomid) {
		text = text.roomid;
	}
	if (typeof text !== 'string' && typeof text !== 'number') return '';
	return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '') as string;
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
        res = require('pokemon-showdown/.lib-dist').Utils.visualize(res);
    } catch (e) {
        res = e.stack;
    }
	return res;
}

export function requireJSON(requireFunction: NodeJS.Require, path: string) {
	try {
		return requireFunction(path);
	} catch (e) {
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
	headers?: AnyObject
}

export function request(uri: string, opts: AnyObject = {}) {
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

function encodeQuery(data: AnyObject) {
	let out = '';
	for (const key in data) {
		if (out) out += `&`;
		out += `${key}=${encodeURIComponent('' + data[key])}`;
	}
	return out;
}