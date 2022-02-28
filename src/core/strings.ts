
/**
 * 
 */
export class StringUtil {
    public static dontIndent(template: TemplateStringsArray){
        return ('' + template.toString()).replace(/(\n)\s+/g, '$1');
    }

    public static toRegex(template: TemplateStringsArray, ...keys:any[]) {
        return (function(...values:any[]) {
            let dict = values[values.length - 1] || {};
            let result = [template[0]];
            keys.forEach(function(key, i) {
              let value = Number.isInteger(key) ? values[key] : dict[key];
              result.push(value, template[i + 1]);
            });
            return result.join('').replace(/(\n)\s+/g, '$1'); 
          });
    }

    
}
