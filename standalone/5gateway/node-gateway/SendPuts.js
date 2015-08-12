'use strict';

var connect = require('connect');
var io = require('socket.io-client');
var cluster = require('cluster');

var theAccessToken = 'ya29.AHES6ZRueenOKSxT_Q8puyND1DRAr8taStoXalzMDCU01PatdNUn_a0';
var theRefreshToken = '1/G3ZFYptJEsBgAci8qAGPmYwEnElUEavENIQpa9NOLPI';
var testCount = 100;

var workers = {};
var activeWorkers = 0;
var totalTime = 0;

if (cluster.isMaster) {
	var numCPUs = require('os').cpus().length;
	var workerCount = 1;
	console.log('Num CPUs: ' + numCPUs);

	// One worker per CPU
	for (var i = 0; i < workerCount; i++) {
		var worker = cluster.fork();
		activeWorkers++;
		console.log ('Num Active Workers now ' + activeWorkers);
		workers[worker.pid] = worker;
		worker.on('message', function(msg) {
			if (msg.result) {
				console.log(msg.result);
				if (msg.time) {
					totalTime += msg.time;
				}
				if (msg.pid && workers[msg.pid]) {
					activeWorkers--;
					workers[msg.pid].kill();
					delete workers[msg.pid];
				}
				console.log('Num Active Workers reduced to ' + activeWorkers);
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
	}

	cluster.on('death', function(worker) {
		console.log('worker ' + worker.pid + ' died');
	});
} else {
	console.log(process.memoryUsage());

	// Worker processes should start the test.
	startTest({name: 'Start', count: testCount, host: 'qanode.psiglobaldb.com', port: 8080, regAppKey: 'PSI_29V97G', svcOauthKey: '718060161923.apps.googleusercontent.com', accessToken: theAccessToken, refreshToken: theRefreshToken, redirectUri: 'urn:ietf:wg:oauth:2.0:oob'}, process);
	//process.send({name: 'Start', count: testCount, host: 'localhost', port: 8080, regAppKey: 'PSI_29V97G', svcOauthKey: '718060161923.apps.googleusercontent.com', accessToken: theAccessToken, refreshToken: theRefreshToken, redirectUri: 'urn:ietf:wg:oauth:2.0:oob'});
	//worker.startTest({count: 10, host: 'localhost', port: 8080, regAppKey: 'PSI_29V97G', svcOauthKey: '718060161923.apps.googleusercontent.com', accessToken: theAccessToken, refreshToken: theRefreshToken, redirectUri: 'urn:ietf:wg:oauth:2.0:oob'});
}
//startTest({count: 10, host: 'localhost', port: 8080, regAppKey: 'PSI_29V97G', svcOauthKey: '718060161923.apps.googleusercontent.com', accessToken: theAccessToken, refreshToken: theRefreshToken, redirectUri: 'urn:ietf:wg:oauth:2.0:oob'});

function guidGenerator() {
	var S4 = function() {
   	return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
	};
	return (S4()+S4()+'-'+S4()+'-'+S4()+'-'+S4()+'-'+S4()+S4()+S4());
}

var clientId;
var userId;
var token;

function startTest(command, worker) {
	var getAllCropTypeStart;
	var getAllCropTypeCount = command.count;
	var getAllCropTypeRequestCount = 0;
	var getAllCropTypeResponseCount = 0;
	var getAllCropTypeEnd;

	var host = command.host;
	var port = command.port;

	var socket = io.connect('http://' + host + ':' + port);
	console.log('Connected to http://' + host + ':' + port);

	socket.on('push', function(message) {
		var parts = message.cn.match(/^com\.percero\.agents\.([^.]+)\.vo\.(.+)$/);
		var agent = parts[1];
		var type = parts[2];
		if (agent == 'auth') {
			if (type == 'AuthenticateOAuthCodeResponse') {
				if (message.result && message.result.clientId && message.result.user && message.result.user.id) {
					clientId = message.result.clientId;
					userId = message.result.user.id;

					console.log('Valid Authentication Result');
				} else {
					console.log('Invalid authentication result');
				}
			} else if (type == 'AuthenticateOAuthAccessTokenResponse') {
				if (message.result && message.result.clientId && message.result.user && message.result.user.id) {
					clientId = message.result.clientId;
					userId = message.result.user.id;
					token = message.result.token;

					console.log('Valid Authentication Result');
				} else {
					console.log('Invalid authentication result');
				}
			}
		} else if (agent == 'sync') {
			if (type == 'ConnectResponse') {
				if (message.clientId) {
					if (message.clientId !== clientId) {
						console.log('Different ClientID Received! ' + clientId, message);
					} else {
						getAllCropTypeStart = new Date();
						console.log('Starting GetAllCropType Test');
						//for (var i = 0; i < getAllCropTypeCount; i++) {
							var getAllRequest = setupGetAllByNameRequest('com.psiglobal.mo.CropType');
							getAllCropTypeRequestCount++;
							socket.emit('getAllByName', getAllRequest);
						//}
//						setTimeout(function() {
						for (var i = 0; i < 10; i++) {
						var putRequest = setupPutRequest({
							cn: 'com.psiglobal.mo.CropType',
							ID: '9B4EC692-DAC3-E0B5-7C9F-C00B3AFAD13C',
							subTypes:[
								{
									properties: {},
									ID: 'ADEAC9A3-7757-8D44-F094-C00E28177586',
									className: 'com.psiglobal.mo.CropSubType'
								},
								{
									properties: {},
									ID: '2D00509C-C777-7A6E-DB98-C00E48B22653',
									className: 'com.psiglobal.mo.CropSubType'
								},
								{
									properties: {},
									ID: 'E7EFFE57-CC7C-05C2-BE44-C00E35CD7617',
									className: 'com.psiglobal.mo.CropSubType'
								}
							],
							varieties: [],
							name: 'Table Grape'
						});

console.log('data: ', putRequest);
						socket.emit('putObject', putRequest);

						}
//						}, 5000);

					}
				} else {
					console.log('Invalid authentication result');
				}
			} else if (type == 'GetAllByNameResponse') {
				console.log('Received GetAllByNameResponse');

				for (var i = 0; i < message.result.length; i++) {
					if (i == 0) {
						var _className = message.result[i].cn;

						if (_className === 'com.psiglobal.mo.CropType') {
							getAllCropTypeResponseCount++;
							if (getAllCropTypeRequestCount <= getAllCropTypeResponseCount) {
								getAllCropTypeEnd = new Date();
								console.log('GetAllCropTypes Total Time: ' + (getAllCropTypeEnd.getTime() - getAllCropTypeStart.getTime()) + 'ms');
								worker.send({result: 'Test Complete', pid: process.pid, time: (getAllCropTypeEnd.getTime() - getAllCropTypeStart.getTime())});
							} else {
								console.log('Class: ' + _className + ' [' + getAllCropTypeResponseCount + ' of ' + getAllCropTypeRequestCount + ']');
								console.log('DATA: ', message.result[i]);
							}
						}
					}
				}
			} else if (type == 'FindByIdResponse') {
				var _className = message.result.cn.replace('.', '_');
				console.log('Received FindByIdResponse: ' + _className + ' [' + message.result.ID + ']');
			} else if (type == 'PushUpdateResponse') {
				console.log('Received PushUpdateResponse');
			} else {
				console.log('TODO: Handle message ', message);
			}
		} else {
			console.log('TODO: Handle un-classed message ', message);
		}
	});
	socket.on('sync', function(message) {
		console.log('got SYNC message');
	});
	socket.on('disconnect', function() {
		console.log('disconnected from server');
	});
	socket.on('gatewayConnectAck', function(message) {
		console.log('gatewayConnectAck', message);
	});

	// Send Connect to Queue request.
	var connectRequest = {connect: 'connect'};
	socket.emit('message', connectRequest);

	var accessToken = command.accessToken;
	var refreshToken = command.refreshToken;
	var regAppKey = command.regAppKey;
	var svcOauthKey = command.svcOauthKey;
	var redirectUri = command.redirectUri;

	if (accessToken && refreshToken) {
		console.log('Attempting authentication...');
		var authReq = setupAuthenticateOAuthAccessTokenRequest(regAppKey, svcOauthKey, accessToken, refreshToken, redirectUri);
		socket.emit('authenticateOAuthAccessToken', authReq);
	}
};

function setupAuthRequest() {
	var authRequest = {};
	authRequest.cn = 'com.percero.agents.auth.vo.AuthRequest';
	authRequest.userId = '';
	authRequest.token = token;
	authRequest.clientType = 'N';
	authRequest.clientId = '';
	authRequest.messageId = guidGenerator();
	return authRequest;
}

function setupAuthenticateOAuthAccessTokenRequest(regAppKey, svcOauthKey, accessToken, refreshToken, redirectUri) {
	var authAccessTokenRequest = setupAuthRequest();
	authAccessTokenRequest.cn = 'com.percero.agents.auth.vo.AuthenticateOAuthAccessTokenRequest';
	authAccessTokenRequest.regAppKey = regAppKey;
	authAccessTokenRequest.svcOauthKey = svcOauthKey;
	authAccessTokenRequest.accessToken = accessToken;
	authAccessTokenRequest.refreshToken = refreshToken;
	authAccessTokenRequest.redirectUri = redirectUri;
	return authAccessTokenRequest;
}

function setupSyncRequest() {
	var request = {};
	request.cn = 'com.percero.agents.sync.vo.SyncRequest';
	request.userId = userId;
	request.token = token;
	request.clientType = '';
	request.clientId =  clientId;
	request.responseChannel = '';
	request.messageId = guidGenerator();
	return request;
}

function setupGetAllByNameRequest(theClassName) {
	var request = setupSyncRequest();
	request.cn = 'com.percero.agents.sync.vo.GetAllByNameRequest';
	request.theClassName = theClassName;
	return request;
}

function setupPutRequest(theObject) {
	var request = setupSyncRequest();
	request.cn = 'com.percero.agents.sync.vo.PutRequest';
	request.transId = guidGenerator();
	request.putTimestamp = Date.now();
	request.theObject = theObject;
	return request;
}
