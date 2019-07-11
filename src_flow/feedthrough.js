

class Feedthrough extends Component implements Actor {
    in: InPort<PureEvent> = new InPort(this);
    out: OutPort<PureEvent> = new OutPort(this);

    _reactions = [
        [[this.in], () => {this.out.send(this.in._value)}]
    ];

}

class Pass extends Reaction<> {

}