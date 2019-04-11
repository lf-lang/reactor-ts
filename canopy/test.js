var lf = require('./lf');
var fs = require('fs');
var src_folder = './lf-src/'; 

fs.readdir(src_folder, (err, files) => {
  files.forEach(src_file => {
   fs.readFile(src_folder + src_file, 'utf8', function (err,data) {
     if (err) {
       return console.log(err);
     }
       console.log("Parsing: " + src_file);
   	 var tree = lf.parse(data);
   });
  });
});

