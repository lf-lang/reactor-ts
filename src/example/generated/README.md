The contents of this directory illustrate how to create a federated reactor in reactor-ts. These files began life as generated lingua-franca code, but have been significantly cleaned up.

The two directories DistributedPhysical and DistributedLogical each have an example sender and receiver program for a logical and a physical connection. These examples are meant to immitate the C target example for the RTI at lingua-franca/example/Distributed. To run the example programs

1) Build the reactor-ts repo via $npm run build.
2) Compile the C RTI example program at lingua-franca/example/Distributed.
3) Start the generated C RTI program at lingua-franca/example/Distributed/bin/Distributed_RTI

Note that Distributed_RTI is generated with information about this specific Federate topology, and won't work with any other model than a Sender and a Destination with the correct PortIDs and FederateIDs.

4) You can also try substituting one of the TS examples with its corresponding C version lingua-franca/example/Distributed/bin/Distributed_Receiver or lingua-franca/example/Distributed/bin/Distributed_Sender.