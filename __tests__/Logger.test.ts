import {Logger} from '../src/share/Logger'
import {Reactor, App, Log, LogLevel, loggingCLAType, booleanCLAType, stringCLAType, unitBasedTimeValueCLAType} from '../src/core/internal';

const _reactor:Reactor = new App()
const lg:Logger = new Logger(_reactor , 10)

/**
 * 
 */
describe('Logger functions', function () {

    it('test failures', function () {
        
    });


});


/**
 * Test for Logging utilities
 */

 describe('Test for Logger', () => {
    
    it('DEBUG Log', () => {
        
        Log.global.level = LogLevel.DEBUG

        console.log("Log level is " + Log.global.level)
        Log.getInstance("test module")
        Log.debug(null, () => "test");
        Log.debug(null, () => "test", "test module");
        Log.error(null, () => "test");
        Log.error(null, () => "test", "test module");
        Log.info(null, () => "test");
        Log.info(null, () => "test", "test module");
        Log.log(null, () => "test");
        Log.log(null, () => "test", "test module");
        Log.warn(null, () => "test");
        Log.warn(null, () => "test", "test module");

        jest.spyOn(Log, 'debug')
        jest.spyOn(Log, 'error')
        jest.spyOn(Log, 'info')
        jest.spyOn(Log, 'log')
        jest.spyOn(Log, 'warn')

        Log.getInstance("test module")
        Log.debug(null, () => "test");
        Log.debug(null, () => "test", "test module");
        Log.error(null, () => "test");
        Log.error(null, () => "test", "test module");
        Log.info(null, () => "test");
        Log.info(null, () => "test", "test module");
        Log.log(null, () => "test");
        Log.log(null, () => "test", "test module");
        Log.warn(null, () => "test");
        Log.warn(null, () => "test", "test module");

        expect(Log.debug).toHaveBeenCalledTimes(2);
        expect(Log.error).toHaveBeenCalledTimes(2);
        expect(Log.info).toHaveBeenCalledTimes(2);
        expect(Log.log).toHaveBeenCalledTimes(2);
        expect(Log.warn).toHaveBeenCalledTimes(2);

        console.log(Log.global.level)
    });
});

describe('Command Line Arguments Helper Functions Tests', () => {
    let testValue = unitBasedTimeValueCLAType('1 sec');
    test('null if the input is malformed', () => {
        expect(loggingCLAType('')).toBeNull
    });
    test('log level check', () => {
        expect(loggingCLAType('ERROR')).toBe(1)
    });
    test('boolean test for command line argument parsing', () => {
        expect(booleanCLAType('true')).toBe(true)
        expect(booleanCLAType('false')).toBe(false)
        expect(booleanCLAType('')).toBeNull
    });
    test('return an argument string as is', () => {
        expect(stringCLAType('arg')).toBe('arg')
    });
    test('convert a string into a UnitBasedTimeValue', () => {
        expect(unitBasedTimeValueCLAType('' && '*')).toBeNull
        expect(unitBasedTimeValueCLAType('1 secsec' || '1sec')).toBeNull
        expect(testValue?.toString()).toBe("(1 secs; 0 nsecs)")
    });
});