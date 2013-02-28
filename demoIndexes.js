var JaguarDb = require('./jaguarDb').JaguarDb;
var db = new JaguarDb();

db.connect('./data', function(err) {

  if(err) {
    console.log('Could not connect: ' + err);
    return;
  }

  console.log('Connected!');
  db.ensureIndexSync('title');
  // db.ensureIndexSync('insertedOn');

  var data = {title: 'hello', content: 'blah blah blah', insertedOn: new Date()};
  db.insert(data, function(err, insertedData) {

    if(err) {
      console.log('ERROR: ' + err);
      return;
    }

    console.log('Inserted');
    console.dir(insertedData);

    updatedData = insertedData;
    updatedData.title = 'hello world';
    updatedData.content = 'blah-blah-blah-blah';
    updatedData.insertedOn = new Date();
    db.update(updatedData, function(err) {
    
      if(err) {
        console.log('ERROR: ' + err);
        return;
      }

      console.log('Updated');
      console.dir(updatedData);
    });

  });

});




