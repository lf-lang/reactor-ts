import {App} from '../reactor';
import {TimeInterval} from "../time"
import {OutputResponder} from '../components/OutputEvent';

class OutputEventTest extends App {
    oResponder: OutputResponder = new OutputResponder(this);
}

// This test shows the OutputEvent reactor is able to trigger a reaction on
// a contained reactor's output.
describe('OutputEventTest', function () {

    //Ensure the test will run for 5 seconds.
    jest.setTimeout(5000);

    it('start runtime', done => {
        console.log("starting test");

        function fail() {
            throw new Error("Test has failed.");
        };

        // Tell the reactor runtime to successfully terminate after 3 seconds.
        var oEventTest = new OutputEventTest(new TimeInterval(3),"OutputEventTest", done, fail);
        // Don't give the runtime the done callback because we don't care if it terminates
        oEventTest._start();
    })
});