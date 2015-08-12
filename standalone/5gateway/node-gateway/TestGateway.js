var connect = require('connect')
    , io = require('socket.io-client')
    , cluster = require('cluster');
//    , amqp = require('amqp'),
//    fs = require('fs'),
//    prop = require('./prop.js'),
//    prompt = require('prompt');
//    propFile = (process.argv[2] || "resources/test.properties");

/*
if (cluster.isMaster) {
	// One worker per CPU
	for (var i = 0; i < numCPUs; i++) {
		cluster.fork();
	}

	cluster.on('death', function(worker) {
		console.log('worker ' + worker.pid + ' died');
	});
} else {
	// Worker processes should start the test.
}
/*
onmessage = function(msg) {
	var command = msg.data.command;
	
	if (command.name == 'Start') {
		startTest(command);
	}
};

onclose = function() {
	sys.debug('Worker shutting down.');
};*/

var theAccessToken = 'ya29.AHES6ZS25AkbNiKqA30gJA1MnO3hG5aIukqmolntMeUsajQE';
var theRefreshToken = '1/x7DKmKsHy_Wpz10P5876kojHFOZM6_XB5VvPfF0-fTU';
var useVerbose = false;
var testCount = 10 * 1000;


var workers = {};
var activeWorkers = 0;
var totalTime = 0;

if (cluster.isMaster) {
	var numCPUs = require('os').cpus().length;
	var workerCount = numCPUs;
	if (useVerbose)
		console.log("Num CPUs: " + numCPUs);

	// One worker per CPU
	for (var i = 0; i < workerCount; i++) {
		try {
			var worker = cluster.fork();
			activeWorkers++;
			if (useVerbose)
				console.log ('Num Active Workers now ' + activeWorkers);
			workers[worker.pid] = worker;
			worker.on('message', function(msg) {
				if (msg.result) {
					if (useVerbose)
						console.log(msg.result);
					if (msg.time) {
						totalTime += msg.time;
					}
					if (msg.pid && workers[msg.pid]) {
						activeWorkers--;
						workers[msg.pid].kill();
						delete workers[msg.pid];
					}
		    		if (useVerbose)
		    			console.log ('Num Active Workers reduced to ' + activeWorkers);
					if (activeWorkers <= 0) {
						console.log('Num Workers: ' + workerCount);
						console.log('Test Count: ' + testCount);
						console.log('Total Count: ' + workerCount * testCount);
						console.log('Total time: ' + totalTime);
						console.log('Average time: ' + totalTime / workerCount);
						console.log('Average time/request: ' + totalTime / (workerCount * testCount));
						console.log('Exiting process');
						process.exit();
					}
				}
			});
		} catch(e) {
			console.trace(e);
		}
	}

	cluster.on('death', function(worker) {
		console.log('worker ' + worker.pid + ' died');
	});
	
} else {
	if (useVerbose)
		console.log(process.memoryUsage());
	
	// Worker processes should start the test.
	startTest({name: 'Start', count: testCount, useVerbose: useVerbose, host: 'localhost', port: 8080, regAppKey: 'PSI_29V97G', svcOauthKey: '718060161923.apps.googleusercontent.com', accessToken: theAccessToken, refreshToken: theRefreshToken, redirectUri: 'urn:ietf:wg:oauth:2.0:oob'}, process);
	//process.send({name: 'Start', count: testCount, useVerbose: useVerbose, host: 'localhost', port: 8080, regAppKey: 'PSI_29V97G', svcOauthKey: '718060161923.apps.googleusercontent.com', accessToken: theAccessToken, refreshToken: theRefreshToken, redirectUri: 'urn:ietf:wg:oauth:2.0:oob'});
	//worker.startTest({count: 10, useVerbose: true, host: 'localhost', port: 8080, regAppKey: 'PSI_29V97G', svcOauthKey: '718060161923.apps.googleusercontent.com', accessToken: theAccessToken, refreshToken: theRefreshToken, redirectUri: 'urn:ietf:wg:oauth:2.0:oob'});
}
//startTest({count: 10, useVerbose: true, host: 'localhost', port: 8080, regAppKey: 'PSI_29V97G', svcOauthKey: '718060161923.apps.googleusercontent.com', accessToken: theAccessToken, refreshToken: theRefreshToken, redirectUri: 'urn:ietf:wg:oauth:2.0:oob'});

// DONT DELETE THIS
// IS A GOOD EXAMPLE OF HOW TO DUMP A VARIABLE
//sys.puts(sys.inspect(modelState));

function guidGenerator() {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

/**
 * We can't proceed with startup until we read in the environment properties so we do the rest of
 * setup in the callback for the properties load.
 */
function startTest(command, worker) {
//    server.listen(props['gateway.port']);

	/*************************************
	 * TEST VARS: This is where all test vars should be created.
	 */
	var getAllCropTypeStart;
	var getAllCropTypeCount = command.count;
	var getAllCropTypeRequestCount = 0;
	var getAllCropTypeResponseCount = 0;
	var getAllCropTypeEnd;

	var useVerbose = command.useVerbose;
	var host = command.host;
	var port = command.port;
	if (useVerbose)
		console.log("Verbose Logging is turned " + (useVerbose ? 'ON' : 'OFF'));
	
    socket = io.connect('http://' + host + ':' + port);
	if (useVerbose)
		console.log('Connected to http://' + host + ':' + port);

    socket.on('push', function (message) {
        if(message === 'Access Denied.'){
        	console.log("Access Denied.  Please login before sending messages.");
        }
        else if(message.className){
            if(message.className === "com.percero.agents.auth.vo.UserToken"){
                console.log('Authenticated');
            }
            else if(message.data == "logout"){
                console.log('Logged Out');
            }
        }
        
        if (message.cn) {
        	// This message is of a particular class type, denoted by the field "cn".
        	if (message.cn === "com.percero.agents.auth.vo.AuthenticateOAuthCodeResponse") {
        		// AuthenticateOAuthResponse
        		if (message.result && message.result.clientId && message.result.user && message.result.user.id) {
            		//alert("Authenticated as ClientID " + message.result.clientId + ", User " + message.result.user.id);
            		clientId = message.result.clientId;
            		userId = message.result.user.id;
            		
            		if (useVerbose)
            			console.log('Valid Authentication Result');
            		
        		} else {
        			console.log("Invalid authentication result");
        		}
        	} else if (message.cn === "com.percero.agents.auth.vo.AuthenticateOAuthAccessTokenResponse") {
        		// AuthenticateAccessToken
        		if (message.result && message.result.clientId && message.result.user && message.result.user.id) {
            		//alert("Authenticated as ClientID " + message.result.clientId + ", User " + message.result.user.id);
            		clientId = message.result.clientId;
            		userId = message.result.user.id;
            		
            		if (useVerbose)
            			console.log('Valid Authentication Result');
            		
        		} else {
        			console.log("Invalid authentication result");
        		}
        	} else if (message.cn === "com.percero.agents.sync.vo.ConnectResponse") {
        		// ConnectResponse.  The message.clientId should be equal to clientId received from the AuthentiateOAuthCodeResponse.
        		if (message.clientId) {
            		//alert("Connected as ClientID " + message.clientId);
            		if (message.clientId !== clientId) {
            			console.log("Different ClientID Received!")
            		} else {
            			/***********************************************
            			 * TEST BEGIN: This is where all tests should be run.
            			 */
            			// Request ALL CropTypes 1000 times
            			getAllCropTypeStart = new Date();
                		if (useVerbose)
                			console.log('Starting GetAllCropType Test');
            			for(var i = 0; i < getAllCropTypeCount; i++) {
	            			// Test GetAllByName
	            			var getAllRequest = setupGetAllByNameRequest("com.psiglobal.mo.CropType");
	            			getAllCropTypeRequestCount++;
	            			socket.emit('getAllByName', getAllRequest);
            			}
            			//getAllRequest = setupGetAllByNameRequest("com.psiglobal.mo.Company");
            			//socket.emit('getAllByName', getAllRequest);
            		}
        		} else {
        			console.log("Invalid authentication result");
        		}
        	} else if (message.cn === "com.percero.agents.sync.vo.GetAllByNameResponse") {
        		//alert("Received GetAllByNameResponse");
        		if (useVerbose)
        			console.log("Received GetAllByNameResponse");

        		for(var i = 0; i < message.result.length; i++) {
        			if (i == 0) {
            			var _className = message.result[i].cn;
            			
            			if (_className === "com.psiglobal.mo.CropType") {
            				getAllCropTypeResponseCount++;
            				if (getAllCropTypeRequestCount <= getAllCropTypeResponseCount) {
            					getAllCropTypeEnd = new Date();
            					if (useVerbose)
            						console.log("GetAllCropTypes Total Time: " + (getAllCropTypeEnd.getTime() - getAllCropTypeStart.getTime()) + "ms");
            					//postMessage({result: 'Test Complete'});
            					//kill();
            					worker.send({result: 'Test Complete', pid: process.pid, time: (getAllCropTypeEnd.getTime() - getAllCropTypeStart.getTime())});
            					//process.exit();
            				} else {
            					if (useVerbose) {
            						console.log("Class: " + _className + " [" + getAllCropTypeResponseCount + " of " + getAllCropTypeRequestCount + "]");
            					}
            				}
            			}
        			}
        		}
        	} else if (message.cn === "com.percero.agents.sync.vo.FindByIdResponse") {
    			var _className = message.result.cn.replace(".", "_");
        		console.log("Received FindByIdResponse: " + _className + " [" + message.result.ID + "]");
        	} else if (message.cn === "com.percero.agents.sync.vo.PushUpdateResponse") {
        		console.log("Received PushUpdateResponse");
        	} else {
                console.log("TODO: Handle message of class " + message.cn);
        		
        	}
        } else {
        	console.log("TODO: Handle un-classed message " + message);
        }

    });
    socket.on('sync', function(message) {
        console.log('got SYNC message');
    });
    socket.on('disconnect', function(){
        console.log("disconnected from server");
    });
    socket.on('gatewayConnectAck', function(message){
        reconnectId = message;
/*        if($.urlParam('code')){
            login($.urlParam('code'));
        }*/
    });
    
    // Send Connect to Queue request.
    var connectRequest = {connect: 'connect'};
    socket.emit('message', connectRequest);
	
    
    var accessToken = command.accessToken;
    var refreshToken = command.refreshToken;
    var regAppKey = command.regAppKey;
    var svcOauthKey = command.svcOauthKey;
    var redirectUri = command.redirectUri;
    
    if (accessToken !== undefined && accessToken !== '' && refreshToken !== undefined && refreshToken !== '') {
		if (useVerbose)
			console.log('Attempting authentication...');
        var authReq = setupAuthenticateOAuthAccessTokenRequest(regAppKey, svcOauthKey, accessToken, refreshToken, redirectUri);
        socket.emit('authenticateOAuthAccessToken',authReq);
    }
};

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

function setupAuthenticateOAuthCodeRequest(code) {
	var authOAuthCodeRequest = setupAuthRequest();
	authOAuthCodeRequest.cn = "com.percero.agents.auth.vo.AuthenticateOAuthCodeRequest";
	authOAuthCodeRequest.code = code;
	return authOAuthCodeRequest;
}

function setupAuthenticateOAuthAccessTokenRequest(regAppKey, svcOauthKey, accessToken, refreshToken, redirectUri) {
	var authAccessTokenRequest = setupAuthRequest();
	authAccessTokenRequest.cn = "com.percero.agents.auth.vo.AuthenticateOAuthAccessTokenRequest";
	authAccessTokenRequest.regAppKey = regAppKey;
	authAccessTokenRequest.svcOauthKey = svcOauthKey;
	authAccessTokenRequest.accessToken = accessToken;
	authAccessTokenRequest.refreshToken = refreshToken;
	authAccessTokenRequest.redirectUri = redirectUri;
	return authAccessTokenRequest;
}

function setupSyncRequest() {
	var request = {};
	request.cn = "com.percero.agents.sync.vo.SyncRequest";
	request.userId = userId;
	request.token = "";
	request.clientType = "";
	request.clientId =  clientId;
	request.responseChannel = "";
	request.messageId = "";
	return request;
}

function setupGetAllByNameRequest(theClassName) {
	var request = setupSyncRequest();
	request.cn = "com.percero.agents.sync.vo.GetAllByNameRequest";
	request.theClassName = theClassName;
	return request;
}

function setupFindById(theClassName, theClassId) {
	var request = setupSyncRequest();
	request.cn = "com.percero.agents.sync.vo.FindByIdRequest";
	request.theClassName = theClassName;
	request.theClassId = theClassId;
	return request;
}
// DONT DELETE THIS
// IS A GOOD EXAMPLE OF HOW TO DUMP A VARIABLE
//sys.puts(sys.inspect(modelS tate));

