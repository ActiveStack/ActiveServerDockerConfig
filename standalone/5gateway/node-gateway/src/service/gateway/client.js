'use strict';

var Session = require('./session');
var Auth = require('./agent_adapter/auth');
var sys = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = GatewayClient;

// Client extends EventEmitter
GatewayClient.prototype.__proto__ = EventEmitter.prototype;

/**
 * @class Manages a socket.io connection to a single client.  Shuttles requests
 * to the appropriate agent, and returns responses as they appear on the client
 * queue.
 *
 * @param socket Connection to socket.io client.
 * @param exchange Connection to agent queues.
 * @param rabbitmq Active connection to establish client response queue.
 * @param logger Winston instance.
 * @param properties Properties
 */
function GatewayClient(socket, exchange, rabbitmq, logger, properties) {
	logger = logger.extendPrefix(socket.id);
	logger.verbose('New GatewayClient for socket.');
    var self = this;

	var session = new Session(logger);	// Client's session, which also defines client's session ID (reconnectId)

	var agents = [];	// List of agents registered by this client.

	// Callbacks injected into each agent.
	var agentCallbacks = {
		registerAgent: delayCallback(registerAgent),
		unregisterAgent: delayCallback(unregisterAgent),
		sendToClient: sendToClient,
		sendToAgent: sendToAgent
	};

	var awaitingResponseAcks = {};	// Holds callback functions for client message ACK's.
	var awaitingResponseAcksInterval = {};	// Message ACK Intervals for client message re-sends.
	var clientQueue;	// Client RabbitMQ Queue

    /**
     * Cleanup this object for disposal.
     */
    this.dispose = function() {
        // Clear Awaiting Response Acks Intervals
        if (awaitingResponseAcksInterval) {
            for(var key in awaitingResponseAcksInterval) {
                if (awaitingResponseAcksInterval.hasOwnProperty(key)) {
                    var theInterval = awaitingResponseAcksInterval[key];
                    logger.verbose('Clearing interval: ', theInterval);
                    try {
                        clearInterval(theInterval);
                    } catch(error) { /* Do nothing on failure here */ }
                }
            }
            awaitingResponseAcksInterval = {};
        }

        // Clear Awaiting Response Acks
		awaitingResponseAcks = {};

        // Send disconnect to agents
		agents.forEach(function(agent) {
			if (self.isServerTerminated) {
				// This is a "known" termination
				agent.processSpecialMessage('disconnect', 'server terminated');
			}
			else {
				// This is an unexpected termination
				agent.processSpecialMessage('disconnect', 'socket end');
			}
		});

		// Unregister Agents
        if (agents) {
            for(var i=0; i<agents.length; i++) {
                var nextAgent = agents[i];
                try {
                    unregisterAgent(nextAgent.getCNPrefix());
                } catch(error) { /* Do nothing on failure here */ }
            }

            agents = [];
        }

        // Close down the Client Queue
        if (clientQueue) {
            if (clientQueue.state == 'open') {
                try {
                    clientQueue.close();
                } catch (error) {
                    logger.verbose('Unable to close clientQueue ' + clientQueue);
                }
            }
            clientQueue = undefined;
        }

        // NOTE: The socket will be closed down outside of this class.
    };

	/**
	 * SpecialMessageHandles - When the client receives a "special" message from the client, this defines how to process/handle
	 *	that message.
	 *	- ack 			Look for the corresponding ACK and acknowledge the message. Clear and remove any interval associated with the message.
	 *	- connect 		Register new Auth agent and response queue (RabbitMQ Queue) for the client
	 *	- disconnect 	Dispose of self (client)
	 *	- hibernate		NOOP
	 *	- logout 		NOOP
	 *	- reconnect 	Attempt to initialize self using previous client settings, but with new client ID.
	 *
	 * TODO: Simplify this API down to connect and disconnect only.
	 */
	var specialMessageHandlers = {
		ack: function(message) {
			var ack = awaitingResponseAcks[message.correspondingMessageId];
			if (!ack) {
				// We typically get here when:
				//	We re-sent the message because the client did not ACK in time, but in the meantime the client DID ACK and thus the re-send turned out to be superfluous.
				logger.warn('Unexpected response ack: ', message.correspondingMessageId);
			}
			else {
				ack(message.correspondingMessageId);
				delete awaitingResponseAcks[message.correspondingMessageId];
			}

			var theInterval = awaitingResponseAcksInterval[message.correspondingMessageId];
			if (theInterval) {
				try {
					clearInterval(theInterval);
				} catch(error) {
					// If clearing the interval fails for whatever reason, we really don't care and want to move on.
				}
			}
			delete awaitingResponseAcksInterval[message.correspondingMessageId];
		},
		connect: function(message) {
			if (clientQueue) {
				logger.warn('CONNECT: Client is already connected.');
				return;
			}

			registerAgent(new Auth(session, logger, agentCallbacks));
			registerResponseQueue();
		},
		disconnect: function(message) {
			if (!clientQueue) {
				logger.warn('Client is not connected.');
			}

            self.dispose();
		},
		hibernate: function(message) {
			// Agent adapters handle this event.
		},
		logout: function(message) {
			// Agent adapters handle this event.
		},
		reconnect: function(message) {
			if (clientQueue) {
				logger.warn('RECONNECT: Client is already connected, disposing and then attempting reconnect');

				// Need to unregister agents and disengage existing clientQueue.
				self.dispose();
			}

			// The reconnectId is an encoded string that should contain all required details to re-establish the
			//	session, including the previous ClientID, which we save and then swap out for the new/current ClientID
			var newClientId = session.clientId;
			session.load(message.reconnectId);	// Decrypts the reconnectId
			if (!session.existingClientIds) {
				session.existingClientIds = [];
			}

			// Setup the existing/previous client id(s)
			var oldClientId = session.clientId;
			if (!oldClientId) {
				logger.error("No previous ClientID on reconnect");
			}
			else {
				session.existingClientId = oldClientId;
				session.existingClientIds.push(oldClientId);
			}
			session.clientId = newClientId;
			specialMessageHandlers.connect(message);
		}
	};


	///////////////////////////////////
	//	Socket Handlers
	///////////////////////////////////

	/**
	 * MESSAGE
	 */
	socket.on('message', function(message) {
		Object.keys(message).forEach(function(type) {
			routeSpecialMessage(type, message[type]);
		});
	});

	/**
	 * LOGOUT
	 */
	socket.on('logout', routeSpecialMessage.bind(this, 'logout'));

	/**
	 * DISCONNECT
	 */
	socket.on('disconnect', routeSpecialMessage.bind(this, 'disconnect'));

	/**
	 * ERROR
	 */
	socket.on('error', createErrorHandler('client socket'));


	///////////////////////////////////
	//	Helper Functions
	///////////////////////////////////
	/**
	 * routeSpecialMessage - If a specialMessageHandler is defined for the message type:
	 *	1. Pipe this message to that handler
	 *	2. Forward the message on to each agent for further processing
	 */
	function routeSpecialMessage(type, message) {
		if (specialMessageHandlers[type]) {
			logger.verbose('Handling special message: ' + type + ' / ' + message);
			specialMessageHandlers[type](message);
			agents.forEach(function(agent) {
				agent.processSpecialMessage(type, message);
			});
			sendSession();
		}	else {
			logger.warn('Ignoring unknown message type: ' + type);
		}
	};

	/**
	 * sendSession - Sends an updated session reconnectId String to the client. This string is used for reconnecting the client.
	 */
	function sendSession() {
		session.save(function(signedSession) {
			logger.verbose('Sending session to client.');
			sendToClient('gatewayConnectAck', signedSession);
		});
	};

	/**
	 * findAgentForMessage - Given a message, searches for agent(s) that handle that type of message. The message
	 *	type is determined by its `cn` property.
	 */
	function findAgentForMessage(message, callback) {
		agents.forEach(function(agent) {
			var cnPrefixRegex = agent.getCNPrefixRegex();
            try {
                if (message.cn.match(cnPrefixRegex)) {
                    var relativeName = message.cn.replace(cnPrefixRegex, '');
                    callback(agent, relativeName, message);
                }
            } catch(error) {
            	logger.error(error);
                if (message) {
                    try {
                        logger.error('Invalid message: ' + JSON.stringify(message));
                    } catch(error1) {
                        logger.error('Invalid message: UNKNOWN');
                    }
                }
                else {
                    logger.error('Invalid message: undefined');
                }
            }
		});
	};

	/**
	 * registerResponseQueue - Sets up a new RabbitMQ Queue for this client, using the session.clientId as the
	 *	name for the queue. Once the queue is setup, subscribes to the queue. This queue is for messages from the 
	 *	Percero back-end that are intended for the client.
	 */
	function registerResponseQueue() {
		logger.verbose('Setting up rabbit queue ' + session.clientId);
		clientQueue = rabbitmq.queue(session.clientId, exchange.options, function(queue) {
			var options = { ack: true, prefetchCount: 10 };

			// Setup subscription to the new queue.
			queue.subscribe(options, function(response, headers, info, receipt) {
				if (!response) {
					logger.error("NULL response in client.registerResponseQueue:");
					sys.puts("headers: ");
					sys.puts(sys.inspect(headers));
					sys.puts("info: ");
					sys.puts(sys.inspect(info));
					sys.puts("receipt: ");
					sys.puts(sys.inspect(receipt));
					return;
				}

				if (response.EOL) {
					// This is an End-Of-Life message for this queue.
					// If the response clientId does NOT match the current session clientId, then this client has
					//	already moved on and nothing needs to happen here. This typically happens when a client
					//	reconnects from the same network/IP address/router.
					if (response.clientId && response.clientId !== session.clientId) {
						logger.verbose('Ignoring EOL message for ' + response.clientId + ' -> ' + session.clientId);
						return;
					}
					else {
						// This client is no longer valid. This typically happens when a client reconnects
						//	from a different network/IP address/router.
						logger.verbose('Received EOL for queue ' + session.clientId);
						self.isServerTerminated = true;
						self.dispose();
						self.emit('dispose', true);
						return;
					}
				}

				logger.verbose('Sending response: ' + response.cn);
				// logger.verbose('Response info: ', info);
				// logger.verbose('Response details: ', response);
				
				if (!clientQueue) {
					logger.warn('Bailing on response; queue is already closed.');
					return;
				}

				findAgentForMessage(response, function(agent, relativeName, response) {
					agent.processResponse(relativeName, response);
				});

				sendSession();	// Send the updated session to the client.
				if (response.correspondingMessageId) {
					awaitingResponseAcks[response.correspondingMessageId] = function() {
						receipt.acknowledge();
					};
					
					// Set timer to re-send message.
					(function(theResponse) {
						awaitingResponseAcksInterval[theResponse.correspondingMessageId] = setInterval(
							function() {
								var ack = awaitingResponseAcks[theResponse.correspondingMessageId];
								if (ack) {
									logger.warn('Unacknowledged message being sent again: ', theResponse.correspondingMessageId);
									sendToClient('push', theResponse);
								}
								else {
									var theInterval = awaitingResponseAcksInterval[theResponse.correspondingMessageId];
									if (theInterval) {
										logger.verbose('Message acknowledged, clearing timer.');
										clearInterval(theInterval);
									}
									delete awaitingResponseAcksInterval[theResponse.correspondingMessageId];
								}
							},
							(properties['frontend.clientMessageResendInterval'] || 7500)
						);
					}) (response);
					
				} else {
					receipt.acknowledge();
				}
				sendToClient('push', response);
			});
		})

		.on('close', function(){
			// This client is no longer valid because the RabbitQueue has closed.
			logger.verbose('Rabbit Queue Closed: ' + session.clientId);
			self.dispose();
			self.emit('dispose');
		})

		.on('delete', function(){
			// This client is no longer valid because the RabbitQueue has been deleted.
			logger.verbose('Rabbit Queue Deleted: ' + session.clientId);
			self.dispose();
			self.emit('dispose');
		})

		.on('error', createErrorHandler('client queue'));
	};

	/**
	 * registerAgent - Add agent to list of agents, setting up listeners for each event type the agent handles.
	 *	Unregister the agent first in case it is already registered.
	 */
	function registerAgent(agent) {
		unregisterAgent(agent.getCNPrefix());
		agents.push(agent);
		logger.verbose('Added agent: ' + agent.getCNPrefix());

		// Add a listener for each event type that this Agent handles, as defined in agent.getEvents().
		agent.getEvents().forEach(function(eventName) {
			socket.on(eventName, function(request) {
				if (request !== undefined) {
					logger.verbose('Got request (' + eventName + ')');
					logger.verbose('Request details: ', request);
					findAgentForMessage(request, function(agent, relativeName, request) {
						agent.processRequest(relativeName, request);
					});

					if (!sendToAgent(eventName, request) ) {
                        logger.error('Error sending message to agent: ' + error);
                    }
                    else {
                        if (request.sendAck) {
                            logger.verbose('Request has sendAck, sending "ack" to client');
                            sendToClient('ack', request.messageId);
                        }
                    }
				}
				else {
					logger.error("Received undefined request");
				}
			});
		});
	};

	/**
	 * unregisterAgent - Find the agent in the list of agents and remove all socket listeners that pertain to the agent.
	 *	Then remove agent from list of agents.
	 */
	function unregisterAgent(cnPrefix) {
		agents = agents.filter(function(agent) {
			if (agent.getCNPrefix() == cnPrefix) {
				logger.verbose('Removing agent: ' + agent.getCNPrefix());

				// Remove listener for each event type that this Agent handles, as defined in agent.getEvents().
				agent.getEvents().forEach(function(eventName) {
					socket.removeAllListeners(eventName);
				});

				//  No longer include this agent in the list of agents, thus return FALSE to the filter.
				return false;
			}
			else {
				// This agent is NOT the one we want to get rid of, therefore keep it included in the list of agents.
				return true;
			}
		});
	};

	/**
	 * sendToAgent - Send the message to the specified agent via RabbitMQ client queue.  If the message.clientId
	 *	is different than the session.clientId, update the message.clientId to match the session.clientId. This is
	 *	an enabler for legacy clients that are unable to update their clientId upon reconnect.
	 */
	function sendToAgent(name, message, callback) {
		logger.verbose( 'Sending to agent (' + name + '): ', JSON.stringify(message) );
        if (!exchange) {
        	// The RabbitMQ Exchange is dead, we can no longer function...
            logger.error('No Rabbit Exchange to Send Messages To!!!');
			self.dispose();
			self.emit('dispose');
            return false;
        }
        else {
			// If the exchange is closed, then need to inform the client that this is no longer a valid session.
			if (exchange.state === 'closed') {
				logger.verbose('Rabbit Exchange Closed: ' + exchange.id);
				self.dispose();
				self.emit('dispose');
				return false;
			}
			else {
				if (message.clientId && message.clientId !== session.clientId) {
					// The message's clientId does not match the session's clientId.  This typically happens after a device has reconnected
					//	and the client library does not update to it's new clientId.
					logger.verbose('Message client ' + message.clientId + ' is different than Session client ' + session.clientId);
					message.clientId = session.clientId;
				}

				// Publish the message to the queue.
				var task = exchange.publish(name, message, {
					replyTo: session.clientId,
					mandatory: true,
					confirm: true
				}, callback);
				return true;
			}
        }
	};

	/**
	 * sendToClient - Send the message to the client via the socket connection.
	 */
	function sendToClient(name, message) {
		logger.verbose('Sending to client (' + name + '): ', message);
		socket.emit(name, message);
	};

	function createErrorHandler(source) {
		return function(error) {
			logger.error('Fatal ' + source + ' error: ', error.stack);

			socket.disconnect();
			try {
				clientQueue.close();
				clientQueue = undefined;
			} catch(error) {
				logger.error('Error disconnecting client queue: ', error);
			}
		};
	};

	function delayCallback(callback) {
		return function() {
			var callbackContext = this;
			var callbackArguments = arguments;
			process.nextTick(function() {
				callback.apply(callbackContext, callbackArguments);
			});
		};
	};
}
