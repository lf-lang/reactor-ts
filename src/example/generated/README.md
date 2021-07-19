The contents of this directory illustrate how to create a federated reactor in reactor-ts. These files began life as generated lingua-franca code, but have been significantly cleaned up.

The two directories DistributedLogical and DistributedPhysical each have an example sender and receiver program for a logical and a physical connection. These examples are meant to immitate the C target example for the RTI at lingua-franca/example/C/src/Distributed*. See instructions for running these examples below.

To compile the TypeScript federated examples:

1) Change directory to /lingua-franca/org.lflang/src/lib/TS/reactor-ts
2) Build the reactor-ts repo via $npm run build.

To run the example, first compile and run the standalone RTI:

1) Move to the C RTI directory at: lingua-franca/org.lflang/src/lib/core/federated/RTI
2) Compile the standalone C RTI (see README.md for instructions) and run it with `build/RTI -n 2`

To run DistributedLogical example:

1) Change directory to /lingua-franca/org.lflang/src/lib/TS/reactor-ts
2) Run generated Distributed_msg (sender) with `node dist/example/generated/DistributedLogical/Distributed_msg.js`
3) Run generated Distributed_dsp (receiber) with `node dist/example/generated/DistributedLogical/Distributed_dsp.js`

To run DistributedPhysical example:

1) Change directory to /lingua-franca/org.lflang/src/lib/TS/reactor-ts
2) Run generated Distributed_msg (sender) with `node dist/example/generated/DistributedPhysical/Distributed_msg.js`
3) Run generated Distributed_dsp (receiber) with `node dist/example/generated/DistributedPhysical/Distributed_dsp.js`

OUTDATED: You can also try substituting one of the TS examples with its corresponding C version lingua-franca/example/Distributed/bin/Distributed_Receiver or lingua-franca/example/Distributed/bin/Distributed_Sender.