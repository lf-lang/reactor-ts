import { TimeValue, TimeUnit, Alarm } from '../src/core/internal';
import NanoTimer from 'nanotimer';

const timerA = new NanoTimer();
const alarm = new Alarm();
const delay = TimeValue.withUnits(100, TimeUnit.msec);

describe('Timer tests', () => {
  it('Nanotimer: sync, wait 0.1 seconds, 20 samples\n\n', function (done) {
    let i = 0;
    let j = 0;
    const numSamples = 20;
    let doneCount = 0;
    const errors: number[] = [];
    let minError = 1000000000;
    let maxError = 0;
    let avgError = 0;

    const task = function () {
      let count = 0;
      for (i = 0; i < 1000000; i++) {
        count++;
      }
    };

    for (j = 0; j < numSamples; j++) {
      timerA.setTimeout(task, [], '0.1s', function (data) {
        const waitTime = data.waitTime;
        console.log(`\t\t - Sample #${String((doneCount + 1))}`);
        console.log('\t\t\t - Expected wait: 0.1 seconds');
        console.log(`\t\t\t - Actual wait: ${String(waitTime / 1000000000)} seconds`);
        const error = (((waitTime - 100000000) / (100000000)) * 100);
        console.log(`\t\t\t - Error: ${String(error)}%`);
        errors.push(error);
        const waitedLongEnough = (waitTime >= 100000000);
        expect(waitedLongEnough).toBeTruthy();

        doneCount++;

        if (doneCount === numSamples) {
          for (i = 0; i < numSamples; i++) {
            if (errors[i] < minError) {
              minError = errors[i];
            }

            if (errors[i] > maxError) {
              maxError = errors[i];
            }

            avgError += errors[i];
          }
          avgError = avgError / numSamples;
          console.log(`\t\t - Min. Error: ${String(minError)}%`);
          console.log(`\t\t - Max. Error: ${String(maxError)}%`);
          console.log(`\t\t - Avg. Error: ${String(avgError)}%`);
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
  //             console.log(`\t\t - Sample #${String((doneCount+1))}`);
  //             console.log('\t\t\t - Expected wait: 0.1 seconds');
  //             console.log(`\t\t\t - Actual wait: ${String(waitTime/1000000000)} seconds`);
  //             var error = (((waitTime - 100000000) / (100000000)) * 100);
  //             console.log(`\t\t\t - Error: ${String(error)}%`);
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
  //                 console.log(`\t\t - Min. Error: ${String(minError)}%`);
  //                 console.log(`\t\t - Max. Error: ${String(maxError)}%`);
  //                 console.log(`\t\t - Avg. Error: ${String(avgError)}%`);
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
  //             console.log(`\t\t - Sample #${String((doneCount+1))}`);
  //             console.log('\t\t\t - Expected wait: 0.1 seconds');
  //             console.log(`\t\t\t - Actual wait: ${String(waitTime/1000000000)} seconds`);
  //             var error = (((waitTime - 100000000) / (100000000)) * 100);
  //             console.log(`\t\t\t - Error: ${String(error)}%`);
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
  //                 console.log(`\t\t - Min. Error: ${String(minError)}%`);
  //                 console.log(`\t\t - Max. Error: ${String(maxError)}%`);
  //                 console.log(`\t\t - Avg. Error: ${String(avgError)}%`);
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

  it('Our own: sync, wait 0.1 seconds, 20 samples\n\n', function (done) {
    let i = 0;
    const j = 0;
    const numSamples = 20;
    let doneCount = 0;
    const errors: number[] = [];
    let minError = 1000000000;
    let maxError = 0;
    let avgError = 0;

    const task = function () {
      let count = 0;
      for (i = 0; i < 1000000; i++) {
        count++;
      }
    };

    const schedule = function (tv: TimeValue) {
      const tuple = tv.toTimeTuple();
      const waitTime = (tuple[0] * 1000000000) + tuple[1];
      console.log(`\t\t - Sample #${String((doneCount + 1))}`);
      console.log('\t\t\t - Expected wait: 0.1 seconds');
      console.log(`\t\t\t - Actual wait: ${String(waitTime / 1000000000)} seconds`);
      const error = (((waitTime - 100000000) / (100000000)) * 100);
      console.log(`\t\t\t - Error: ${String(error)}%`);
      errors.push(error);
      const waitedLongEnough = (waitTime >= 100000000);
      expect(waitedLongEnough).toBeTruthy();

      doneCount++;

      if (doneCount === numSamples) {
        for (i = 0; i < numSamples; i++) {
          if (errors[i] < minError) {
            minError = errors[i];
          }

          if (errors[i] > maxError) {
            maxError = errors[i];
          }

          avgError += errors[i];
        }
        avgError = avgError / numSamples;
        console.log(`\t\t - Min. Error: ${String(minError)}%`);
        console.log(`\t\t - Max. Error: ${String(maxError)}%`);
        console.log(`\t\t - Avg. Error: ${String(avgError)}%`);
        done();
      } else {
        alarm.set(task, delay, schedule);
      }
    };

    alarm.set(task, delay, schedule);
  });

  /**
     * Test with immmidiateRef when delay = 0
     */

  it('Our own: sync, wait 0 seconds, 20 samples\n\n', function (done) {
    let i = 0;
    const j = 0;
    const numSamples = 20;
    let doneCount = 0;
    const errors: number[] = [];
    let minError = 1000000000;
    let maxError = 0;
    let avgError = 0;

    const hiResDif = process.hrtime(alarm.hiResStart);
    const delay0 = TimeValue.zero();

    const task = function () {
      let count = 0;
      for (i = 0; i < 1000000; i++) {
        count++;
      }
    };

    const schedule = function (tv: TimeValue) {
      const tuple = tv.toTimeTuple();
      const waitTime = (tuple[0] * 1000000000) + tuple[1];
      console.log(`\t\t - Sample #${String((doneCount + 1))}`);
      console.log('\t\t\t - Expected wait: 0 seconds');
      console.log(`\t\t\t - Actual wait: ${String(waitTime / 1000000000)} seconds`);
      const error = (((waitTime) / (100000000)) * 100);
      console.log(`\t\t\t - Error: ${String(error)}%`);
      errors.push(error);
      const waitedLongEnough = (waitTime >= 0);
      expect(waitedLongEnough).toBeTruthy();

      doneCount++;

      if (doneCount === numSamples) {
        for (i = 0; i < numSamples; i++) {
          if (errors[i] < minError) {
            minError = errors[i];
          }

          if (errors[i] > maxError) {
            maxError = errors[i];
          }

          avgError += errors[i];
        }
        avgError = avgError / numSamples;
        console.log(`\t\t - Min. Error: ${String(minError)}%`);
        console.log(`\t\t - Max. Error: ${String(maxError)}%`);
        console.log(`\t\t - Avg. Error: ${String(avgError)}%`);
        done();
      } else {
        alarm.set(task, delay0, schedule);
      }
    };

    alarm.set(task, delay0, schedule);
  });

  /**
     * Test with immmidiateRef when 0 < delay < 25ms
     */

  it('Our own: sync, wait 10 miliseconds, 20 samples\n\n', function (done) {
    let i = 0;
    const j = 0;
    const numSamples = 20;
    let doneCount = 0;
    const errors: number[] = [];
    let minError = 1000000000;
    let maxError = 0;
    let avgError = 0;

    const hiResDif = process.hrtime(alarm.hiResStart);
    const delay10Msec = TimeValue.msec(10);

    const task = function () {
      let count = 0;
      for (i = 0; i < 1000000; i++) {
        count++;
      }
    };

    const schedule = function (tv: TimeValue) {
      const tuple = tv.toTimeTuple();
      const waitTime = (tuple[0] * 1000000000) + tuple[1];
      console.log(`\t\t - Sample #${String((doneCount + 1))}`);
      console.log('\t\t\t - Expected wait: 0 seconds');
      console.log(`\t\t\t - Actual wait: ${String(waitTime / 1000000000)} seconds`);
      const error = (((waitTime) / (100000000)) * 100);
      console.log(`\t\t\t - Error: ${String(error)}%`);
      errors.push(error);
      const waitedLongEnough = (waitTime >= 0);
      expect(waitedLongEnough).toBeTruthy();

      doneCount++;

      if (doneCount === numSamples) {
        for (i = 0; i < numSamples; i++) {
          if (errors[i] < minError) {
            minError = errors[i];
          }

          if (errors[i] > maxError) {
            maxError = errors[i];
          }

          avgError += errors[i];
        }
        avgError = avgError / numSamples;
        console.log(`\t\t - Min. Error: ${String(minError)}%`);
        console.log(`\t\t - Max. Error: ${String(maxError)}%`);
        console.log(`\t\t - Avg. Error: ${String(avgError)}%`);
        done();
      } else {
        alarm.set(task, delay10Msec, schedule);
      }
    };

    alarm.set(task, delay10Msec, schedule);

    // Cover a case that alarm is already active and immediate reference exists.
    alarm.set(task, delay10Msec, schedule);
  });
});
