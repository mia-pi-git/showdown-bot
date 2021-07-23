import fs from 'fs';

export {TableCache} from './cache';
export {SQLDatabase} from './database';

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
