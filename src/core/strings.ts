/**
 * Remove indentation in the multi-line string.
 * @param template Multi-line string whose indentation should be removed.
 * @returns String without indentation.
 */
export function dontIndent(template: TemplateStringsArray): string {
  return ("" + template.toString()).replace(/(\n)\s+/g, "$1");
}
