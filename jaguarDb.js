var path = require('path');
var fs = require('fs');

exports.jaguarDb = function jaguarDb() {


	this.dbPath = null;
	this.indexFile = null;
	this.indexData = { nextId: 1, indexes: [], documents: [] };
	this.logging = true;


	// Use our own custom internal logger so that we don't depend 
	// on any other library. We'll probably get rid of this once 
	// this project reaches certain maturity. A better approach
	// would be to raise events as things happen rather than 
	// calling the logger but that's for another day.
	var _log = function(type, message) {
		var logging = true;
		if(logging) {
			if (message === undefined) {
				// default to INFO. The message comes in the first 
				// parameter (awkward, but functional).
				console.log('INFO: %s', type);
			}
			else {
				console.log('%s: %s', type, message)
			}
		}
	}

	// stolen from http://stackoverflow.com/a/2673229/446681
	var _isEmptyObject = function (obj) {
	  return Object.getOwnPropertyNames(obj).length === 0;
	}

	// ----------------------------------
	// Connect to a database
	// ----------------------------------
	this.connect = function(_dbPath, cb) {
		_log('Connecting to: ' + _dbPath);
		this.dbPath = _dbPath;
		this.indexFile = path.join(this.dbPath, 'index.json');
		var _this = this;
		
		// Check if the path exists and it's indeed a directory.
		fs.stat(_dbPath, function(err, stat) {
			if (err) {
				if(err.code == 'ENOENT') {
					_log('Creating directory ' + _this.dbPath)
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

	this._loadIndexData = function(_this, cb) {
		fs.exists(_this.indexFile, function(exists) {
			if (exists) {

				fs.readFile(_this.indexFile, function(err, data) {
					if(err) {
						_log('Index file already exists, but could not be read.');
						cb(err);
					}
					else {
						_log('Index file read');
						_this.indexData = JSON.parse(data);
						cb(null);
					}
				});

			}
			else {

				// create index file
				_log('Creating index file: ' + _this.indexFile);
				fs.writeFile(_this.indexFile, JSON.stringify(_this.indexData), function(err) {
					if (err) {
						_log('ERROR', 'Could not create index file. Error: ' + err);
						cb(err);
					}
					else {
						_log('Index file created');
						cb(null);
					}
				});

			}
		});
	}

	// ----------------------------------
	// Insert a new document in the database
	// ----------------------------------
	this.insert = function(data, cb) {
		console.log('about to insert');
		data._id = this.indexData.nextId;
		this.indexData.nextId++;

		// update index 
		var indexDoc = {};
		indexDoc._id = data._id;
		// TODO: add indexes fields, e.g. indexDoc.ix1 = data.ix1;
		this.indexData.documents.push(indexDoc);

		var dbPath = this.dbPath;
		fs.writeFile(this.indexFile, JSON.stringify(this.indexData), function(err) {
			if (err) {
				_log('ERROR', 'Could not update index file. Error: ' + err);
				cb(err);
			}
			else {
				_log('Index file updated');
				// save full document
				var documentFile = path.join(dbPath, data._id.toString() + '.json');
				fs.writeFile(documentFile, JSON.stringify(data), function(err) {
					if (err) {
						_log('ERROR', 'Could not insert document. Error: ' + err);
						cb(err);
					}
					else {
						_log('Document inserted: ' + documentFile);
						cb(null, data);
					}
				});
			}
		});
	}

	// ----------------------------------
	// Update an existing document in the database
	// ----------------------------------
	this.update = function(data, cb) {
		console.log('about to update');
		if(data._id === undefined) {
			cb('No _id was found on document');
			return;
		}

		// TODO: the index file will need to be updated when we implement indexes

		// save full document
		var documentFile = path.join(this.dbPath, data._id.toString() + '.json');
		fs.writeFile(documentFile, JSON.stringify(data), function(err) {
			if (err) {
				_log('ERROR', 'Could not update document. Error: ' + err);
				cb(err);
			}
			else {
				_log('Document updated: '+ documentFile);
				cb(null, data);
			}
		});
	}

	// ----------------------------------
	// Find documents in the database
	// ----------------------------------
	this.find = function(query, fields, cb) {

		query = query || {};		// default to select all documents
		fields = fields || {};	// default to select all fields

		var isFindAll = _isEmptyObject(query);
		if(isFindAll) {
			_log('Find All');
			this._getAll(this._filterFields, fields, cb); 
			return;
		}

		_log('Find Some');
		this._getSome(query, this._filterFields, fields, cb);
	}

	this.findById = function(id, cb) {
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



	// Internal method.
	// Given a list of documents creates a new list of documents but
	// only with the fields indicated in filteredFields.
	this._filterFields = function(documents, filterFields, cb) {
		_log('filter fields called');
		var isAllFields = _isEmptyObject(filterFields);
		if(isAllFields) {
			// No filter required, we are done.
			cb(null, documents);
			return;
		}

		var fields = Object.getOwnPropertyNames(filterFields);
		if(fields.indexOf('_id') === -1) {
			// Make sure the _id field is always returned. 
			fields.push('_id');
		}

		var i, j;
		var filteredDocs = [];
		for(i=0; i<documents.length; i++) {

		  var fullDoc = documents[i];
		  var doc = {};
		  for(j=0; j<fields.length; j++) {
		    var field = fields[j];
		    if(fullDoc.hasOwnProperty(field)) {
		      doc[field] = fullDoc[field];
		    }
		  }

		  filteredDocs.push(doc);
		}
		cb(null, filteredDocs);
	}

	// Internal method.
	// Fetches all documents in the database.
	//
	// Notes: 
	// 		This method blocks!!!
	// 		Eventually I want to make it async.
	// 		Also, if I were to implement indexes then we 
	//		shouldn't need to read the entire document if the
	//		information exists on the index file (this is a very
	//		long term goal.) Most likely YANGI.
	this._getAll = function(filter, fields, cb) {
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
		filter(foundDocs, fields, cb);
	}

	// Internal method.
	// Fetches a subset of the documents in the database based on a given query.
	// Only exact matches on queries are supported (i.e. field = 'value')
	// Other types of queries are NOT supported yet. (i.e. field != value or field >= 'value')
	this._getSome = function(query, filter, fields, cb) {
		var _id, file, text, document;
		var filterFields = Object.getOwnPropertyNames(query);
		var documents = this.indexData.documents;
		var foundDocs = [];

		_log('start reading');
		for(var i=0; i<documents.length; i++) {
			_id = documents[i]._id;
			file = path.join(this.dbPath, _id.toString() + '.json');
			text = fs.readFileSync(file); // Blocking call
			// _log('  Read ' + file);
			// _log('  ' + text);
			document = JSON.parse(text);
			// console.dir(document);
			if(this.isMatch(document, filterFields, query)) {
				foundDocs.push(document);
			}
		}
		_log('done reading');
		filter(foundDocs, fields, cb);
	}

	this.isMatch = function(document, queryFields, queryValues) {
	  for(var i=0; i<queryFields.length; i++) {
	    var field = queryFields[i];
	    if(document.hasOwnProperty(field)) {
	      if (document[field] !== queryValues[field]) {
	        // Field present but values does not match.
	        return false;
	      }
	    }
	    else {
	      // Field not present
	      return false;
	    }
	  }
	  return true;
	} 

};

