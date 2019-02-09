// @flow

'use strict';

import {Logger} from './logger';

var logger = new Logger();
global.console.log = jest.fn();

describe('logger', function () {
    it('Logging a string', function () {
        
        global.console.log = jest.fn();

        logger.in._value = "Hello world!";
        logger._reactions[0][1].react();

        // The first argument of the first call to the function was 'Hello world!'
        expect(console.log.mock.calls[0][0]).toBe('Hello world!');
    });
});

describe('logger', function () {
    it('Logging an object', function () {
        
        let obj = {foo: "hello", bar: "world"};
        
        logger.in._value = obj;
        logger._reactions[0][1].react();

        expect(console.log.mock.calls[1][0]).toBe(obj);
    });
});

describe('logger', function () {
    it('Logging an actor', function () {
        
        logger.in._value = logger;
        logger._reactions[0][1].react();

        expect(console.log.mock.calls[2][0]).toBe(logger);
    });
});