import { Reactor, App, InPort, OutPort } from '../src/core/internal';

class InOut extends Reactor {
  a = new InPort<string>(this);
  b = new OutPort<string>(this);

  constructor (parent: Reactor) {
    super(parent);
  }
}

const app = new class extends App {
  container = new class extends InOut {
    contained = new class extends InOut {
      containedAgain = new InOut(this);
    }(this);
  }(this);

  foo = new InOut(this);
}();

describe('Container to Contained', () => {
  it('app name', () => {
    expect(app.toString()).toBe('app');
  });

  it('contained reactor name', () => {
    expect(app.container.contained.toString()).toBe('app.container.contained');
  });

  it('container reactor name', () => {
    expect(app.container.toString()).toBe('app.container');
  });

  it('testing canConnect', () => {
    expect(app.container.canConnect(app.container.a, app.container.contained.a)).toBe(true);
    expect(app.container.canConnect(app.container.contained.a, app.container.a)).toBe(false);
    expect(app.container.canConnect(app.container.contained.a, app.container.contained.b)).toBe(false);
    expect(app.container.canConnect(app.container.contained.b, app.container.contained.a)).toBe(true);

    expect(app.container.canConnect(app.container.a, app.container.contained.b)).toBe(false);
    expect(app.container.canConnect(app.container.contained.b, app.container.a)).toBe(false);

    expect(app.container.canConnect(app.container.b, app.container.contained.a)).toBe(false);
    expect(app.container.canConnect(app.container.contained.a, app.container.b)).toBe(false);

    expect(app.container.canConnect(app.container.b, app.container.contained.b)).toBe(false);
    expect(app.container.canConnect(app.container.contained.b, app.container.b)).toBe(true);

    expect(app.container.canConnect(app.container.contained.a, app.foo.a)).toBe(false);
    expect(app.container.canConnect(app.container.contained.a, app.foo.b)).toBe(false);
    expect(app.container.canConnect(app.foo.a, app.container.contained.a)).toBe(false);
    expect(app.container.canConnect(app.foo.a, app.container.contained.a)).toBe(false);

    expect(app.container.canConnect(app.foo.a, app.container.b)).toBe(false);
    expect(app.container.canConnect(app.foo.a, app.container.a)).toBe(false);

    // expect(app.container.contained).toBeDefined();

    // if (container.child) {
    expect(app.container.contained.canConnect(app.container.contained.containedAgain.a, app.container.contained.a)).toBe(false);
    expect(app.container.contained.canConnect(app.container.contained.containedAgain.b, app.container.contained.b)).toBe(true);
    expect(app.container.contained.canConnect(app.container.contained.containedAgain.a, app.container.a)).toBe(false);
    expect(app.container.contained.canConnect(app.container.contained.containedAgain.b, app.container.b)).toBe(false);
    expect(app.container.contained.canConnect(app.container.contained.containedAgain.a, app.foo.a)).toBe(false);
    expect(app.container.contained.canConnect(app.container.contained.containedAgain.b, app.foo.b)).toBe(false);
    expect(app.container.contained.canConnect(app.container.contained.containedAgain.a, app.foo.a)).toBe(false);
    expect(app.container.contained.canConnect(app.container.contained.containedAgain.b, app.foo.b)).toBe(false);
    // }
  });
});
