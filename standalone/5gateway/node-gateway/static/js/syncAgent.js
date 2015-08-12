
var socket = io.connect('');
var reconnectId = "";
var clientId = "";
var userId = "";
var dataCache = {};
var ensureMessageDelivery = true;

socket.sendAuthenticatedRequest = function(name, request, caller, resultCallback) {
	if (!this.isAuthenticated) {
		if (!this.pendingRequests) {
			this.pendingRequests = [];
		}
		this.pendingRequests.push({name: name, request: request, caller: caller, resultCallback: resultCallback});
	} else {
		this.sendRequest(name, request, caller, resultCallback);
	}
};

socket.sendRequest = function(name, request, caller, resultCallback) {
	console.log("socket.sendRequest");
	socket.emit(name, request);

	// Register the callback.
	if (resultCallback) {
		if (!socket.request) {
			socket.request = {};
		}
		socket.request[request.messageId] = {
				caller: caller,
				resultCallback: resultCallback
		};
	}
};

socket.on('push',
		function(message) {
			console.log('got PUSH message');
			console.log(message);
			if (message === 'Access Denied.') {
				alert("Access Denied.  Please login before sending messages.");
			} else if (message.className) {
				if (message.className === "com.percero.agents.auth.vo.UserToken") {
					console.log('Logged in via UserToken');
					setStatus(true);
				} else if (message.data == "logout") {
					setStatus(false);
				}
			}

			if (message.cn) {
				// This message is of a
				// particular class type,
				// denoted by the field "cn".
				if (message.cn === "com.percero.agents.auth.vo.AuthenticateOAuthCodeResponse") {
					// AuthenticateOAuthResponse
					console.log(message);
					if (message.result
							&& message.result.clientId
							&& message.result.user
							&& message.result.user.id) {
						clientId = message.result.clientId;
						userId = message.result.user.id;
						this.isAuthenticated = true;
						setStatus(true);
						
						if (this.pendingRequests) {
							while(this.pendingRequests.length > 0) {
								var nextPendingRequest = this.pendingRequests.shift();
								try {
									nextPendingRequest.request.clientId = clientId;
									nextPendingRequest.request.userName = userId;
									console.log(nextPendingRequest);
									this.sendRequest(nextPendingRequest.name, nextPendingRequest.request, nextPendingRequest.caller, nextPendingRequest.resultCallback);
								} catch(e) {
									console.log('Error sending pending request: ' + e);
								}
							}
						}
					} else {
						alert("Invalid authentication result");
						setStatus(false);
					}
				} else if (message.cn === "com.percero.agents.auth.vo.GetRegAppOAuthsResponse") {
					// GetRegAppOAuthsResponse
					for ( var i = 0; i < message.result.length; i++) {
						if (!dataCache[message.result[i].cn])
							dataCache[message.result[i].cn] = {};

						if (!dataCache[message.result[i].cn][message.result[i].ID])
							dataCache[message.result[i].cn][message.result[i].ID] = message.result[i];
						else {
							// TODO: Overwrite the cached object.
						}
					}
				} else if (message.cn === "com.percero.agents.sync.vo.ConnectResponse") {
					// ConnectResponse. The message.clientId should be equal to clientId
					// received from the AuthentiateOAuthCodeResponse.
					if (message.clientId) {
						if (message.clientId !== clientId) {
							alert("Different ClientID Received!");
						} else {
							console.log('ConnectResponse has validated Client');
						}
					} else {
						alert("Invalid authentication result");
					}
				} else if (message.cn === "com.percero.agents.sync.vo.GetAllByNameResponse") {
					for ( var i = 0; i < message.result.length; i++) {
						if (!dataCache[message.result[i].cn])
							dataCache[message.result[i].cn] = {};

						if (!dataCache[message.result[i].cn][message.result[i].ID])
							dataCache[message.result[i].cn][message.result[i].ID] = message.result[i];
						else {
							// TODO: Overwrite the cached object.
						}
//						dataCache[message.result[i].cn][message.result[i].ID] = message.result[i];

						/**
						var _className = message.result[i].cn
								.replace(".",
										"_");
						if (message.result[i].accountingCompany) {
							$('#divObjects')
									.append(
											'<div id="div' + _className + '"><ul><li><span id="grp' + message.result[i].ID + '">ID: '
													+ message.result[i].ID
													+ '</span></li><li><span id="name' + message.result[i].ID + '">Name: Loading...</span></li><li><div><span>Accounting Clients</span><ul id="accountingClients' + message.result[i].ID + '"/></div></li></ul></div>');
							var findById = setupFindById(
									message.result[i].accountingCompany.className,
									message.result[i].accountingCompany.ID);
							socket.emit('findById', findById);
						} else {
							if (message.result[i].name) {
								$('#divObjects')
										.append(
												'<div id="div' + _className + '"><ul><li><span id="grp' + message.result[i].ID + '">ID: '
														+ message.result[i].ID
														+ '</span></li><li><span id="name' + message.result[i].ID + '">Name: '
														+ message.result[i].name
														+ '</span></li></ul></div>');
							} else {
								$('#divObjects')
										.append(
												'<div id="div' + _className + '"><ul><li><span id="grp' + message.result[i].ID + '">ID: '
														+ message.result[i].ID + '</span></li></ul></div>');
							}
						}
						**/
					}
				} else if (message.cn === "com.percero.agents.sync.vo.FindByIdResponse") {
					if (message && message.result && message.result.cn) {
						if (!dataCache[message.result.cn])
							dataCache[message.result.cn] = {};
						if (!dataCache[message.result.cn][message.result.ID])
							dataCache[message.result.cn][message.result.ID] = message.result;
						else {
							// TODO: Overwrite the cached object.
						}
					}

				} else if (message.cn === "com.percero.agents.sync.vo.PushUpdateResponse") {
					// alert("Received
					// PushUpdateResponse");

					message.objectList
							.forEach(function(
									nextObject) {
								if (!dataCache[nextObject.cn])
									dataCache[nextObject.cn] = {};
								if (!dataCache[nextObject.cn][nextObject.ID])
									dataCache[nextObject.cn][nextObject.ID] = message.result;
								else {
									console
											.log("Updating cached object "
													+ nextObject.cn
													+ " / "
													+ nextObject.ID);
									var cachedObject = dataCache[nextObject.cn][nextObject.ID];
									if (nextObject.name) {
										cachedObject.name = nextObject.name;
										if ($('#name'
												+ nextObject.ID)) {
											console
													.log("Setting Name inside of HTML");
											$(
													'#name'
															+ nextObject.ID)
													.html(
															'Name: '
																	+ nextObject.name);
										} else {
											console
													.log("NO HTML to Set Name inside of");
										}
									}
								}
							});
				} else {
					alert("TODO: Handle message of class "
							+ message.cn);

				}

				if (message.correspondingMessageId) {
					socket
							.emit(
									'message',
									{
										ack : {
											correspondingMessageId : message.correspondingMessageId
										}
									});
					
					// Check for a callback.
					if (this.request && this.request[message.correspondingMessageId]) {
						if (this.request[message.correspondingMessageId].resultCallback) {
							this.request[message.correspondingMessageId].resultCallback.apply(this.request[message.correspondingMessageId].caller, [message]);
						}
						this.request[message.correspondingMessageId] = undefined;
					}
				}
			} else {
				alert("TODO: Handle un-classed message "
						+ message);
			}

		});


function SyncAgent() {
	console.log('This is my new SyncAgent!');
	EventTarget.call(this);
}
SyncAgent.prototype = new EventTarget();
SyncAgent.prototype.constructor = SyncAgent;
SyncAgent.prototype.sentRequests = {};

SyncAgent.prototype.getRegAppOAuths = function(regAppKey, regAppSecret, oauthType, resultCallback, faultCallback, token) {
	var authReq = setupGetRegAppOAuthsRequest(regAppKey, regAppSecret, oauthType);
	
	if (!this.sentRequests.getRegAppOAuths) {
		this.sentRequests.getRegAppOAuths = [];
	}
	this.sentRequests.getRegAppOAuths.push({
		resultCallback: resultCallback,
		faultCallback: faultCallback,
		token: token
	});
	
	socket.sendRequest('getRegAppOAuths', authReq, this, this.onGetRegAppOAuthsResult);
};
SyncAgent.prototype.onGetRegAppOAuthsResult = function(message) {
	console.log("GetRegAppOAuthsResult");
	
	if (this.sentRequests && this.sentRequests.getRegAppOAuths) {
		this.sentRequests.getRegAppOAuths.forEach(function(nextRequest) {
			if (nextRequest.resultCallback) {
				nextRequest.resultCallback.apply(null, [message.result, nextRequest.token]);
			}
		});
		this.sentRequests.getRegAppOAuths = undefined;
	}
};

SyncAgent.prototype.login = function(regAppKey, svcOAuthKey, code, redirectUri, resultCallback, faultCallback, token) {
	var authReq = setupAuthenticateOAuthCodeRequest(regAppKey, svcOAuthKey, code, redirectUri);
	
	if (!this.sentRequests.authenticateOAuthCode) {
		this.sentRequests.authenticateOAuthCode = [];
	}
	this.sentRequests.authenticateOAuthCode.push({
		resultCallback: resultCallback,
		faultCallback: faultCallback,
		token: token
	});
	
	socket.sendRequest('authenticateOAuthCode', authReq, this, this.onAuthenticateOAuthCodeResult);
};
SyncAgent.prototype.onAuthenticateOAuthCodeResult = function(message) {
	console.log("AuthenticateOAuthCodeResult");
	
	if (this.sentRequests && this.sentRequests.authenticateOAuthCode) {
		this.sentRequests.authenticateOAuthCode.forEach(function(nextRequest) {
			if (nextRequest.resultCallback) {
				nextRequest.resultCallback.apply(null, [message.result, nextRequest.token]);
			}
		});
		this.sentRequests.authenticateOAuthCode = undefined;
	}
};



SyncAgent.prototype.findById = function(className, ID, resultCallback, faultCallback, token) {
	if (dataCache && dataCache[className] && dataCache[className][ID])
		resultCallback.apply(null, [dataCache[className][ID], token]);
	else
		return this.findByIdServer(className, ID, resultCallback, faultCallback, token);
};
SyncAgent.prototype.findByIdServer = function(className, ID, resultCallback, faultCallback, token) {
	console.log('FindByIdServer');
	// Directly checks the server for this className/ID pair.
	if (!this.sentRequests.findById) {
		this.sentRequests.findById = {};
	}
	if (!this.sentRequests.findById[className]) {
		this.sentRequests.findById[className] = {};
	}
	
	if (!this.sentRequests.findById[className][ID]) {
		socket.sendAuthenticatedRequest('findById', setupFindByIdRequest(className, ID), this, this.onFindByIdResult);
		this.sentRequests.findById[className][ID] = [];
	}
	this.sentRequests.findById[className][ID].push({
		resultCallback: resultCallback,
		faultCallback: faultCallback,
		token: token
	});
	
	return this;
};
SyncAgent.prototype.onFindByIdResult = function(message) {
	console.log("FindByIdResult");
	if (message.result && message.result.cn && message.result.ID) {
		if (this.sentRequests && this.sentRequests.findById && this.sentRequests.findById[message.result.cn] && this.sentRequests.findById[message.result.cn][message.result.ID]) {
			this.sentRequests.findById[message.result.cn][message.result.ID].forEach(function(nextRequest) {
				if (nextRequest.resultCallback) {
					nextRequest.resultCallback.apply(null, [message.result, nextRequest.token]);
				}
			});
			this.sentRequests.findById[message.result.cn][message.result.ID] = undefined;
		}
	} else {
		alert('Error with FindByIdResult');
	}
};


var syncAgent = new SyncAgent();

function setupSyncAgent() {
	socket.on('sync', function(message) {
		console.log('got SYNC message');
	});
	socket.on('connect', function() {
		console.log('Connected to Socket.IO! ' + socket.id);
		console.log('SessionID: ' + socket.socket.sessionid);
		if (socket.lastSessionId) {
			// Somehow lost connection, attempt to re-connect.
			console.log('Attempting to reconnect...');
			socket.isReconnecting = true;
			socket.emit('message', {reconnect: {lastSessionId: socket.lastSessionId, reconnectId: reconnectId, ensureMessageDelivery: ensureMessageDelivery}});
		}
	});
	socket.on('disconnect', function() {
		console.log("disconnected from server");
		socket.isAuthenticated = false;
		socket.lostConnection = true;
		socket.lastSessionId = socket.socket.sessionid;
		console.log('SessionID: ' + socket.socket.sessionid);
		setStatus(false);
	});
	socket.on('gatewayConnectAck', function(message) {
		reconnectId = message;
		
		if (!socket.isReconnecting) {
/*			if ($.urlParam('code')) {
				login($.urlParam('code'));
			}*/
		} else {
			console.log('Received gateway ack, but reconnect is pending.');
		}
	});
	socket.on('reconnectAck', function(message) {
		console.log('Received ReconnectAck: ' + message);
		setStatus(true);
		socket.isAuthenticated = true;
		socket.lostConnection = false;
		socket.lastSessionId = undefined;
		socket.isReconnecting = false;

		if (socket.pendingRequests) {
			while(socket.pendingRequests.length > 0) {
				var nextPendingRequest = socket.pendingRequests.shift();
				try {
					nextPendingRequest.request.clientId = clientId;
					nextPendingRequest.request.userName = userId;
					console.log(nextPendingRequest);
					socket.sendRequest(nextPendingRequest.name, nextPendingRequest.request, nextPendingRequest.caller, nextPendingRequest.resultCallback);
				} catch(e) {
					console.log('Error sending pending request: ' + e);
				}
			}
		}
	});
	
	// Send Connect to Queue request.
	var connectRequest = {
		connect : 'connect'
	};
	console.log('sending connectRequest');
	socket.emit('message', connectRequest);
}


// AuthAgent Requests/Responses.
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

function setupGetRegAppOAuthsRequest(regAppKey, regAppSecret, oauthType) {
	var authGetRegAppOAuthsRequest = setupAuthRequest();
	authGetRegAppOAuthsRequest.cn = "com.percero.agents.auth.vo.GetRegAppOAuthsRequest";
	authGetRegAppOAuthsRequest.regAppKey = regAppKey;
	authGetRegAppOAuthsRequest.regAppSecret = regAppSecret;
	authGetRegAppOAuthsRequest.oauthType = oauthType;
	return authGetRegAppOAuthsRequest;
}

function setupAuthenticateOAuthCodeRequest(regAppKey, svcOAuthKey, code, redirectUri) {
	var authOAuthCodeRequest = setupAuthRequest();
	authOAuthCodeRequest.cn = "com.percero.agents.auth.vo.AuthenticateOAuthCodeRequest";
	authOAuthCodeRequest.code = code;
	authOAuthCodeRequest.regAppKey = regAppKey;
	//authOAuthCodeRequest.svcOauthKey = svcOAuthKey;
	authOAuthCodeRequest.redirectUri = redirectUri;
	return authOAuthCodeRequest;
}

function setupSyncRequest() {
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



function setStatus(inout) {
/*	if (inout) {
		$('#status').text('Logged In');
		$('#status').css('color', 'green');
		$("#divLoginSvcOAuths").hide();
	} else {
		$('#status').text('Logged Out');
		$('#status').css('color', 'red');
		$("#divLoginSvcOAuths").show();
	}*/
}


// Utility like functions.
/**
 * jquery extension function for gettings URL params
 * @param name
 */
$.urlParam = function(name) {
	var results = new RegExp('[\\?&]' + name + '=([^&#]*)')
			.exec(window.location.href);
	if (results)
		return results[1];

	return false;
};

function guidGenerator() {
	var S4 = function() {
		return (((1 + Math.random()) * 0x10000) | 0).toString(16)
				.substring(1);
	};
	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4()
			+ S4() + S4());
}

// Sync Requests.
function setupSyncRequest() {
	var syncRequest = {};
	syncRequest.cn = "com.percero.agents.sync.vo.SyncRequest";
	syncRequest.userName = "";
	syncRequest.token = "";
	syncRequest.clientType = "N";
	syncRequest.clientId = clientId;
	syncRequest.responseChannel = "";
	syncRequest.messageId = guidGenerator();
	return syncRequest;
}

function setupFindByIdRequest(className, ID) {
	var request = setupSyncRequest();
	request.cn = "com.percero.agents.sync.vo.FindByIdRequest";
	request.theClassName = className;
	request.theClassId = ID;
	return request;
}
