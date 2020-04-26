import {Logger} from '../src/share/Logger'
import {Reactor, InPort, Reaction, Read, Triggers, Args, State, Present, ReactionSandbox, App} from '../src/core/reactor';
import { TimeValue, UnitBasedTimeValue, TimeUnit } from '../src/core/time';
import { Log, LogLevel } from '../src/core/util'



const _reactor:Reactor = new App()
const lg:Logger = new Logger(_reactor , 10)

/**
 * Test of helper functions for time in reactors
 */
describe('Logger functions', function () {

    it('test failures', function () {
        
    });


});





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

        spyOn(Log, 'debug').and.callThrough
        spyOn(Log, 'error').and.callThrough
        spyOn(Log, 'info').and.callThrough
        spyOn(Log, 'log').and.callThrough
        spyOn(Log, 'warn').and.callThrough

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
        /* xpect(Log.getInstance("test module")).toEqual(""); */
        console.log(Log.global.level)
    });
});