/**
 * Initializes the bot.
 */
import {execSync as exec} from 'child_process';
import {existsSync as exists, copyFileSync as copyTo} from 'fs';

exec('npx tsc');
if (!exists(`${__dirname}/../config/config.js`)) {
    console.log(`Config file not found, copying default...`);
    copyTo(`${__dirname}/../config/config-example.js`, `${__dirname}/../config/config.js`);
}

import {PSInterface} from './main';

if (require.main === module) {
    (global as any).PS = new PSInterface(require('node-fetch'));
}

export default PSInterface;