**A simple, easily customizable bot for connecting to Pokemon Showdown.**

This package has two requirements for connecting to PS.
- A HTTP requester (we recommend node-fetch)
- A WebSocket instance (we recommend sockjs-client or WebSocket.)

From there, all you need to do is as follows:
(TS)
```ts
import PSInterface from 'ts-showdown-bot';
import fetch from 'node-fetch';
import SockJS from 'sockjs-client';

const PS = new PSInterface({
    name: 'uwu', pass: 'uwu',
}, fetch, SockJS);
```
(JS)
```js
const {PSInterface} = require('ts-showdown-bot');
const fetch = require('node-fetch');
const SockJS = require('sockjs-client');

const PS = new PSInterface({
    name: 'uwu', pass: 'uwu',
}, fetch, SockJS);
```

From there, the bot will start automatically. 
As for adding your own plugins, all you need to do is call `PSInterface#loadPluginFrom(absolute path)`.
See `src/commands.ts` for how those work.