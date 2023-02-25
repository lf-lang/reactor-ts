import {Action, FederatePortAction, App, Origin, TimeValue, Triggers, Args, Tag} from '../src/core/internal';

let intendedTagDelay: TimeValue | undefined
let intendedTagMicrostepDelay: number
let startUpTag: Tag

class ReactorWithFederatePortAction extends App {
    a = new Action<number>(this, Origin.logical, TimeValue.nsec(10))
    f = new FederatePortAction<number>(this, Origin.logical)
    
    constructor () {
        super(TimeValue.msec(1));
        this.addReaction(
            new Triggers(this.startup),
            new Args(this.schedulable(this.a)),
            function(this, a){
                startUpTag = this.util.getCurrentTag()
                a.schedule(0, 0);
            }
        );

        this.addReaction(
            new Triggers(this.a),
            new Args(this.schedulable(this.f)),
            function(this, f){
                let intendedTag: Tag | undefined
                if (intendedTagDelay === undefined) {
                    intendedTag = undefined
                } else {
                    intendedTag = startUpTag.getLaterTag(intendedTagDelay).getMicroStepsLater(intendedTagMicrostepDelay)
                }
                f.schedule(0, 0, intendedTag);
            }
        );
    }

    public setLastTagProvisional(value: boolean) {
        this._isLastTAGProvisional = value
    }
}

describe('Intended tag tests', function () {
    it('Undefined intended tag', function() {
        intendedTagDelay = undefined
        let app = new ReactorWithFederatePortAction()
        expect(() => app._start()).toThrowError("FederatedPortAction must have an intended tag from RTI.")
    })
    
    it('Intended tag smaller than current tag', function() {
        intendedTagDelay = TimeValue.nsec(9)
        intendedTagMicrostepDelay = 0
        let app = new ReactorWithFederatePortAction()
        app.setLastTagProvisional(false)
        expect(() => app._start()).toThrowError("Intended tag must be greater than current tag. Intended tag")
    })
    
    it('Intended tag equal to current tag', function() {
        intendedTagDelay = TimeValue.nsec(10)
        intendedTagMicrostepDelay = 0
        let app = new ReactorWithFederatePortAction()
        app.setLastTagProvisional(false)
        expect(() => app._start()).toThrowError("Intended tag must be greater than current tag. Intended tag: ")
    })
    
    it('Intended tag greater than current tag', function() {
        intendedTagDelay = TimeValue.nsec(11)
        intendedTagMicrostepDelay = 0
        let app = new ReactorWithFederatePortAction()
        app.setLastTagProvisional(false)
        expect(() => app._start()).not.toThrow()
    })

    it('Intended tag greater than current tag by microstep', function() {
        intendedTagDelay = TimeValue.nsec(10)
        intendedTagMicrostepDelay = 2
        let app = new ReactorWithFederatePortAction()
        app.setLastTagProvisional(false)
        expect(() => app._start()).not.toThrow()
    })
})

describe('Intended tag tests when TAG is provisional', function () {
    it('Intended tag smaller than current tag', function() {
        intendedTagDelay = TimeValue.nsec(9)
        intendedTagMicrostepDelay = 0
        let app = new ReactorWithFederatePortAction()
        app.setLastTagProvisional(true)
        expect(() => app._start()).toThrowError("Intended tag must be greater than or equal to current tag, when the last TAG is provisional. Intended tag: ")
    })
    
    it('Intended tag equal to current tag', function() {
        intendedTagDelay = TimeValue.nsec(10)
        intendedTagMicrostepDelay = 1
        let app = new ReactorWithFederatePortAction()
        app.setLastTagProvisional(true)
        expect(() => app._start()).not.toThrow()
    })
    
    it('Intended tag greater than current tag', function() {
        intendedTagDelay = TimeValue.nsec(11)
        intendedTagMicrostepDelay = 0
        let app = new ReactorWithFederatePortAction()
        app.setLastTagProvisional(true)
        expect(() => app._start()).not.toThrow()
    })

    it('Intended tag greater than current tag by microstep', function() {
        intendedTagDelay = TimeValue.nsec(10)
        intendedTagMicrostepDelay = 2
        let app = new ReactorWithFederatePortAction()
        app.setLastTagProvisional(true)
        expect(() => app._start()).not.toThrow()
    })
})
