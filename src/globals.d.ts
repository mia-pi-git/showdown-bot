import type {PSInterface} from './main';

declare global {
	namespace NodeJS {
		interface Global {
			readonly PS: PSInterface;
 		}
	}
    const PS: PSInterface;
}