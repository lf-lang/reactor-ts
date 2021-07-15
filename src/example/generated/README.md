The contents of this directory illustrate how to create a federated reactor in reactor-ts. These files began life as generated lingua-franca code, but have been significantly cleaned up.

The two directories DistributedPhysical and DistributedLogical each have an example sender and receiver program for a logical and a physical connection. These examples are meant to immitate the C target example for the RTI at lingua-franca/example/Distributed. To run the example programs

1) Build the reactor-ts repo via $npm run build.
2) Compile the C RTI example program at lingua-franca/example/C/src/DistributedHelloWorld/.
3) Start the generated C RTI program at lingua-franca/example/C/bin/HelloWorld_RTI
4) Change directory to /lingua-franca/org.lflang/src/lib/TS/reactor-ts
5) Run generated Distributed_msg with `node dist/example/generated/DistributedLogical/Distributed_msg.js`
5) Run generated Distributed_dsp with `node dist/example/generated/DistributedLogical/Distributed_dsp.js`

Note that Distributed_RTI is generated with information about this specific Federate topology, and won't work with any other model than a Sender and a Destination with the correct PortIDs and FederateIDs.

4) You can also try substituting one of the TS examples with its corresponding C version lingua-franca/example/Distributed/bin/Distributed_Receiver or lingua-franca/example/Distributed/bin/Distributed_Sender.