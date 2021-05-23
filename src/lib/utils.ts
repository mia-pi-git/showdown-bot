import axios from 'axios';
import fs from 'fs';

/*export async function request(url: string, body?: {[k: string]: any}, method = 'GET') {
    if (body) {
		url += `?`;
       	url += Object.entries(body).map(
			([k, val]) => `${k}=${encodeURIComponent(val)}`
		).join('&');
    }
    const response = await fetch(url, {method});
    const data = await response.text();
    try {
		return JSON.parse(data);
	} catch (e) {
		return data;
	}
}*/

export function safeJSON(str: string) {
	try {
		return JSON.parse(str);
	} catch (e) {
		return str;
	}
}

export async function post(url: string, body: {[k: string]: any}, transformer?: (data: any) => any) {
	const data = await axios.post(url, body);
	return safeJSON(transformer ? transformer(data.data) : data.data);
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

/**
 * Visualizes eval output. Borrowed from Pokemon Showdown.
 */
export function visualize(value: any, depth = 0): string {
	if (value === undefined) return `undefined`;
	if (value === null) return `null`;
	if (typeof value === 'number' || typeof value === 'boolean') {
		return `${value}`;
	}
	if (typeof value === 'string') {
		return `"${value}"`; // NOT ESCAPED
	}
	if (typeof value === 'symbol') {
		return value.toString();
	}
	if (Array.isArray(value)) {
		if (depth > 10) return `[array]`;
		return `[` + value.map(elem => visualize(elem, depth + 1)).join(`, `) + `]`;
	}
	if (value instanceof RegExp || value instanceof Date || value instanceof Function) {
		if (depth && value instanceof Function) return `Function`;
		return `${value}`;
	}
	let constructor = '';
	if (value.constructor && value.constructor.name && typeof value.constructor.name === 'string') {
		constructor = value.constructor.name;
		if (constructor === 'Object') constructor = '';
	} else {
		constructor = 'null';
	}
	// If it has a toString, try to grab the base class from there
	// (This is for Map/Set subclasses like user.auth)
	const baseClass = (value?.toString && /\[object (.*)\]/.exec(value.toString())?.[1]) || constructor;

	switch (baseClass) {
	case 'Map':
		if (depth > 2) return `Map`;
		const mapped = [...value.entries()].map(
			val => `${visualize(val[0], depth + 1)} => ${visualize(val[1], depth + 1)}`
		);
		return `${constructor} (${value.size}) { ${mapped.join(', ')} }`;
	case 'Set':
		if (depth > 2) return `Set`;
		return `${constructor} (${value.size}) { ${[...value].map(v => visualize(v), depth + 1).join(', ')} }`;
	}

	if (value.toString) {
		try {
			const stringValue = value.toString();
			if (typeof stringValue === 'string' &&
					stringValue !== '[object Object]' &&
					stringValue !== `[object ${constructor}]`) {
				return `${constructor}(${stringValue})`;
			}
		} catch (e) {}
	}
	let buf = '';
	for (const key in value) {
		if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
		if (depth > 2 || (depth && constructor)) {
			buf = '...';
			break;
		}
		if (buf) buf += `, `;
		let displayedKey = key;
		if (!/^[A-Za-z0-9_$]+$/.test(key)) displayedKey = JSON.stringify(key);
		buf += `${displayedKey}: ` + visualize(value[key], depth + 1);
	}
	if (constructor && !buf && constructor !== 'null') return constructor;
	return `${constructor}{${buf}}`;
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
        res = utils.visualize(res);
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
	fs.writeFileSync(`${__filename}/../${path}`, JSON.stringify(obj));
}

export {DataStream as Stream} from './streams';
export {TableCache} from './cache';