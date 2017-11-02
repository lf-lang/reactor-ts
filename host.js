// @flow

'use strict';

/** ES6 imports */

/**
 * Interface of the host.
 */
export interface Host {
	require(module: string): Object;
	alert(message: string): void;
	error(message: string): void;
	getResource(uri: string): string; // This function seems redundant 
}
