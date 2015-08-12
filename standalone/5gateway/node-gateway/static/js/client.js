var socket;
var reconnectId = "";
var clientId = "";
var userId = "";
var dataCache = {};

function guidGenerator() {
	var S4 = function() {
		return (((1 + Math.random()) * 0x10000) | 0).toString(16)
				.substring(1);
	};
	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4()
			+ S4() + S4());
}

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

$(document)
		.ready(
				function() {
					socket = io.connect('');
					socket
							.on(
									'push',
									function(message) {
										console.log('got PUSH message');
										console.log(message);
										if (message === 'Access Denied.') {
											alert("Access Denied.  Please login before sending messages.");
										} else if (message.className) {
											if (message.className === "com.percero.agents.auth.vo.UserToken") {
												setStatus(true);
											} else if (message.data == "logout") {
												setStatus(false);
											}
										}

										if (message.cn) {
											// This message is of a particular class type, denoted by the field "cn".
											if (message.cn === "com.percero.agents.auth.vo.AuthenticateOAuthCodeResponse") {
												// AuthenticateOAuthResponse
												if (message.result
														&& message.result.clientId
														&& message.result.user
														&& message.result.user.id) {
													//alert("Authenticated as ClientID " + message.result.clientId + ", User " + message.result.user.id);
													clientId = message.result.clientId;
													userId = message.result.user.id;
													setStatus(true);
												} else {
													alert("Invalid authentication result");
													setStatus(false);
												}
											} else if (message.cn === "com.percero.agents.sync.vo.ConnectResponse") {
												// ConnectResponse.  The message.clientId should be equal to clientId received from the AuthentiateOAuthCodeResponse.
												if (message.clientId) {
													//alert("Connected as ClientID " + message.clientId);
													if (message.clientId !== clientId) {
														alert("Different ClientID Received!")
													} else {
														// Test GetAllByName
														var getAllRequest = setupGetAllByNameRequest("com.psiglobal.mo.CropType");
														socket
																.emit(
																		'getAllByName',
																		getAllRequest);
														getAllRequest = setupGetAllByNameRequest("com.psiglobal.mo.Company");
														socket
																.emit(
																		'getAllByName',
																		getAllRequest);
													}
												} else {
													alert("Invalid authentication result");
												}
											} else if (message.cn === "com.percero.agents.sync.vo.GetAllByNameResponse") {
												//alert("Received GetAllByNameResponse");
												for ( var i = 0; i < message.result.length; i++) {
													if (!dataCache[message.result[i].cn])
														dataCache[message.result[i].cn] = [];
													dataCache[message.result[i].cn][message.result[i].ID] = message.result[i];
													var _className = message.result[i].cn
															.replace(".",
																	"_");
													//	                		$('#div' + _className).html('<ul><li><span id="grp' + message.result[i].ID + '">ID: ' + message.result[i].ID + '</span></li><li><span id="name' + message.result[i].ID + '">Name: Loading...</span></li></ul>');

													if (message.result[i].accountingCompany) {
														$('#divObjects')
																.append(
																		'<div id="div' + _className + '"><ul><li><span id="grp' + message.result[i].ID + '">ID: '
																				+ message.result[i].ID
																				+ '</span></li><li><span id="name' + message.result[i].ID + '">Name: Loading...</span></li><li><div><span>Accounting Clients</span><ul id="accountingClients' + message.result[i].ID + '"/></div></li></ul></div>')
														var findById = setupFindById(
																message.result[i].accountingCompany.className,
																message.result[i].accountingCompany.ID);
														socket.emit(
																'findById',
																findById);
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
																					+ message.result[i].ID
																					+ '</span></li></ul></div>')
														}
													}
												}
											} else if (message.cn === "com.percero.agents.sync.vo.FindByIdResponse") {
												//alert("Received FindByIdResponse");

												if (!dataCache[message.result.cn])
													dataCache[message.result.cn] = {};
												if (!dataCache[message.result.cn][message.result.ID])
													dataCache[message.result.cn][message.result.ID] = message.result;

												if (message.result.cn === "com.psiglobal.mo.AccountingCompany") {
													if (dataCache[message.result.company.className]
															&& dataCache[message.result.company.className][message.result.company.ID]) {
														dataCache[message.result.company.className][message.result.company.ID].accountingCompany = message.result;
														message.result.company = dataCache[message.result.company.className][message.result.company.ID];
														console
																.log(message.result);
													}
													$(
															'#name'
																	+ message.result.company.ID)
															.html(
																	'Name: '
																			+ message.result.name);

													message.result.accountingClients
															.forEach(function(
																	nextAccountingClient) {
																var findById = setupFindById(
																		nextAccountingClient.className,
																		nextAccountingClient.ID);
																socket
																		.emit(
																				'findById',
																				findById);
															});
												} else if (message.result.cn === "com.psiglobal.mo.AccountingClient") {
													if (dataCache[message.result.accountingCompany.className]
															&& dataCache[message.result.accountingCompany.className][message.result.accountingCompany.ID]) {
														var accountingCompany = dataCache[message.result.accountingCompany.className][message.result.accountingCompany.ID];
														console
																.log(message.result);
														console
																.log(accountingCompany);
														for ( var i = 0; i < accountingCompany.accountingClients.length; i++) {
															if (accountingCompany.accountingClients[i].ID === message.result.ID) {
																accountingCompany.accountingClients[i] = message.result;
																console
																		.log("Appending AccountingClient to "
																				+ accountingCompany.company.ID);
																$(
																		'#accountingClients'
																				+ accountingCompany.company.ID)
																		.append(
																				'<li>'
																						+ message.result.name
																						+ '</li>');
																break;
															}
														}
														dataCache[message.result.accountingCompany.className][message.result.accountingCompany.ID].accountingCompany = message.result;
														message.result.accountingCompany = dataCache[message.result.accountingCompany.className][message.result.accountingCompany.ID];
														console
																.log(message.result);
													}
												} else {
													alert("TODO: Handle FindByIdResponse for type "
															+ message.result.cn);
												}
											} else if (message.cn === "com.percero.agents.sync.vo.PushUpdateResponse") {
												//alert("Received PushUpdateResponse");

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

															/*
															if (message.result.cn === "com.psiglobal.mo.AccountingCompany") {
																if (dataCache[message.result.company.className] && dataCache[message.result.company.className][message.result.company.ID]) {
																	dataCache[message.result.company.className][message.result.company.ID].accountingCompany = message.result;
																	message.result.company = dataCache[message.result.company.className][message.result.company.ID];
																	console.log(message.result);
																}
																$('#name' + message.result.company.ID).html('Name: ' + message.result.name);
																
																for(var i=0; i < message.result.accountingClients.length; i++) {
																	var findById = setupFindById(message.result.accountingClients[i].className, message.result.accountingClients[i].ID);
															   		socket.emit('findById', findById);
																}
															}
															else if (message.result.cn === "com.psiglobal.mo.AccountingClient") {
																if (dataCache[message.result.accountingCompany.className] && dataCache[message.result.accountingCompany.className][message.result.accountingCompany.ID]) {
																	var accountingCompany = dataCache[message.result.accountingCompany.className][message.result.accountingCompany.ID];
																	console.log(message.result);
																	console.log(accountingCompany);
																	for(var i=0; i < accountingCompany.accountingClients.length; i++) {
																		if (accountingCompany.accountingClients[i].ID === message.result.ID) {
																			accountingCompany.accountingClients[i] = message.result;
																			console.log("Appending AccountingClient to " + accountingCompany.company.ID);
																			$('#accountingClients' + accountingCompany.company.ID).append('<li>' + message.result.name + '</li>');
																			break;
																		}
																	}
																	dataCache[message.result.accountingCompany.className][message.result.accountingCompany.ID].accountingCompany = message.result;
																	message.result.accountingCompany = dataCache[message.result.accountingCompany.className][message.result.accountingCompany.ID];
																	console.log(message.result);
																}
															} else {
																alert("TODO: Handle FindByIdResponse for type " + message.result.cn);
															}
															 */
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
											}
										} else {
											alert("TODO: Handle un-classed message "
													+ message);
										}

									});
					socket.on('sync', function(message) {
						console.log('got SYNC message');
					});
					socket.on('disconnect', function() {
						console.log("disconnected from server");
						setStatus(false);
					});
					socket.on('gatewayConnectAck', function(message) {
						reconnectId = message;
						if ($.urlParam('code')) {
							login($.urlParam('code'));
						}
					});

					// Send Connect to Queue request.
					var connectRequest = {
						connect : 'connect'
					};
					socket.emit('message', connectRequest);
				});

function setStatus(inout) {
	if (inout) {
		$('#status').text('Logged In');
		$('#status').css('color', 'green');
	} else {
		$('#status').text('Logged Out');
		$('#status').css('color', 'red');
	}
}

function sendMessage() {
	var name = $('#message_name').attr('value');
	var body = {
		className : "com.percero.apps.PSIGlobal.Boundary",
		name : "Boundary 123",
		description : "Some descripive text",
		parent : {
			className : "com.percero.apps.PSIGlobal.Boundary",
			id : "36"
		},
		children : [ {
			className : "com.percero.apps.PSIGlobal.Boundary",
			id : "48"
		} ]
	};
	// Request that the server create the object and push it around
	socket.emit(name, body);
	console.log('sent message (' + name + ', ' + body + ')');
}

function loginClick() {
	var clientId = "764241383146.apps.googleusercontent.com";
	clientId = "535733965646-pum47htns1oo41fh8en4np013lo286d3.apps.googleusercontent.com";
	var redirectURL = "http://localhost:8080/client.html";

	window.location = "https://accounts.google.com/o/oauth2/auth?client_id="
			+ clientId
			+ "&access_type=offline&redirect_uri="
			+ redirectURL
			+ "&response_type=code&scope=https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email%20http://www.google.com/m8/feeds%20https://apps-apis.google.com/a/feeds/groups/";
	//  "https://accounts.google.com/o/oauth2/auth?client_id=" + clientId + "&access_type=offline&redirect_uri="+redirectURL+"&response_type=code&scope=https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email";
	//                	 https://accounts.google.com/o/oauth2/auth?client_id=764241383146.apps.googleusercontent.com&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email%20http://www.google.com/m8/feeds%20https://apps-apis.google.com/a/feeds/groups/
}

function login(code) {
	// Get the token
	var authReq = setupAuthenticateOAuthCodeRequest(code);
	socket.emit('authenticateOAuthCode', authReq);
	//            $.post('https://accounts.google.com/o/oauth2/token',
	//                    {
	//                        code:code,
	//                        client_id:"764241383146.apps.googleusercontent.com",
	//                        client_secret:"X--aWC4HNiYjdAdHbHcANXgc",
	//                        grant_type:"authorization_code"
	//                    }
	//                    ,function(postdata){
	//                        $.get('https://www.googleapis.com/oauth2/v1/userinfo?access_token='+postdata.access_token, function(getdata){
	//                            var userToken = {
	//                                className: "com.percero.agents.auth.vo.UserToken",
	//                                token: postdata.access_token,
	//                                user: {
	//                                    className: "com.percero.agents.auth.vo.User",
	//                                    id: getdata.id
	//                                }
	//                            };
	//
	//                             socket.emit('authenticateUserAccount',userToken);
	//                        });
	//
	//                    });
}

function logout() {
	socket.emit('logoutUser', {
		className : "com.percero.amqp.Person",
		data : {
			name : "Jonathan",
			nickname : "samps"
		}
	});
}