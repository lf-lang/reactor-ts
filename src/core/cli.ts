import commandLineArgs from 'command-line-args';
import { UnitBasedTimeValue, TimeUnit, TimeValue} from './time';
import { LogLevel } from './util';

//---------------------------------------------------------------------//
// Command Line Arguments Helper Functions                             //
//---------------------------------------------------------------------//

/**
 * Function to convert a string into a LogLevel for command line argument parsing.
 * Returns null if the input is malformed.
 * @param logging the raw command line argument
 */
function loggingCLAType(logging: string): LogLevel | null {
    if (logging in LogLevel) {
        type LevelString = keyof typeof LogLevel;
        return LogLevel[logging as LevelString];
    }  else {
        return null;
    }
}

/**
 * Function to convert a string into a UnitBasedTimeValue for command line argument parsing
 * Returns null if the input is malformed.
 * @param logging the raw command line argument
 */
function unitBasedTimeValueCLAType(timeout: string): TimeValue | null {
    let duration:number;
    let units:TimeUnit;
    let wholeTimeoutPattern = /^[0-9]+\s+[a-z]+$/;
    if (wholeTimeoutPattern.test(timeout)) {
        let durationPattern = /^[0-9]+/;
        let unitsPattern = /[a-z]+$/;
        
        let stringDuration = durationPattern.exec(timeout);
        if (stringDuration !== null) {
            duration = parseInt(stringDuration[0]);
        } else {
            // Duration is not well formed.
            return null;
        }

        // Test if the units are a valid TimeUnits
        let stringUnits = unitsPattern.exec(timeout);
        if (stringUnits !== null && (stringUnits[0] in TimeUnit)){
            type TimeUnitString = keyof typeof TimeUnit;
            units = TimeUnit[stringUnits[0] as TimeUnitString]
        } else {
            // Units are not well formed.
            return null;
        }
        return new UnitBasedTimeValue(duration, units);
    } else {
        // Duration and units are not well formed.
        return null;
    }
}

/**
 * Function to convert a string into a boolean for command line argument parsing.
 * Returns null if the input is malformed.
 * Note that the command-line-arguments module's built in boolean type is
 * actually a flag that is either absent or true. https://github.com/75lb/command-line-args/wiki/Notation-rules
 * We need this custom boolean parsing because our command line arguments
 * are true, false, or absent.
 * @param logging the raw command line argument
 */
function booleanCLAType(bool: string): boolean | null {
    if (bool === "true" ) {
        return true;
    } else if (bool === "false") {
        return false;
    } else {
        return null;
    }
}

//---------------------------------------------------------------------//
// Exported CLI support                                                //
//---------------------------------------------------------------------//

/**
 * The type returned by the commandLineArguments function. This type must change
 * if the CommandLineOptionDefs changes.
 */
export type ProcessedCommandLineArgs = {fast: boolean| undefined,
    keepalive: boolean | undefined, timeout: UnitBasedTimeValue | null | undefined,
    logging: LogLevel | undefined}


/**
 * Configuration for command line arguments.
 * If this configuration changes, the ProcessedCommandLineArgs type must
 * change too.
 */
export const CommandLineOptionDefs = [
    { name: 'keepalive', alias: 'k', type: booleanCLAType },
    { name: 'fast', alias: 'f', type: booleanCLAType },
    { name: 'logging', alias: 'l', type: loggingCLAType },
    { name: 'timeout', alias: 'o', type: unitBasedTimeValueCLAType }
  ];
