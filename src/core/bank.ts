import { Component } from './component';
import { MultiPort, IOPort, Reactor, Runtime, Present } from './reactor'
export type ReactorArgs<T> = T extends any[] ? T : never;

// class Reactor {

// }

// class SomeClass extends Reactor {
// 	constructor(public x:number, public y: string) {
// 		super()
// 	}
// }

type ReactorConstructor<T extends Reactor, S> = {
  new (...args:ReactorArgs<S>): T;
}

// function foo<T,S>(cls:ReactorConstructor<T,S>, ...args:ReactorArgs<S>):T {
// 	return Reflect.construct(cls, args, cls)
// }

// let inst = foo(SomeClass, 1, "foo")
// console.log(inst instanceof SomeClass)

// console.log(inst.x)
// console.log(inst.y)

export class Bank<T extends Reactor, S> extends Component {
    private runtime!: Runtime;

    public _receiveRuntimeObject(runtime: Runtime): void {
        if (!this.runtime) {
            this.runtime = runtime
        } else {
            throw new Error("Can only establish link to runtime once. Name: " + this._getFullyQualifiedName())
        }
    }
	private readonly members: Array<T> = new Array();
	constructor(container: Reactor, width: number, cls:ReactorConstructor<T, S>, bankIndexArgIndex?: number, ...args:ReactorArgs<S>) {
        super(container)
		
		for (let i=0; i < width; i++) {
            if (bankIndexArgIndex !== undefined) {
                // When bankIndexArgIndex is not null,
                // bankIndexArgIndex indicates the index of "bank_index" paramter in the argument list of the reactor as in LF program.
                // +1 is added since the 0th arg to the constructor of the code-generated TS reactor is actually the container (parent).
                args[bankIndexArgIndex + 1] = i
            }
			this.members.push(Reflect.construct(cls, args, cls));
		}
		
	}
    
    public get(index:number): T {
        return this.members[index]
    }

    public all():Array<T> {
        return this.members
    }
}

// let bank = new Bank(3, SomeClass, 4, "foo")
// console.log(bank.get(0).x)
// console.log(bank.get(1).x)
// console.log(bank.get(2).x)
