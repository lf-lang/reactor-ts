// @flow

'use strict';

import {Logger} from './logger';

var logger = new Logger();

describe('logger', function () {
    it('Logging a string', function () {
        
        global.console.log = jest.fn();

        //global.console.log = {warn: jest.fn()}
        logger.in._value = "Hello world!";
        logger._reactions[0][1].react(); // FIXME: should not require an argument here

        // The first argument of the first call to the function was 'Hello world!'
        expect(console.log.mock.calls[0][0]).toBe('Hello world!');
    });
});
