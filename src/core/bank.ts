import { Component } from './component';
import { Reactor, Runtime } from './reactor'

type ReactorConstructor<T extends Reactor, S> = {
    new (...args:ReactorArgs<S>): T;
  }
export type ReactorArgs<T> = T extends any[] ? T : never;

export class Bank<T extends Reactor,S> {

	private readonly members: Array<T> = new Array();
	constructor(parent: Reactor, width: number, cls:ReactorConstructor<T,S>, ...args:ReactorArgs<S>) {
	    for (let i=0; i < width; i++) {
			this.members.push(Reflect.construct(cls, args, cls));
            this.members[i].setBankIndex(i)
		}
	}
    
    public get(index:number):T {
        return this.members[index]
    }

    public all():Array<T> {
        return this.members
    }
}


// class Reactor {

// }

// class SomeClass extends Reactor {
// 	constructor(public x:number, public y: string) {
// 		super()
// 	}
// }




// function foo<T,S>(cls:ReactorConstructor<T,S>, ...args:ReactorArgs<S>):T {
// 	return Reflect.construct(cls, args, cls)
// }

// let inst = foo(SomeClass, 1, "foo")
// console.log(inst instanceof SomeClass)

// console.log(inst.x)
// console.log(inst.y)



// let bank = new Bank(3, SomeClass, 4, "foo")
// console.log(bank.get(0).x)
// console.log(bank.get(1).x)
// console.log(bank.get(2).x)
