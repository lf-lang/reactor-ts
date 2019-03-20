var lf = require('./lf');
var fs = require('fs');

var src_file = './lf-src/Delay.lf';
fs.readFile(src_file, 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
	 var tree = lf.parse(data);

	 tree.elements.forEach(function(node) {
		  console.log(node.offset, node.text);
	 });
});
