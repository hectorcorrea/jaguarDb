var path = require('path');
var fs = require('fs');
var util = require('./util');

var JaguarDb = function() {
  this.dbPath = null;
  this.indexFile = null;
  this.indexData = { nextId: 1, indexes: [], documents: [] };
}


// ----------------------------------
// Connect to a database
// ----------------------------------
JaguarDb.prototype.connect = function(_dbPath, cb) {
  util.log('Connecting to: ' + _dbPath);
  this.dbPath = _dbPath;
  this.indexFile = path.join(this.dbPath, 'index.json');
  var _this = this;
  
  // Check if the path exists and it's indeed a directory.
  fs.stat(_dbPath, function(err, stat) {
    if (err) {
      if(err.code == 'ENOENT') {
        util.log('Creating directory ' + _this.dbPath)
        fs.mkdirSync(_this.dbPath);  // FYI: blocking call
      }
      else {
        cb(err);
        return;
      }     
    }
    else {
      if(!stat.isDirectory()) {
        cb(_this.dbPath + " exists but it's not a folder!");
        return;
      }
    }

    _this._loadIndexData(_this, cb);
  });
}


JaguarDb.prototype._loadIndexData = function(_this, cb) {
  fs.exists(_this.indexFile, function(exists) {
    if (exists) {

      fs.readFile(_this.indexFile, function(err, data) {
        if(err) {
          util.log('Index file already exists, but could not be read.');
          cb(err);
        }
        else {
          util.log('Index file read');
          _this.indexData = JSON.parse(data);
          cb(null);
        }
      });

    }
    else {

      // create index file
      util.log('Creating index file: ' + _this.indexFile);
      fs.writeFile(_this.indexFile, JSON.stringify(_this.indexData), function(err) {
        if (err) {
          util.log('ERROR', 'Could not create index file. Error: ' + err);
          cb(err);
        }
        else {
          util.log('Index file created');
          cb(null);
        }
      });

    }
  });
}


// ----------------------------------
// Insert a new document in the database
// ----------------------------------
JaguarDb.prototype.insert = function(data, cb) {
  util.log('About to insert');
  data._id = this.indexData.nextId;
  this.indexData.nextId++;

  // update index 
  var indexes = this.indexData.indexes;
  var indexDoc = { _id: data._id};
	for(var i=0; i<indexes.length; i++) {
		var indexField = indexes[i];
		indexDoc[indexField] = data[indexField];
	}
  this.indexData.documents.push(indexDoc);

  var dbPath = this.dbPath;
  fs.writeFile(this.indexFile, JSON.stringify(this.indexData), function(err) {
    if (err) {
      util.log('ERROR', 'Could not update index file. Error: ' + err);
      cb(err);
    }
    else {
      util.log('Index file updated');
      // save full document
      var documentFile = path.join(dbPath, data._id.toString() + '.json');
      fs.writeFile(documentFile, JSON.stringify(data), function(err) {
        if (err) {
          util.log('ERROR', 'Could not insert document. Error: ' + err);
          cb(err);
        }
        else {
          util.log('Document inserted: ' + documentFile);
          cb(null, data);
        }
      });
    }
  });
}


// ----------------------------------
// Update an existing document in the database
// ----------------------------------
JaguarDb.prototype.update = function(data, cb) {
	var i;

  util.log('About to update');
  if(data._id === undefined) {
    cb('No _id was found on document');
    return;
  }

  // find the document to update on the index
  var indexDoc = null;
	var documents = this.indexData.documents;
	for(i=0; i<documents.length; i++) {
		if(documents[i]._id === data._id) {
			indexDoc = documents[i];
			break;
		}
	}

	if(indexDoc === null) {
		cb("The _id to update [" + data._id + "] was not found.");
		return;
	}

	// update the document in the index
	var indexes = this.indexData.indexes;
	for(i=0; i<indexes.length; i++) {
		var indexField = indexes[i];
		indexDoc[indexField] = data[indexField];
	}

  var documentFile = path.join(this.dbPath, data._id.toString() + '.json');
  fs.writeFile(this.indexFile, JSON.stringify(this.indexData), function(err) {
    if (err) {
      util.log('ERROR', 'Could not update index file. Error: ' + err);
      cb(err);
    }
    else {
      util.log('Index file updated');
      // save full document
		  fs.writeFile(documentFile, JSON.stringify(data), function(err) {
		    if (err) {
		      util.log('ERROR', 'Could not update document. Error: ' + err);
		      cb(err);
		    }
		    else {
		      util.log('Document updated: '+ documentFile);
		      cb(null, data);
		    }
		  });
		}
	});

}


// ----------------------------------
// Find documents in the database
// ----------------------------------
JaguarDb.prototype.find = function(query, fields, cb) {
  query = query || {};    // default to select all documents
  fields = fields || {};  // default to select all fields

  var isFindAll = util.isEmptyObject(query);
  if(isFindAll) {
    util.log('Find All');
    this._getAll(fields, cb); 
    return;
  }

  util.log('Find Some');

  this._getSome(query, fields, cb);
}


JaguarDb.prototype.findById = function(id, cb) {
	// Go straight after the file with the document
	// information (i.e. don't even bother looking 
	// at the index.)
  var file = path.join(this.dbPath, id.toString() + '.json');   
  fs.readFile(file, function(err, text) {
    if(err) {
      if (err.code === 'ENOENT'){
        // document not found
        cb(null, null); 
      }
      else {    
        // a true other error     
        cb(err); 
      }
    }

    else {
      var document = JSON.parse(text);
      cb(null, document);
    }
  });
}


JaguarDb.prototype.findByIdSync = function(id) {
	// Go straight after the file with the document
	// information (i.e. don't even bother looking 
	// at the index.)
  var file = path.join(this.dbPath, id.toString() + '.json');   
  if(!fs.existsSync(file)) {
  	return null;
  }
  var text = fs.readFileSync(file);
 	var document = JSON.parse(text);
 	return document;
}


// Internal method.
// Fetches all documents in the database.
//
// Notes: 
//    This method blocks!!!
//    Eventually I want to make it async.
//    Also, if I were to implement indexes then we 
//    shouldn't need to read the entire document if the
//    information exists on the index file (this is a very
//    long term goal.) Most likely YANGI.
JaguarDb.prototype._getAll = function(fields, cb) {
  var i;
  var documents = this.indexData.documents;
  var foundDocs = [];
  var _id, file, text, document;

  for(i=0; i<documents.length; i++) {
    _id = documents[i]._id;
    file = path.join(this.dbPath, _id.toString() + '.json');
    text = fs.readFileSync(file); // Blocking call
    document = JSON.parse(text);
    foundDocs.push(document);
  }
  util.projectFields(foundDocs, fields, cb);
}





// Internal method.
// Fetches a subset of the documents in the database based on a given query.
// Only exact matches on queries are supported (i.e. field = 'value')
// Other types of queries are NOT supported yet. (i.e. field != value or field >= 'value')
JaguarDb.prototype._getSome = function(query, fields, cb) {
  var _id, file, text, document;
  var filterFields = Object.getOwnPropertyNames(query);
  var documents = this.indexData.documents;
  var foundDocs = [];


  var isCoveredQuery = util.isCoveredQuery(this.indexData.indexes, fields);
  util.log("Covered query: " + (isCoveredQuery ? "yes" : "no"));

  util.log('start reading');
  for(var i=0; i<documents.length; i++) {
    _id = documents[i]._id;
    file = path.join(this.dbPath, _id.toString() + '.json');
    text = fs.readFileSync(file); // Blocking call
    document = JSON.parse(text);
    if(util.isMatch(document, filterFields, query)) {
      foundDocs.push(document);
    }
  }
  util.log('done reading');

  util.projectFields(foundDocs, fields, cb);
}





// ----------------------------------
// Create an index
// ----------------------------------
JaguarDb.prototype.ensureIndexSync = function(field, force) {
	
	if(this.indexData.indexes.indexOf(field) == -1) {
		this.indexData.indexes.push(field);
	}
	else {
		// index is already been created 
		if(force !== true) {
			return;
		}
	}

	util.log("Populating index [" + field + "]...");	
	for(i=0; i<this.indexData.documents.length; i++) {
		var indexDoc = this.indexData.documents[i];
		var doc = this.findByIdSync(indexDoc._id);
		indexDoc[field] = doc[field];
	}

	util.log("Saving index [" + field + "]...");
  fs.writeFileSync(this.indexFile, JSON.stringify(this.indexData));
  util.log("Index created.")
}


exports.JaguarDb = JaguarDb;