var jaguarDb = require('./jaguarDb').jaguarDb;
var db = new jaguarDb();

db.connect('./data3', function(err) {

	if(err) {
		console.log('Could not connect: ' + err);
		return;
	}
	else {
		console.log('Connected!');
	}

	var data = {title: 'hello', content: 'blah blah blah'};
	db.insert(data, function(err, insertedData) {
		if(err) {
			console.log('ERROR: ' + err);
		}
		else {
			console.log('Inserted: %s', JSON.stringify(insertedData));
			updatedData = insertedData;
			updatedData.title = 'hello world';
			updatedData.content = 'blah-blah-blah-blah';
			updatedData.insertedOn = new Date();
			db.update(updatedData, function(err) {
				if(err) {
					console.log('ERROR: ' + err);
				}
				else {
					console.log('Updated: %s', JSON.stringify(updatedData));
				}
			});
		}
	});

});




