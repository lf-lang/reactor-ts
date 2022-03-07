import {Logger} from '../src/share/Logger'
import {Reactor, App, Log, LogLevel} from '../src/core/internal';

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