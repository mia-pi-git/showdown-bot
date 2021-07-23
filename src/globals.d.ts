import type {PSInterface} from './main';

declare global {
	namespace NodeJS {
		interface Global {
			readonly PS: PSInterface;
			utils: typeof import('./lib/utils');
			toID: typeof import('./lib/utils').toID;
			Config: import('./configuration').Configuration;
 		}
	}
    const PS: PSInterface;
	const utils: typeof import('./lib/utils');
	const toID: typeof import('./lib/utils').toID;
	const Config: import('./configuration').Configuration;
}