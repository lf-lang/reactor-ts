// // @flow



// class Value<T> {
//     value: T;
//     constructor(value:T) {
//         this.value = value;
//     }
//     get() {
//         return this.value;
//     }
// }

// function bla(nope: number, yes: string) :void {
//     return;
// }

// var d = {nope: 3, yes: ""};

// // type Z = $Call<typeof bla, nope: number, yes: string>

// // (undefined:Z)


// class Reactor {
//     in:Value<number> = new Value(3);

//     //r1 = new Reaction<this>();
    


//     //$Call<typeof bla, {nope: number}>

//     //type ExtractPropType = <T>({prop: T}) => T;
     

// }

// class Reaction<T:Reactor> {
    
//     _container:T;
//     _uses:Map<string, Value<mixed>>;
//     _produces:$ReadOnlyArray<*>;

//     constructor() {

//     }

//     // constructor(container:T, uses: Map<string, Value<mixed>>, produces: Map<string, Value<mixed>>) {
//     //     this._uses = uses;

//     //     // if (new Set([...uses.keys()].filter(x => produces.keys().has(x))).size > 0) {
//     //     //     // overlap between uses and produces
//     //     // }
//     // }

//     react(worker:number):void {
//         // bring container.self into scope

//         // bring used actions and inputs into scope

//         // bring produced actions and outputs into scope
        
//         // evaluate

//         // execute reaction in given context (or let a worker do it, if it is given)

//     }

//     doReact(bla:Value<number>, something:Value<string>) {
        
//     }

// }

// // class DoSomething implements Reaction {
// //     container: Reactor;

// // }

// class Port<T> {
    
// }

// class InPort<T> extends Port<T> {
//     value:T;
    
//     get(): T {
//         return this.value;
//     }
// }

// class OutPort<T> extends Port<T> {

// }

// interface Bar {

//     +foo:(...args:Array<InPort<any>&OutPort<any>>) => void;
// }

// class X implements Bar {

//     constructor(state: Object) {

//     }

//     foo(nope: InPort<number>, yes: OutPort<string>): void {
//         var x = 3;
//         x + nope.get();
//         //x = x + yes.get();
//     }
    
// 	bla(nope: number, yes: string): void {
    
//     }
// }

// var x = new X();

// function bla(nope: number, yes: string) :void {
//     return;
// }

// var d = [3, ""];


// class ReactorBase {

//     reactions:Array<
//             [   // triggers, reaction, reaction arguments
//                 Array<InPort<any>>, X, *
//             ]
//     >
// }

// class Reactor2 extends ReactorBase {
// 	reactions = [
//         [[this.in, this.in2], new X(this.state), [this.in, this.out]],
//         //[new X(this.state), [3, ""]]
//         ]
//     state: Object = {};
    
//     in: InPort<number> = new InPort();
//     in2: InPort<string> = new InPort();
//     out: OutPort<number> = new OutPort();

//     //_reactions:$ReadOnlyArray<[Array<Trigger<*>>, Reaction<any, any>]>;

// 	constructor() {
//         super()
        

//         // Type check first reaction.
//         let triggers = this.reactions[0][0];
//         let reaction = this.reactions[0][1];
//         let args = this.reactions[0][2];
//         (undefined:$Call<typeof reaction.foo, $ElementType<typeof args, 0>, $ElementType<typeof args, 1>>)
        
//     }
// }
