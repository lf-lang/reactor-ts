
/**
 * 
 */
export class StringUtil {
    public static dontIndent(template: TemplateStringsArray){
        return ('' + template.toString()).replace(/(\n)\s+/g, '$1');
    }
}
