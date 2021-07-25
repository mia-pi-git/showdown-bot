**A simple, easily customizable bot for connecting to Pokemon Showdown.**

This package has one requirement for connecting to PS.
- A WebSocket instance (we recommend sockjs-client or WebSocket.)
(We used to require a HTTP fetcher, and in fact still support it, but we have a native version in src/utils, so it is not required.)
For customizing fetch, just pass the fetcher instead of null in the second argument.

From there, all you need to do is as follows:
(TS)
```ts
import PSInterface from 'ts-showdown-bot';
import SockJS from 'sockjs-client';

const PS = new PSInterface({
    name: 'uwu', pass: 'uwu',
}, null, SockJS);
```

(JS)
```js
const {PSInterface} = require('ts-showdown-bot');
const SockJS = require('sockjs-client');

const PS = new PSInterface({
    name: 'uwu', pass: 'uwu',
}, null, SockJS);
```

From there, the bot will start automatically. 
As for adding your own plugins, all you need to do is call `PSInterface#loadPluginFrom(absolute path)`.
See `src/commands.ts` for how those work.