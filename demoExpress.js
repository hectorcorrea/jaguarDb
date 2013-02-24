
var express = require('express');
var app = express();

var jaguarDb = require('./jaguarDb').jaguarDb;
var db = new jaguarDb();

db.connect('./data', function(err) {
  if(err) {
    console.log('Could not connect to database: ' + err);
    return;
  }
});


app.get('/:id', function(req, res){

  var id = req.params.id;
  db.findById(id, function(err, doc) {

    if(err) {
      console.log('error: ' + err);
      res.send('Error fetching document [' + id + ']. Error: ' + err);
      return;
    }

    if(doc === null) {
      console.log('not found: ' + id);
      res.send('Document id [' + id + '] was not found.');
      return;
    }

    var html = '<p>' + 
        '<b>id: ' + doc._id + '</b><br/>' +
        '<b>title:</b> ' + doc.title + '<br/>' +  
        '<b>content:</b> ' + doc.content + 
        '</p>';
    console.dir(doc);
    res.send(html);

  });
});


app.get('/', function(req, res){

  var query = {};
  var fields = {};
  db.find(query, fields, function(err, docs) {

    if(err) {
      res.send('Error reading documents: ' + err);
      return;
    }

    var i;
    var html = "";
    for(i = 0; i<docs.length; i++) {
      html += '<p>' + 
        '<b>id: ' + docs[i]._id + '</b><br/>' +
        '<b>title:</b> ' + docs[i].title + '<br/>' +  
        '<b>content:</b> ' + docs[i].content + 
        '</p>';
    }
    console.dir(docs);
    res.send(html);
  });
});

console.log("Server started http://localhost:3000");
app.listen(3000);





