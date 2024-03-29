import {Priority, Sortable, ReactionGraph, dontIndent} from "../src/core/internal";
import {
  Reactor,
  App,
  InPort,
  SortablePrecedenceGraph,
  PrioritySet,
  Log,
} from "../src/core/internal";

// Log.setGlobalLevel(Log.levels.DEBUG);

class R extends Reactor {
  protected in = new InPort(this);

  constructor(parent: Reactor | null) {
    super(parent);
    for (let i = 0; i < 7; i++) {
      this.addReaction([this.in], [], function (this) {
        throw new Error("Method not implemented.");
      });
    }
  }

  getNodes() {
    return this._getReactions();
  }
}

class SR extends Reactor {
  protected in = new InPort(this);

  constructor(parent: Reactor | null) {
    super(parent);
    this.addReaction([this.in], [], function (this) {
      throw new Error("Method not implemented.");
    });
  }

  getNodes() {
    return this._getReactions();
  }
}

class CNode<T> implements Sortable<Priority> {
  public priority: Priority = Number.MAX_SAFE_INTEGER;

  constructor() {}

  public setPriority(priority: number) {
    this.priority = priority;
  }
}

describe("Manually constructed simple precedence graphs", () => {
  var graph = new ReactionGraph();
  var reactor = new SR(new App());

  var nodes = reactor.getNodes();

  graph.addNode(nodes[0]);

  it("graph equality", () => {
    expect([...graph.getNodes()]).toEqual(nodes);
  });
});

describe("Test for corner cases", () => {
  var graph = new SortablePrecedenceGraph<Sortable<Priority>>();
  const node: Sortable<Priority> = new CNode<Priority>();
  graph.addEdge(new CNode<Priority>(), node);
});

describe("Manually constructed precedence graphs", () => {
  var graph = new ReactionGraph();
  var reactor = new R(new App());

  var nodes = reactor.getNodes();

  graph.addEdge(nodes[5], nodes[3]);
  graph.addEdge(nodes[3], nodes[4]);
  graph.addEdge(nodes[3], nodes[2]);
  graph.addEdge(nodes[2], nodes[1]);
  graph.addEdge(nodes[4], nodes[1]);
  graph.addEdge(nodes[1], nodes[0]);
  graph.addEdge(nodes[4], nodes[0]);

  it("reaction equality", () => {
    expect(Object.is(nodes[0], nodes[1])).toBeFalsy();
  });

  it("initial graph", () => {
    expect(graph.size()[0]).toEqual(6); // V
    expect(graph.size()[1]).toEqual(7); // E
    expect(graph.toString()).toBe(
      dontIndent`graph
        0["app.R[R3]"]
        1["app.R[R5]"]
        2["app.R[R4]"]
        3["app.R[R2]"]
        4["app.R[R1]"]
        5["app.R[R0]"]
        1 --> 0
        0 --> 2
        0 --> 3
        3 --> 4
        2 --> 4
        4 --> 5
        2 --> 5`
    );
  });

  it("initial priorities", () => {
    graph.updatePriorities(false);
    expect(nodes[5].getPriority()).toEqual(0);
    expect(nodes[3].getPriority()).toEqual(100);
    expect(nodes[4].getPriority()).toEqual(200);
    expect(nodes[2].getPriority()).toEqual(300);
    expect(nodes[1].getPriority()).toEqual(400);
    expect(nodes[0].getPriority()).toEqual(500);
  });

  it("remove dependency 4 -> 5", () => {
    graph.removeEdge(nodes[3], nodes[4]);
    expect(graph.size()[0]).toEqual(6); // V
    expect(graph.size()[1]).toEqual(6); // E
    expect(graph.toString()).toBe(
      dontIndent`graph
      0["app.R[R3]"]
      1["app.R[R5]"]
      2["app.R[R4]"]
      3["app.R[R2]"]
      4["app.R[R1]"]
      5["app.R[R0]"]
      1 --> 0
      0 --> 3
      3 --> 4
      2 --> 4
      4 --> 5
      2 --> 5`
    );
  });

  it("remove node 2", () => {
    graph.removeNode(nodes[1]);
    expect(graph.size()[0]).toEqual(5); // V
    expect(graph.size()[1]).toEqual(3); // E
    Log.globalLogger.debug(graph.toString());
    expect(graph.toString()).toBe(
      dontIndent`graph
        0["app.R[R3]"]
        1["app.R[R5]"]
        2["app.R[R4]"]
        3["app.R[R2]"]
        4["app.R[R0]"]
        1 --> 0
        0 --> 3
        2 --> 4`
    );
  });

  it("add node 7, make 3 dependent on it", () => {
    graph.addNode(nodes[6]);
    graph.addEdge(nodes[6], nodes[2]);
    graph.addEdge(nodes[3], nodes[2]);
    expect(graph.size()[0]).toEqual(6); // V
    expect(graph.size()[1]).toEqual(4); // E
    Log.globalLogger.debug(graph.toString());
    expect(graph.toString()).toBe(
      dontIndent`graph
        0["app.R[R3]"]
        1["app.R[R5]"]
        2["app.R[R4]"]
        3["app.R[R2]"]
        4["app.R[R0]"]
        5["app.R[R6]"]
        1 --> 0
        0 --> 3
        5 --> 3
        2 --> 4`
    );
  });

  it("reassign priorities", () => {
    graph.updatePriorities(false);

    expect(nodes[5].getPriority()).toEqual(0);
    expect(nodes[4].getPriority()).toEqual(100);
    expect(nodes[6].getPriority()).toEqual(200);
    expect(nodes[3].getPriority()).toEqual(300);
    expect(nodes[0].getPriority()).toEqual(400);
    expect(nodes[2].getPriority()).toEqual(500);
  });

  it("introduce a cycle", () => {
    graph.addEdge(nodes[2], nodes[5]);
    expect(graph.updatePriorities(false)).toBeFalsy();
    Log.globalLogger.debug(graph.toString());
  });
});

describe("ReactionQ", () => {
  var graph = new ReactionGraph();
  var reactor = new R(new App());

  var nodes = reactor.getNodes();

  graph.addEdge(nodes[5], nodes[3]);
  graph.addEdge(nodes[3], nodes[4]);
  graph.addEdge(nodes[3], nodes[2]);
  graph.addEdge(nodes[2], nodes[1]);
  graph.addEdge(nodes[4], nodes[1]);
  graph.addEdge(nodes[1], nodes[0]);
  graph.addEdge(nodes[4], nodes[0]);
  graph.updatePriorities(false);

  var reactionQ = new PrioritySet<Priority>();

  for (let i = 0; i < 6; i++) {
    Log.globalLogger.debug(
      "Pushing node: " + i + " with prio: " + nodes[i].getPriority()
    );
    reactionQ.push(nodes[i]);
  }

  // duplicate insertions
  Log.globalLogger.debug(
    "Pushing duplicate node with prio: " + nodes[5].getPriority()
  );
  reactionQ.push(nodes[5]);
  Log.globalLogger.debug(
    "Pushing duplicate node with prio: " + nodes[1].getPriority()
  );
  reactionQ.push(nodes[1]);

  it("first pop", () => {
    const r = reactionQ.pop();
    for (let i = 0; i < 6; i++) {
      if (Object.is(r, nodes[i])) {
        Log.globalLogger.debug(
          "Found matching node: " + i + " with prio: " + nodes[i].getPriority()
        );
      }
    }
    expect(Object.is(r, nodes[5])).toBe(true);
    if (r) expect(r.getPriority()).toEqual(0);
  });

  it("second pop", () => {
    const r = reactionQ.pop();

    for (let i = 0; i < 6; i++) {
      if (Object.is(r, nodes[i])) {
        Log.globalLogger.debug(
          "Found matching node: " + i + " with prio: " + nodes[i].getPriority()
        );
      }
    }
    expect(Object.is(r, nodes[3])).toBe(true);
    if (r) expect(r.getPriority()).toEqual(100);
  });

  it("third pop", () => {
    const r = reactionQ.pop();
    for (let i = 0; i < 6; i++) {
      if (Object.is(r, nodes[i])) {
        Log.globalLogger.debug(
          "Found matching node: " + i + " with prio: " + nodes[i].getPriority()
        );
      }
    }
    expect(Object.is(r, nodes[4])).toBe(true);
    if (r) expect(r.getPriority()).toEqual(200);
  });

  it("fourth pop", () => {
    const r = reactionQ.pop();
    for (let i = 0; i < 6; i++) {
      if (Object.is(r, nodes[i])) {
        Log.globalLogger.debug(
          "Found matching node: " + i + " with prio: " + nodes[i].getPriority()
        );
      }
    }
    expect(Object.is(r, nodes[2])).toBe(true);
    if (r) expect(r.getPriority()).toEqual(300);
  });

  it("fifth pop", () => {
    const r = reactionQ.pop();
    for (let i = 0; i < 6; i++) {
      if (Object.is(r, nodes[i])) {
        Log.globalLogger.debug(
          "Found matching node: " + i + " with prio: " + nodes[i].getPriority()
        );
      }
    }
    expect(Object.is(r, nodes[1])).toBe(true);
    if (r) expect(r.getPriority()).toEqual(400);
  });

  it("sixth pop", () => {
    const r = reactionQ.pop();
    for (let i = 0; i < 6; i++) {
      if (Object.is(r, nodes[i])) {
        Log.globalLogger.debug(
          "Found matching node: " + i + " with prio: " + nodes[i].getPriority()
        );
      }
    }
    expect(Object.is(r, nodes[0])).toBe(true);
    if (r) expect(r.getPriority()).toEqual(500);
  });

  it("seventh pop", () => {
    const r = reactionQ.pop();
    expect(r).toBeUndefined();
  });
});

describe("Automatically constructed precedence graphs", () => {
  var reactor = new R(new App());
  it("internal dependencies between reactions", () => {
    // getPrecedenceGraph is not a public interface anymore
    /* expect(reactor.getPrecedenceGraph().toString()).toBe(
`digraph G {
"App/R[R6]"->"App/R[R5]"->"App/R[R4]"->"App/R[R3]"->"App/R[R2]"->"App/R[R1]"->"App/R[R0]"->"App/R[M1]"->"App/R[M0]";
}`); */
  });
});
