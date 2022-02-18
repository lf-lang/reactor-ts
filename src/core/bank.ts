import { InPort, Present, Reactor } from './reactor'

type ReactorConstructor<T extends Reactor, S> = {
    new (...args:ReactorArgs<S>): T;
}
// FIXME(marten) 
// Also see: https://www.typescriptlang.org/docs/handbook/utility-types.html#constructorparameterstype
export type ReactorArgs<T> = T extends any[] ? T : never;

export class Bank<T extends Reactor,S> {

	private readonly members: Array<T> = new Array();
	constructor(width: number, cls:ReactorConstructor<T,S>, ...args:ReactorArgs<S>) {
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
