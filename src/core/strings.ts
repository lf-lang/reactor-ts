/**
 * Utility class for handling strings, for example, to format diagraph
 * string representation.
 */
// TODO: (axmmisaka)
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class StringUtil {
  /**
   * Remove indentation in the multi-line string.
   * @param template Multi-line string whose indentation should be removed.
   * @returns String without indentation.
   */
  public static dontIndent (template: TemplateStringsArray): string {
    return (`${String(template.toString()).replace(/(\n)\s+/g, '$1')}`);
  }

  public static toRegex (template: TemplateStringsArray, ...keys: unknown[]) {
    return function (...values: unknown[]) {
      const dict = values[values.length - 1] ?? {};
      const result = [template[0]];
      keys.forEach(function (key, i) {
        // TODO (axmmisaka): figure out what is happening here
        const value = Number.isInteger(key) ? values[key] : dict[key];
        result.push(value, template[i + 1]);
      });
      return result.join('').replace(/(\n)\s+/g, '$1');
    };
  }
}
