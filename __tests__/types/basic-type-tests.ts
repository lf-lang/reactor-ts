/* file: __tests__/types/basic-type-tests.ts */
import { canConnect } from '../../src/core/reactor';
// $ExpectType string
type Test_01_number_is_not_string = number;
