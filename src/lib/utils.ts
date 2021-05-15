import * as http from 'http';
import * as https from 'https';
import * as URL from 'url';

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

export function encodeURLBody(body: {[k: string]: any}) {
	return Object.entries(body).map(
		([k, val]) => `${k}=${encodeURIComponent(val)}`
	).join('&');
}

export function request(url: string, body?: {[k: string]: any}, method = 'GET') {
	if (body) {
		url += `?`;
       	url += encodeURLBody(body);
    }
	const net = URL.parse(url).protocol === 'http' ? http : https;
	return new Promise<any>((resolve, reject) => {
		net.request(url, {method}, (res) => {
			res.on('error', err => reject(err));
			const result: string[] = [];
			res.on('data', d => result.push(d));
			res.on('end', 
				() => resolve(safeJSON(result.join('')))
			);
		});
	});
}

export function post(url: string, body: {[k: string]: any}) {
    return request(url, body, 'POST');
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