import fetch from 'node-fetch';

export async function request(url: string, body?: {[k: string]: any}, method = 'GET') {
    let stringifiedBody = '';
    if (body) {
        for (const k in body) {
            stringifiedBody += `&${k}=${encodeURIComponent(body[k])}`;
        }
    }
    const response = await fetch(url, {method, body: stringifiedBody});
    try {
        return await response.json();
    } catch (e) {
        if (!e.message.includes('JSON')) throw e;
        return await response.text();
    }
}

export function post(url: string, body?: {[k: string]: any}) {
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