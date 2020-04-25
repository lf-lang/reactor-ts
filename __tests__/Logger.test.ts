import {Logger} from '../src/share/Logger'
import {Reactor, InPort, Reaction, Read, Triggers, Args, State, Present, ReactionSandbox, App} from '../src/core/reactor';
import { TimeValue, UnitBasedTimeValue, TimeUnit } from '../src/core/time';



const _reactor:Reactor = new App()
const lg:Logger = new Logger(_reactor , 10)

/**
 * Test of helper functions for time in reactors
 */
describe('Logger functions', function () {

    it('test failures', function () {
        
    });


});