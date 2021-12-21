import { TimeValue, TimeUnit, Alarm } from '../src/core/time';
import NanoTimer from 'nanotimer';

var timerA = new NanoTimer();
var alarm = new Alarm();
var delay = TimeValue.withUnits(100, TimeUnit.msec);

describe('Timer tests', () => {
    
    it('Nanotimer: sync, wait 0.1 seconds, 20 samples\n\n', function(done) {
        var i = 0;
        var j = 0;
        var numSamples = 20;
        var doneCount = 0;
        var errors:number[] = [];
        var minError = 1000000000;
        var maxError = 0;
        var avgError = 0;
        
        
        var task = function(){
            var count = 0;
            for(i=0;i<1000000;i++){
                count++;
            }; 
        };
        
        for(j=0;j<numSamples;j++){
            timerA.setTimeout(task, [], '0.1s', function(data) {
                var waitTime = data.waitTime;
                console.log('\t\t - Sample #' + (doneCount+1));
                console.log('\t\t\t - Expected wait: 0.1 seconds');
                console.log('\t\t\t - Actual wait: ' + waitTime/1000000000 + ' seconds');
                var error = (((waitTime - 100000000) / (100000000)) * 100);
                console.log('\t\t\t - Error: ' + error + '%');
                errors.push(error);
                var waitedLongEnough = (waitTime >= 100000000);
                expect(waitedLongEnough).toBeTruthy();
                
                doneCount++;
                
                if(doneCount == numSamples){
                    for(i=0;i<numSamples;i++){
                        if(errors[i] < minError){
                            minError = errors[i];
                        }
                        
                        if (errors[i] > maxError){
                            maxError = errors[i];
                        }
                        
                        avgError += errors[i];
                    }
                    avgError = avgError / numSamples;
                    console.log('\t\t - Min. Error: ' + minError + '%');
                    console.log('\t\t - Max. Error: ' + maxError + '%');
                    console.log('\t\t - Avg. Error: ' + avgError + '%');
                    done();
                }
            });
        }
    });

    // it('Regular timer: sync, wait 0.1 seconds, 20 samples\n\n', function(done) {
    //     var i = 0;
    //     var j = 0;
    //     var numSamples = 20;
    //     var doneCount = 0;
    //     var errors:number[] = [];
    //     var minError = 1000000000;
    //     var maxError = 0;
    //     var avgError = 0;
        
    //     var timeRequested: TimeValue;

    //     var task = function(){
    //         var timeInvoked = getCurrentPhysicalTime();
    //         var waitTime:number = timeInvoked.subtract(timeRequested).toMilliseconds()*1000000;
    //         var x = function() {
    //             console.log('\t\t - Sample #' + (doneCount+1));
    //             console.log('\t\t\t - Expected wait: 0.1 seconds');
    //             console.log('\t\t\t - Actual wait: ' + waitTime/1000000000 + ' seconds');
    //             var error = (((waitTime - 100000000) / (100000000)) * 100);
    //             console.log('\t\t\t - Error: ' + error + '%');
    //             errors.push(error);
    //             var waitedLongEnough = (waitTime >= 100000000);
    //             expect(waitedLongEnough).toBeTruthy();
                
    //             doneCount++;
                
    //             if(doneCount == numSamples) {
    //                 for(i=0;i<numSamples;i++){
    //                     if(errors[i] < minError){
    //                         minError = errors[i];
    //                     }
                        
    //                     if (errors[i] > maxError){
    //                         maxError = errors[i];
    //                     }
                        
    //                     avgError += errors[i];
    //                 }
    //                 avgError = avgError / numSamples;
    //                 console.log('\t\t - Min. Error: ' + minError + '%');
    //                 console.log('\t\t - Max. Error: ' + maxError + '%');
    //                 console.log('\t\t - Avg. Error: ' + avgError + '%');
    //                 done();
    //             }
    //         }
            
    //         x();
            
    //         var count = 0;
    //         for(i=0;i<1000000;i++){
    //             count++;
    //         }; 

    //         j++;
    //         if (j < numSamples) {
    //             timeRequested = getCurrentPhysicalTime();
    //             setTimeout(task, 100);
    //         }
    //     };
        
    //     j = 0;
    //     timeRequested = getCurrentPhysicalTime();
    //     setTimeout(task, 100)
    // });


    // it('Our own: sync, wait 0.1 seconds, 20 samples\n\n', function(done) {
    //     var i = 0;
    //     var j = 0;
    //     var numSamples = 20;
    //     var doneCount = 0;
    //     var errors:number[] = [];
    //     var minError = 1000000000;
    //     var maxError = 0;
    //     var avgError = 0;
        
    //     var timeRequested: TimeValue;

    //     var task = function(){
    //         var timeInvoked = getCurrentPhysicalTime();
    //         var waitTime:number = timeInvoked.subtract(timeRequested).toMilliseconds()*1000000;
    //         var x = function() {
    //             console.log('\t\t - Sample #' + (doneCount+1));
    //             console.log('\t\t\t - Expected wait: 0.1 seconds');
    //             console.log('\t\t\t - Actual wait: ' + waitTime/1000000000 + ' seconds');
    //             var error = (((waitTime - 100000000) / (100000000)) * 100);
    //             console.log('\t\t\t - Error: ' + error + '%');
    //             errors.push(error);
    //             var waitedLongEnough = (waitTime >= 100000000);
    //             expect(waitedLongEnough).toBeTruthy();
                
    //             doneCount++;
                
    //             if(doneCount == numSamples) {
    //                 for(i=0;i<numSamples;i++){
    //                     if(errors[i] < minError){
    //                         minError = errors[i];
    //                     }
                        
    //                     if (errors[i] > maxError){
    //                         maxError = errors[i];
    //                     }
                        
    //                     avgError += errors[i];
    //                 }
    //                 avgError = avgError / numSamples;
    //                 console.log('\t\t - Min. Error: ' + minError + '%');
    //                 console.log('\t\t - Max. Error: ' + maxError + '%');
    //                 console.log('\t\t - Avg. Error: ' + avgError + '%');
    //                 done();
    //             }
    //         }
            
    //         x();
            
    //         var count = 0;
    //         for(i=0;i<1000000;i++){
    //             count++;
    //         }; 

    //         j++;
    //         if (j < numSamples) {
    //             console.log("requesting next")
    //             timeRequested = getCurrentPhysicalTime();
    //             alarm.set(task, timeRequested.add(delay));
    //         }
    //     };
        
    //     // FIXME: space these
    //     j = 0;
    //     timeRequested = getCurrentPhysicalTime();
    //     alarm.set(task, timeRequested.add(delay));
    // });

    it('Our own: sync, wait 0.1 seconds, 20 samples\n\n', function(done) {
        var i = 0;
        var j = 0;
        var numSamples = 20;
        var doneCount = 0;
        var errors:number[] = [];
        var minError = 1000000000;
        var maxError = 0;
        var avgError = 0;
        
        var task = function(){
            var count = 0;
            for(i=0;i<1000000;i++){
                count++;
            }; 
        };
        
        var schedule = function(tv: TimeValue) {
            var tuple = tv.toTimeTuple()
            var waitTime = (tuple[0] * 1000000000) + tuple[1];
            console.log('\t\t - Sample #' + (doneCount+1));
            console.log('\t\t\t - Expected wait: 0.1 seconds');
            console.log('\t\t\t - Actual wait: ' + waitTime/1000000000 + ' seconds');
            var error = (((waitTime - 100000000) / (100000000)) * 100);
            console.log('\t\t\t - Error: ' + error + '%');
            errors.push(error);
            var waitedLongEnough = (waitTime >= 100000000);
            expect(waitedLongEnough).toBeTruthy();
            
            doneCount++;
            
            if(doneCount == numSamples) {
                for(i=0;i<numSamples;i++){
                    if(errors[i] < minError){
                        minError = errors[i];
                    }
                    
                    if (errors[i] > maxError){
                        maxError = errors[i];
                    }
                    
                    avgError += errors[i];
                }
                avgError = avgError / numSamples;
                console.log('\t\t - Min. Error: ' + minError + '%');
                console.log('\t\t - Max. Error: ' + maxError + '%');
                console.log('\t\t - Avg. Error: ' + avgError + '%');
                done();
            } else {
                alarm.set(task, delay, schedule);        
            }
        }

        alarm.set(task, delay, schedule);

     
    });

    /**
     * Test with immmidiateRef when delay = 0
     */

    it('Our own: sync, wait 0 seconds, 20 samples\n\n', function(done) {
        var i = 0;
        var j = 0;
        var numSamples = 20;
        var doneCount = 0;
        var errors:number[] = [];
        var minError = 1000000000;
        var maxError = 0;
        var avgError = 0;
        
        var hiResDif = process.hrtime(alarm.hiResStart);
        var delay0 = TimeValue.zero();


        var task = function(){
            var count = 0;
            for(i=0;i<1000000;i++){
                count++;
            }; 
        };
        
        var schedule = function(tv: TimeValue) {
            var tuple = tv.toTimeTuple()
            var waitTime = (tuple[0] * 1000000000) + tuple[1];
            console.log('\t\t - Sample #' + (doneCount+1));
            console.log('\t\t\t - Expected wait: 0 seconds');
            console.log('\t\t\t - Actual wait: ' + waitTime/1000000000 + ' seconds');
            var error = (((waitTime) / (100000000)) * 100);
            console.log('\t\t\t - Error: ' + error + '%');
            errors.push(error);
            var waitedLongEnough = (waitTime >= 0);
            expect(waitedLongEnough).toBeTruthy();
            
            doneCount++;
            
            if(doneCount == numSamples) {
                for(i=0;i<numSamples;i++){
                    if(errors[i] < minError){
                        minError = errors[i];
                    }
                    
                    if (errors[i] > maxError){
                        maxError = errors[i];
                    }
                    
                    avgError += errors[i];
                }
                avgError = avgError / numSamples;
                console.log('\t\t - Min. Error: ' + minError + '%');
                console.log('\t\t - Max. Error: ' + maxError + '%');
                console.log('\t\t - Avg. Error: ' + avgError + '%');
                done();
            } else {
                alarm.set(task, delay0, schedule);        
            }
        }

        alarm.set(task, delay0, schedule);
     
    });


    /**
     * Test with immmidiateRef when 0 < delay < 25ms
     */

     it('Our own: sync, wait 10 miliseconds, 20 samples\n\n', function(done) {
        var i = 0;
        var j = 0;
        var numSamples = 20;
        var doneCount = 0;
        var errors:number[] = [];
        var minError = 1000000000;
        var maxError = 0;
        var avgError = 0;
        
        var hiResDif = process.hrtime(alarm.hiResStart);
        var delay10Msec = TimeValue.msec(10);


        var task = function(){
            var count = 0;
            for(i=0;i<1000000;i++){
                count++;
            }; 
        };
        
        var schedule = function(tv: TimeValue) {
            var tuple = tv.toTimeTuple()
            var waitTime = (tuple[0] * 1000000000) + tuple[1];
            console.log('\t\t - Sample #' + (doneCount+1));
            console.log('\t\t\t - Expected wait: 0 seconds');
            console.log('\t\t\t - Actual wait: ' + waitTime/1000000000 + ' seconds');
            var error = (((waitTime) / (100000000)) * 100);
            console.log('\t\t\t - Error: ' + error + '%');
            errors.push(error);
            var waitedLongEnough = (waitTime >= 0);
            expect(waitedLongEnough).toBeTruthy();
            
            doneCount++;
            
            if(doneCount == numSamples) {
                for(i=0;i<numSamples;i++){
                    if(errors[i] < minError){
                        minError = errors[i];
                    }
                    
                    if (errors[i] > maxError){
                        maxError = errors[i];
                    }
                    
                    avgError += errors[i];
                }
                avgError = avgError / numSamples;
                console.log('\t\t - Min. Error: ' + minError + '%');
                console.log('\t\t - Max. Error: ' + maxError + '%');
                console.log('\t\t - Avg. Error: ' + avgError + '%');
                done();
            } else {
                alarm.set(task, delay10Msec, schedule);        
            }
        }

        alarm.set(task, delay10Msec, schedule);

        // Cover a case that alarm is already active and immediate reference exists. 
        alarm.set(task, delay10Msec, schedule);
     
    });

});