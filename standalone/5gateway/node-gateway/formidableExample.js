var formidable = require('formidable'),
    http = require('http'),
    amqp = require('amqp'),
    fs = require('fs'),
    url = require("url"),
    libpath = require('path'),
    mime = require('mime'),
    util = require('util'),
	redis = require("redis");

var redisClient = redis.createClient();

redisClient.on("error", function (err) {
    console.log("Error " + err);
});
redisClient.on("ready", function () {
    console.log("Redis Client Ready");
});

var storagePath = "assets";
var tmpPath = "tmp";
var port = 2000;

// Make sure storage path and tmp path exist.
if (!libpath.existsSync(storagePath)) {
	fs.mkdirSync(storagePath, '777');
}
if (!libpath.existsSync(tmpPath)) {
	fs.mkdirSync(tmpPath, '777');
}

function guidGenerator() {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

var assetAgentGatewayId = guidGenerator();
console.log('Started Asset Agent Gateway ' + assetAgentGatewayId);

/* Setup connection to RabbitMQ */
var clientQ = {};
var rabbitCon = amqp.createConnection({host: 'localhost'});
var exchange = {};
rabbitCon.addListener('ready', function(){
    // Create our exchange
    console.log('connection ready');
    exchange = rabbitCon.exchange('', {}, function(){
        console.log('Rabbit exchange open');
        //        // TODO: This should send a message that it is up and running to someone who cares.

    });
    // Now connect to the exchange.
    console.log('Connecting as client to ' + assetAgentGatewayId);
    clientQ = rabbitCon.queue(assetAgentGatewayId, function(q){
    	q.subscribe({ack:true}, function(message) {
    		try {
    	        console.log("Asset Auth Gateway received Message");
                util.puts(util.inspect(message));
    	        
    	        if(message.cn && (message.cn === "com.percero.agents.auth.vo.ValidateUserByTokenResponse" || message.cn === "com.percero.agents.sync.vo.GetAccessorResponse" || message.cn === "com.percero.agents.sync.vo.PutResponse")) {
    		        console.log("Received Valid Response");
    		        if (message.correspondingMessageId) {
    		        	if (pendingAuthRequests[message.correspondingMessageId]) {
    		        		// Clear any pending fault timeout.
    		        		if (pendingAuthRequests[message.correspondingMessageId].faultTimeout) {
    		        			try {
    		        				clearTimeout(pendingAuthRequests[message.correspondingMessageId].faultTimeout);
    		        			} catch(e) {}
    		        		}
    		        		if (pendingAuthRequests[message.correspondingMessageId].resultCallback) {
    		        			pendingAuthRequests[message.correspondingMessageId].resultCallback.apply(null, [message]);
    		        		}

    		        		delete pendingAuthRequests[message.correspondingMessageId];
    		        	}
    		        }
                }
    	        q.shift();
    		} catch (e) {
    			console.log('Encountered Unhandled Error: ' + e);
    		}
        });
        //        .addCallback(function(){util.puts(util.inspect(this))});
    });
});

var pendingAuthRequests = {};

function authenticateUserByToken(regAppKey, userId, theToken, clientId, resultCallback, faultCallback, token) {
	var message = setupValidateUserByTokenRequest(regAppKey, userId, theToken, clientId);
	storeMessageCallback(message.messageId, resultCallback, faultCallback, token);
	console.log('Sending ValidateUserByTokenRequest');
	console.log(userId + ', ' + theToken + ', ' + clientId);
	exchange.publish('validateUserByToken', message, {replyTo: assetAgentGatewayId});
};

function authorizeUserForClassObject(userId, clientId, theClassName, theClassId, pleaseReturnObject, resultCallback, faultCallback, token) {
	var message = setupGetAccessorRequest(userId, clientId, theClassName, theClassId, pleaseReturnObject);
	storeMessageCallback(message.messageId, resultCallback, faultCallback, token);
	console.log('Sending GetAccessorRequest');
	exchange.publish('getAccessor', message, {replyTo: assetAgentGatewayId});
};

function putObject(userId, clientId, theObject, resultCallback, faultCallback, token) {
	var message = setupPutRequest(userId, clientId, theObject);
	storeMessageCallback(message.messageId, resultCallback, faultCallback, token);
	exchange.publish('putObject', message, {replyTo: assetAgentGatewayId});
};

function storeMessageCallback(messageId, resultCallback, faultCallback, token) {
	if (resultCallback || faultCallback) {
		if (faultCallback) {
			// Set timeout for the response.
			var faultTimeout = setTimeout(function() {
				if (pendingAuthRequests && pendingAuthRequests[messageId]) {
					delete pendingAuthRequests[messageId];
					faultCallback.apply(null, [{timedOut: true}]);
				}
			}, 10000);

			pendingAuthRequests[messageId] = {
					resultCallback: resultCallback,
					faultCallback: faultCallback,
					token: token,
					faultTimeout: faultTimeout
			};
		}
		else {
			pendingAuthRequests[messageId] = {
					resultCallback: resultCallback,
					token: token
			};
		}
	}
}

//AuthAgent Requests/Responses.
function setupAuthRequest() {
	var authRequest = {};
	authRequest.cn = "com.percero.agents.auth.vo.AuthRequest";
	authRequest.userId = "";
	authRequest.token = "";
	authRequest.clientType = "N";
	authRequest.clientId = "";
	authRequest.messageId = guidGenerator();
	return authRequest;
}

function setupValidateUserByTokenRequest(regAppKey, userId, aToken, clientId) {
	var authValidateUserByTokenRequest = setupAuthRequest();
	authValidateUserByTokenRequest.cn = "com.percero.agents.auth.vo.ValidateUserByTokenRequest";
	authValidateUserByTokenRequest.regAppKey = regAppKey;
	authValidateUserByTokenRequest.userId = userId;
	authValidateUserByTokenRequest.token = aToken;
	authValidateUserByTokenRequest.clientId = clientId;
	return authValidateUserByTokenRequest;
}

//SyncAgent Requests/Responses.
function setupSyncRequest(userId, clientId) {
	var request = {};
	request.cn = "com.percero.agents.sync.vo.SyncRequest";
	request.userName = userId;
	request.token = "";
	request.clientType = "";
	request.clientId = clientId;
	request.responseChannel = "";
	request.messageId = guidGenerator();
	return request;
}

function setupGetAccessorRequest(userId, clientId, theClassName, theClassId, pleaseReturnObject) {
	var request = setupSyncRequest(userId, clientId);
	request.cn = "com.percero.agents.sync.vo.GetAccessorRequest";
	request.theClassName = theClassName;
	request.theClassId = theClassId;
	request.returnObject = pleaseReturnObject;
	return request;
}

function setupPutRequest(userId, clientId, theObject) {
	var request = setupSyncRequest(userId, clientId);
	request.cn = "com.percero.agents.sync.vo.PutRequest";
	request.theObject = theObject;
	return request;
}




http.createServer(function(req, res) {
	
	// Handle download request.
	if (req.url.indexOf('/download') >= 0 && req.method.toLowerCase() == 'get') {
		var uriObject = url.parse(req.url, true);

		// Strip "/download" off of uri.
		var uri = uriObject.pathname;
		var index = uri.indexOf('/download');
		uri = uri.substring(index + '/download'.length, uri.length);
		console.log('Attempting to get ' + uri);

		if (!uriObject.query || !uriObject.query.userId || !uriObject.query.token || !uriObject.query.clientId || !uriObject.query.cn || !uriObject.query.id) {
			// Invalid request.
			console.log('Invalid request');
            res.writeHead(404, {
                "Content-Type": "text/plain"
            });
            res.write("404 Not Found\n");
            res.end();
            return;
		}
		
		// Validate and authenticate this request.
		authenticateUserByToken("", uriObject.query.userId, uriObject.query.token, uriObject.query.clientId, function(result) {
			if (!result || !result.result) {
        		console.log('Unsuccessful User Validation');
	            res.writeHead(404, {
	                "Content-Type": "text/plain"
	            });
	            res.write("404 Not Found\n");
	            res.end();
	            return;
			}
			console.log('User has been authenticated, now attempting to authorize...');

			// Now that the user is authorized, authorize them.
			authorizeUserForClassObject(uriObject.query.userId, uriObject.query.clientId, uriObject.query.cn, uriObject.query.id, true, function(result) {
				//Now check result.
				if (!result || !result.accessor || !result.accessor.canRead || !result.resultObject || !result.resultObject.ID) {
	        		console.log('User not authenticated');
		            res.writeHead(404, {
		                "Content-Type": "text/plain"
		            });
		            res.write("404 Not Found\n");
		            res.end();
		            return;
				}
				
//				if (!form.assetObject) {
//					form.assetObject = {};
//				}
//				form.assetObject.value = result.resultObject;
				
	            // Get data from redis.
				console.log('Attempting to get ' + result.resultObject.cn + ':' + result.resultObject.ID + ' from data store');
				redisClient.get(result.resultObject.cn + ':' + result.resultObject.ID, function(err, reply) {
					//{ext: libpath.extname(nextFile.path)}
					if (err) {
		            	console.log('Error reading file data from data store: ' + err);
			        	console.log('File does not exist');
			            res.writeHead(404, {
			                "Content-Type": "text/plain"
			            });
			            res.write("404 Not Found\n");
		                return;
					}

					var replyObject = JSON.parse(reply);
					if (!replyObject) {
						replyObject = {};
					}
					if (!replyObject.ext) {
						replyObject.ext = "";
					}

					var filename = libpath.join(storagePath, result.resultObject.cn, result.resultObject.ID + replyObject.ext);
					console.log('File Name: ' + filename);
					console.log('User has been authorized, now attempting to load file...');
					libpath.exists(filename, function (exists) {
				        if (!exists) {
				        	console.log('File does not exist');
				            res.writeHead(404, {
				                "Content-Type": "text/plain"
				            });
				            res.write("404 Not Found\n");
				            res.end();
				            return;
				        }
		
				        if (fs.statSync(filename).isDirectory()) {
				            //filename += '/index.html';
				        	console.log('Attempting to access directory, returning "Not Found".');
				            res.writeHead(404, {
				                "Content-Type": "text/plain"
				            });
				            res.write("404 Not Found\n");
				            res.end();
				            return;
				        }
		
				        fs.readFile(filename, "binary", function (err, file) {
				            if (err) {
				            	console.log('Error reading file.');
				                res.writeHead(500, {
				                    "Content-Type": "text/plain"
				                });
				                res.write(err + "\n");
				                res.end();
				                return;
				            }
		
				            var type = mime.lookup(filename);
				            console.log('Serving up file ' + filename + ' [' + type + ']');
				            res.writeHead(200, {
				                "Content-Type": type
				            });
				            res.write(file, "binary");
				            res.end();
				            return;
				        });
				    });
					
					return;
				});

				return;

			}, function() {
	        	console.log('Error authorizing user, returning "Not Found".');
	            res.writeHead(404, {
	                "Content-Type": "text/plain"
	            });
	            res.write("404 Not Found\n");
	            res.end();

				return;
			});
			
		}, function() {
			console.log('Error getting result of ValidateUserByToken');
        	console.log('Unvalidated user, returning "Not Found".');
            res.writeHead(404, {
                "Content-Type": "text/plain"
            });
            res.write("404 Not Found\n");
            res.end();
		});

	    return;
	}
	else if ((req.url == '/upload' || req.url == '/download') && req.method.toLowerCase() == 'post') {
	    // parse a file upload
	    var form = new formidable.IncomingForm();
	    form.uploadDir = tmpPath;
	    form.keepExtensions = true;
	    
	    form.on('field', function(name, value) {
	    	console.log('onField: ' + name + ' / ' + value);
	
	    	if (!form.processedFields) {
	    		form.processedFields = [];
	    	}
	    	form.processedFields.push({name: name, value: value});
	
	    	if (name == 'userId' || name == 'clientId' || name == 'token' || name == 'cn' || name == 'classId') {
				console.log('Processing ' + name);
	    		form[name] = {};
	    		form[name].processed = true;
	    		form[name].value = value;
	    		
	    		if (form.userId && form.clientId && form.token && form.cn && form.classId && !form.isAuthenticating) {
					console.log('Verifying auth... ' + form.userId.value + ' / ' + form.clientId.value + ' / ' + form.token.value);
					form.isAuthenticating = true;
		    		form.isAuthenticated = false;
					
		    		authenticateUserByToken("", form.userId.value, form.token.value, form.clientId.value, function(result) {
		    			if (!result || !result.result) {
		    				destroyConnection(req, res, form);
		    	            return;
		    			}

		    			// Now that the user is authorized, authorize them.
		    			authorizeUserForClassObject(form.userId.value, form.clientId.value, form.cn.value, form.classId.value, true, function(result) {
		    				//Now check result.
		    				if (!result || !result.accessor || !result.accessor.canUpdate || !result.resultObject || !result.resultObject.ID) {
		    	        		console.log('User not authenticated');
		    		            res.writeHead(404, {
		    		                "Content-Type": "text/plain"
		    		            });
		    		            res.write("404 Not Found\n");
		    		            res.end();
		    		            return;
		    				}
		    				
		    				if (!form.assetObject) {
		    					form.assetObject = {};
		    				}
		    				form.assetObject.value = result.resultObject;

		    				var filename = libpath.join(storagePath, result.resultObject.cn, result.resultObject.ID);
		    				console.log('File Name: ' + filename);
		    				form.filename = filename;

		    				form.isAuthenticated = true;
							form.isAuthenticating = false;
							console.log('Authentification verified');
							
							// If the form has the endTimeout set, it means the file(s) has finished uploading and it has been
							//	waiting for the auth response.  So cancel that timeout and finish the process.
							if (form.endTimeout) {
								try {
									console.log('File has already finished uploading, clearing endTimeout and finishing process.');
									clearTimeout(form.endTimeout);
						    		finishUpload(form);
								} catch (e) {
									console.log('Unable to clear endTimeout.', e);
								}
							}
		    			}, function() {
		    				destroyConnection(req, res, form);
		    	            return;
		    			});
						
					}, function() {
						console.log('Error getting result of ValidateUserByToken');
	    				destroyConnection(req, res, form);
					});
	    		};
	    	}
	    });
	
	    form.on('fileBegin', function(name, file) {
	    	if (!form.uploadingFiles) {
	    		form.uploadingFiles = [];
	    	}
	    	form.uploadingFiles.push(file);
	    });
	    
	    form.onPart = function(part) {
	    	try {
		    	console.log(JSON.stringify(part));
		    	if (part.name == 'userId' || part.name == 'clientId' || part.name == 'token' || part.name == 'cn' || part.name == 'classId') {
		    		if (part.name == 'userId') {
		    			form.hasUserId = true;
		    		}
		    		else if (part.name == 'clientId') {
		    			form.hasClientId = true;
		    		}
		    		else if (part.name == 'token') {
		    			form.hasToken = true;
		    		}
		    		else if (part.name == 'cn') {
		    			form.hasClassName = true;
		    		}
		    		else if (part.name == 'classId') {
		    			form.hasClassId = true;
		    		}
	    			form.handlePart(part);
		    	}
		    	else if (part.filename) {
		    		// Make sure we have all the reqiured parameters.
		    		if (!form.hasUserId || !form.hasClientId || !form.hasToken || !form.hasClassName || !form.hasClassId) {
		    			console.log('Invalid attempt: Incomplete parameters');
			        	req.connection.destroy();
			        	req.connection.resume = function(){};
		    		}
		    		else {
		    			form.handlePart(part);
		    		}
		    	} else {
	    			form.handlePart(part);
		    	}
	    	} catch (e) {
	    		console.log('Error processing part');
	            util.puts(util.inspect(part));
	    	}
	    };
	    form.parse(req, function(err, fields, files) {
	    	// Need to make sure authentication has finished at this point before closing the connection.
	    	if (!form.isAuthenticated) {
	    		// Set a timeout to wait for authentication.
	    		//req.pause();
	    		form.endTimeout = setTimeout(function() {
	    			if (!form.isAuthenticated) {
			        	console.log('Unable to verify auth, killing upload.');
	    				// Form still not authenticated, so kill connection and delete file.
	    				destroyConnection(req, res, form);
	    			} else {
	    				console.log('Form Timeout complete and form has been authenticated. Finishing upload');
	    	    		finishUpload(form);
	    			}
	    		}, 10000);
	    	} else {
	    		finishUpload(form);
	    	}
	    });
	    return;
	}
	
	function destroyConnection(req, res, form) {
		res.writeHead(401, {'content-type': 'text/plain'});
		res.end(util.inspect({fields: form.processedFields, files:form.uploadingFiles}));

		req.connection.destroy();
    	req.connection.resume = function(){};
    	
    	// Need to remove any files created.
		if (form.uploadingFiles) {
			form.uploadingFiles.forEach(function (nextFile) {
				try {
					console.log('Attempting to remove file ' + nextFile.name);
					util.puts(util.inspect(nextFile));
		        	var nextPath = nextFile.path;
		        	console.log('Removing ' + nextPath);
		        	if (libpath.existsSync(nextPath)) {
			        	fs.unlink(nextPath, function(err) {
			        		if (err) {
			        			console.log('Error removing part: ' + err);
			        		} else {
			        			console.log('Removed part: ' + nextPath);
			        		}
			        	});
		        	}
		        	
		        	// Also attempt to unlink the moved file (if it exists)
		        	var nextMovedPath = libpath.join(storagePath, form.cn.value, form.classId.value);
		        	console.log('Removing ' + nextMovedPath);
		        	if (libpath.existsSync(nextMovedPath)) {
			        	fs.unlink(nextMovedPath, function(err) {
			        		if (err) {
			        			console.log('Error removing moved part: ' + err);
			        		} else {
			        			console.log('Removed moved part: ' + nextMovedPath);
			        		}
			        	});
		        	}
				} catch (e) {
					// Do nothing.
					console.log('Error removing file: ' + e);
				}
			});
			delete form.uploadingFiles;
		}
		delete form.processedFields;
		
    	console.log('Destroyed the connection');
	}
	
	function finishUpload(form) {
		// Notify syncAgent of new asset.
		form.assetObject.value.assetState = "READY";
		form.assetObject.value.dateAssetModified = Date.now();
		
		console.log('Saving AssetObject...');
		putObject(form.userId.value, form.clientId.value, form.assetObject.value, function(result) {
			// Make sure it is a valid result
			if (!result || !result.result) {
				console.log('Unable to save AssetObject.');
				destroyConnection(req, res, form);
				return;
			}

			console.log('AssetObject Saved!');
			if (form.uploadingFiles) {
				form.uploadingFiles.forEach(function(nextFile) {
					// Now store data about this file in redis.
					redisClient.get(form.cn.value + ":" + form.classId.value, function(err, reply) {
						// Handle existing record/file.
						if (!err && reply) {
							var replyObject = JSON.parse(reply);
							if (!replyObject)	replyObject = {};
							if (!replyObject.ext)	replyObject.ext = "";

							var existingFilePath = libpath.join(storagePath, form.cn.value, form.classId.value + replyObject.ext);
							console.log('Existing file path: ' + existingFilePath);
							if (libpath.existsSync(existingFilePath)) {
								console.log('Previous file exists, unlinking previous file.');
								// Delete existing file.
								fs.unlinkSync(existingFilePath);
							} else {
								console.log('Previous file does NOT exist.');
							}
						}

						var nextFilePath = libpath.join(storagePath, form.cn.value, form.classId.value + libpath.extname(nextFile.path));
						var nextDirPath = libpath.join(storagePath, form.cn.value);
						if (!libpath.existsSync(nextDirPath)) {
							fs.mkdirSync(nextDirPath, '777');
						}
						
						console.log('Moving file ' + nextFile.path + ' to ' + nextFilePath);
						fs.rename(nextFile.path, nextFilePath);
						
						// Now store data about this file in redis.
						redisClient.set(form.cn.value + ":" + form.classId.value, JSON.stringify({ext: libpath.extname(nextFile.path)}), function(err, reply) {
							if (err)
								console.log("Error saving file data to data store: " + err);
							else
								console.log('File data stored in ' + form.cn.value + ":" + form.classId.value);
						});
					});
				});
			}
			
			// Form has been authenticated, so send result.
			res.writeHead(200, {'content-type': 'text/plain'});
			//res.end(util.inspect({fields: fields, files: files}));
			res.end(util.inspect({fields: form.processedFields, files:form.uploadingFiles}));
			
			delete form.uploadingFiles;
			delete form.processedFields;
		}, function(fault) {
			// Unable to save object.
			console.log('Error saving AssetObject.');
			destroyConnection(req, res, form);
		});
		
	}

	// show a file upload form
	res.writeHead(200, {'content-type': 'text/html'});
	res.end(
	    '<form action="/upload" enctype="multipart/form-data" method="post">'+
	    '<input type="text" name="title"><br>'+
	    'UserID: <input type="text" name="userId" value="402882c235d4d1180135d4d37fd00002"><br/>'+
	    'Token: <input type="text" name="token" value="bf81f20d-cfa2-4735-a3a4-80974ee94231"><br/>'+
	    'ClientID: <input type="text" name="clientId" value="gw13040660342009931999"><br/>'+
	    'ClassName: <input type="text" name="cn" value="com.psiglobal.mo.Person"><br/>'+
	    'ClassID: <input type="text" name="classId" value="402882c235d4d1290135d4d290ec0004"><br/>'+
	    '<input type="file" name="upload" multiple="multiple"><br>'+
	    '<input type="submit" value="Upload">'+
	    '</form><br/>' +
	    '<a href="download/?userId=402882c235d4d1180135d4d37fd00002&clientId=gw13040660342009931999&token=bf81f20d-cfa2-4735-a3a4-80974ee94231&cn=com.psiglobal.mo.Person&id=402882c235d4d1290135d4d290ec0004">View Here</a>'
	);
}).listen(port);