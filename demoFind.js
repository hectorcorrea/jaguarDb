var jaguarDb = require('./jaguarDb').jaguarDb;
var db = new jaguarDb();

db.connect('./data', function(err) {

  if(err) {
    console.log('Could not connect: ' + err);
  }
  else {
    console.log('Connected!');
  }

  var query = {title: 'hello world'};
  var fields = {_id: 1, title: 1};
  db.find(query, fields, function(err, documents) {
    if(err) {
      console.log('ERROR: ' + err);
    }
    else {
      console.log('Found %s documents', documents.length);
      console.dir(documents);
    }
  });

});




