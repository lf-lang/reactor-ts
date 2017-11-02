// @flow

'use strict';

/** ES6 imports */
import {Timeout, Director} from './director'

class DiscreteEvents implements Director {

	setTimeout(fn: Function, delay: number): Timeout {
		
	}

	clearTimeout(timeout: Timeout): void {

	}
	
	setImmediate(fn: Function): Immediate {

	}
	
	clearImmediate(handle: Immediate): void {

	}
	
	setInterval(timeout: Timeout): void {

	}
	clearInterval(handle: Timeout): void {

	}

	send(port: Port, value: any): void {

	} // FIXME: types
	get(port: Port): any {

	}


}
