var lf = require('./lf');

var tree = lf.parse('actor Source(period:int(1000)) { }');

tree.elements.forEach(function(node) {
  console.log(node.offset, node.text);
});