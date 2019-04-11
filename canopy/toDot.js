var lf = require('./lf');
var fs = require('fs');

function asDOT(tree){
    console.log("digraph {");
    tree.elements.forEach(function(node) {
        printChildren('"ROOT"',node);
    });
    console.log("}");
}

function printChildren(parentName, node){
    var name = '"' + node.text.replace(/\s|!([a-zA-Z\200-\377]|[0-9]|_)/g, "") + '"';
    //console.log(name);
    if(name.length > 3){
    console.log(parentName + " -> " + name + ";");
    node.elements.forEach(function(n) { printChildren(name, n);});
    }
}

var src_file = process.argv[2];
if(src_file == null){
    return console.log("usage: " + process.argv[1] + " <file>");
}
fs.readFile(src_file, 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
	 var tree = lf.parse(data);
    asDOT(tree);

});

