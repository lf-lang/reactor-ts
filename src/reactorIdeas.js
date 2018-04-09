// @flow

'use strict';

// The main principle is that this should be an interface for
// defining (re)actors/processes in different models of computation,
// in a fashion similar to Ptolemy. The main concept is that by
// leveraging the static typechecker we can do a lot of analysis
// a priori, including:
//  - Input/Output types in a finer granularity (to see if an
//    exchange would be feasible)
//  - Depending on the types of rules perhaps rule out some MoCs?
//  - Be compatible/allow semantics for *transforming* the
//    "computational network". 
// 
// Some desirable requirements:
// - Compatible with callbacks/asynchronous computation 
// - Have control over shared state? Do we want to allow a
//   reaction rule to access "private" variables of the actor?
// - Be able to expose concurrency!
// 

// These classes would be implemented in the framework
// and would allow you to ensure we only commit the writes
// etc at the right time.
class Input<T>{
    content : T;
    constructor(){}
    get : void => T = function(){
        return this.content;
    }
};
class Output<T>{
    constructor(){}
    write(item : T) : boolean {
        return true;
    }
};

class Reactor{
    rules : Array<mixed>; // it's all reactionrules. are there universal quantifiers for polymorphic types?
    registerRule(rule: ReactionRule<*,*>){ //This might be wrong. We probably also need quantifiers here.
        this.rules = [rule]; // cons this.rules  
    }

};

class ReactionRule<I,O>{
    reaction : () => mixed;
    constructor(rule){
    this.reaction = rule;
    }
};

class ExampleReactor extends Reactor{
    input1 : Input<string>;
    input2 : Input<number>;
    output1 : Output<string>;
    startReact1(continuation : (string, number) => void){

        var name : string = this.input1.get();
        var num : number = this.input2.get();
        continuation.call(continuation,name,num);
        // The problem here is that this would not block,
        // yet control would finish and the framework
        // will not know abouth the callback...
    };

    finishReact1( name : string, num: number){
        //here we're simulating some database I/O or something.
        var i;
        for (i = 0; i < 10000; i++) {
            i = i + 1;
        }
        this.output1.write(name + String(num));
    }

    //What I don't like about this is that there's no ensuring we don't
    // just forget that we use something inside the function.
    ReactionRule1(){ // extends ReactionRule{ <- won't work, since it can't be a class
        this.startReact1(this.finishReact1);
    };


    init(){
        //I'm not sure how I feel about needing this instantiation here.
        //On the other hand, it makes it possible to make reactions parametric.
        //And this registration policy makes things easier: execution semantics
        //are defined simply by registartion order, if needed?
        //var rr1 : ReactionRule<[string, number], string> = ReactionRule1; //makes static analysis possible
        var rr1 : ReactionRule<[string, number], string> = new ReactionRule(this.ReactionRule1); //makes static analysis possible
        this.registerRule(rr1);
    }

};
