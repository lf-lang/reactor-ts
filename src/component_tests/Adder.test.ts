import {Adder} from '../components/Adder';
import {App} from '../reactor';

class MyAdder extends Adder {
    public fire() {
        for (let r of this._reactions) {
            r.doReact();
        }
    }
}
var app = new App(0);

describe('adder', function () {
    
    var adder = new MyAdder(app, "MyAdder");

    it('2 + 1 = 3', function () {

        expect(adder).toBeInstanceOf(Adder);
        adder._setApp(app); 
        adder.in1.set(2);
        adder.in2.set(1);
        adder.fire();
        expect(adder.out.get()).toBe(3);
    });
});

