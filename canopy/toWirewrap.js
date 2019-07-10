var lf = require('./lf');
var fs = require('fs');

var actions = {
    make_lf: function(input, start, end, elements) {
        var map = {};
        map['type'] = 'root';
        map['input'] = input;
        map['elements'] = elements;
        return map;
    },

    make_id : function(input,start,end,elements){
        return {'type' : 'id', 'value' : elements[0].text };
    },
    make_reactor : function(input,start,end,elements){
        return {'type' : 'reactor', 'header' : elements[2], 'body' : elements[4] };
    },
    make_composite : function(input,start,end,elements){
        return {'type' : 'composite', 'header' : elements[2], 'body' : elements[4] };
    },
    embed_statement : function(input,start,end,elements){
        return {'type' : 'embedded', 'value' : elements[1].text};
    },
    make_port : function(input,start,end,elements){
        return {'type' : 'port', 'src' : elements[0], 'dst' : elements[4] };
    },
    make_constructor : function(input,start,end,elements){
        return {'type' : 'constructor', 'value' : elements[2]};
    },
    make_clock : function(input,start,end,elements){
        return {'type' : 'clock', 'header' : elements[2]};
    },
    make_header : function(input,start,end,elements){
        /*
        console.log("elements header:");
        console.log(input.substring(start,end));
        print(elements);
        console.log("----------------");
        */
        if(elements.length <= 2){
            return {'type' : 'header', 'id' : elements[0], 'args' : []};
        }
        else{
            return {'type' : 'header', 'id' : elements[0], 'args' : elements[2]};
        }
    },
    make_input : function(input,start,end,elements){
        return {'type' : 'input', 'parameters' : elements[2]};
    },
    make_output : function(input,start,end,elements){
        return {'type' : 'output', 'parameters' : elements[2]};
    },
    make_trivial: function(input,start,end,elements){
        return elements[0];
    },
    make_decl_param : function(input,start,end,elements){

        /*
        console.log(input.substring(start, end) + " - decl param:");
        console.log(elements[1]['elements'].length);
        print(elements[1]['elements'][4]);
        console.log("---------");
        */
        
        var type_obj = elements[1]['elements'][1];
        type_value = undefined;
        if(type_obj != undefined){
            type_value = type_obj['value'];
        }
        var default_obj = elements[1]['elements'][4];
        default_value = undefined;
        if(default_obj != undefined){
            default_value = default_obj['value'];
        }
        return {'type' : 'decl_param', 'id' : elements[0], 'type_value' : type_value, 'default' : default_value};
    },
    make_decl_args : function(input,start,end,elements){
        var lst = [];
        args = elements;
        if(args != undefined){
            for(var i = 0; i < Math.floor(args.length/4)+1;i++){
                lst.push(args[i*4+1]);
            }
        }
        else lst = args;
        /*
        console.log(input.substring(start,end)+ " - args:");
        console.log(elements.length);
        print(elements);
        console.log("*********");
        print(lst);
        */
        return {'type' : 'args', 'value' : lst};
    },
    make_reaction : function(input,start,end,elements){
        var res = {'type' : 'reaction', 'trigger' : elements[1]};
        if (elements.length > 4){
            res['output'] = elements[5];
            res['code'] = elements[7];
        }
        else {
            res['code'] = elements[3];
        }
        return res;
    },
    make_new : function(input,start,end,elements){
        return {'type' : 'new', 'value' : elements[3]};
    },
    make_call : function(input,start,end,elements){
        return {'type' : 'call', 'id' : elements[0], 'args' : elements[1]};
    },

    make_number : function(input,start,end,elements){
        return {'type' : 'number', 'value' : parseFloat(input.substring(start, end))};
    },
    make_string : function(input,start,end,elements){
        return {'type' : 'string', 'value' : elements[0].text};
    },
    make_assigment : function(input,start,end,elements){
        return {'type' : 'assigment', 'id' : elements[0], 'expression' : elements[4] };
    }
};

function print(object){
    console.log(JSON.stringify(object,null,' '));
}

function asWirewrap(tree){
    console.log("// @flow");
    console.log("'use strict';");
    console.log("import {Component, ReActor, InPort, OutPort, Clock, Reaction, App} from './reactor';");
    console.log("type int = number;");
    tree.elements.forEach(function(node) {
        //console.log(JSON.stringify(tree,null,' '));
        _printChildren(node);
    });
    console.log("}");
}

function _printChildren(elem){
    //console.log(elem);
    /*
    if(elem['type'] == undefined){
        console.error("Not implemented parse tree for:");
        console.error(JSON.stringify(elem,null,' '));
        throw new Error();
    }*/
    if (elem == undefined){
        return "";
    }
    switch(elem['type']){
    case 'reactor':
        console.log("class " + elem['header']['id']['value'] + " extends Component implements ReActor{");
        // print(elem['header']); 
        elem['header']['args'].forEach(_printChildren);
        _printChildren(elem['body']);
        console.log("}");
        break;
    case 'composite':
        var id = elem['header']['id']['value'];
        console.log("class My" + id + " extends " + id + " {");
        process.stdout.write("constructor(");
        _printChildren(elem['header']['args']);
        console.log("){");

        _printChildren(elem['body']);
        console.log("}");
        console.log("}");
        break;
    case 'call':
        process.stdout.write(elem['value']['id']['value'] + "(")
        elem['value']['args'].forEach(_printChildren);
        console.log(");");
        break;
    case 'assignment':
        process.stdout.write("var " + elem['id']['value'] + " = new "); //this new here should probably not be always there?
        _printChildren(elem['expression']);
        console.log(";");
        break;
    case 'port':
        console.log(elem['dst']['value'] + ".output.connect(" + elem['src']['value'] + ".input);"); 
        break;
    case 'input':
        console.log("input: InPort<" + elem['parameters']['type_value'] + ">;");
        break;
    case 'output':
        console.log("output: OutPort<" + elem['parameters']['type_value'] + ">;");
        break;
    case 'clock':
        console.log("clock: Clock  = new Clock(this." + elem['header']['id']['value'] + ");");
        break;
    case 'embedded':
        console.log(elem['value']);
                    break;
        
                    
    default:
        if (elem['elements'] == undefined){
            return
        }
        else{
            elem['elements'].forEach(_printChildren);
        }
    }
}


var src_file = process.argv[2];
if(src_file == null){
    console.log("usage: " + process.argv[1] + " <file>");
}
fs.readFile(src_file, 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
	 var tree = lf.parse(data, {actions: actions});
    asWirewrap(tree);

});

