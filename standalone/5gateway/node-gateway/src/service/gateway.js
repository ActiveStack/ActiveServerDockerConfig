'use strict';

var Base = require('./base');
var io = require('socket.io');
var amqp = require('amqp');
var Client = require('./gateway/client');
var RedisStore = require('socket.io/lib/stores/redis');

module.exports = Gateway;

/**
 * This gateway program serves http requests for the browser client and
 * supporting files.  It also serves as the real-time socket connection for all
 * clients using the socket.io (websockets) protocol.
 *
 * @param httpServer (required)
 * @param properties
 * @param logger (required)
 * @param callbacks	(required)	Object that requires the following functions to be defined: createErrorHandler, sendMessage, catchAndWarn
 */
function Gateway(httpServer, properties, ssl, logger, callbacks) {
	Base.call(this);	// Gateway extends Base

	// Validate input parameters
	if (!httpServer) {
	    throw new Error('Gateway httpServer is required!');
	}
	if (!logger) {
	    throw new Error('Gateway logger is required!');
	}
	if (!callbacks) {
	    throw new Error('Gateway callbacks is required!');
	}
	else {
		if (!callbacks.createErrorHandler) {
		    throw new Error('Gateway callbacks.createErrorHandler is required!');
		}
		if (!callbacks.sendMessage) {
		    throw new Error('Gateway callbacks.sendMessage is required!');
		}
		if (!callbacks.catchAndWarn) {
		    throw new Error('Gateway callbacks.catchAndWarn is required!');
		}
	}

	var createErrorHandler = callbacks.createErrorHandler;

	// Prepare RedisStore for Socket.IO sessions
	var redisOptions = {
		host: properties['gateway.redis.host'],
		port: properties['gateway.redis.port'],
		max_attempts: properties['gateway.redis.max_attempts'],
		enable_offline_queue: properties['gateway.redis.offline_queue'] == 'true'
	};
	var redisStore = new RedisStore({
		redisPub: redisOptions,
		redisSub: redisOptions,
		redisClient: redisOptions
	});
	redisStore.pub.auth(properties['gateway.redis.password']);
	redisStore.sub.auth(properties['gateway.redis.password']);
	redisStore.cmd.auth(properties['gateway.redis.password']);
	attachRedisErrorHandlers('Publisher', redisStore.pub);
	attachRedisErrorHandlers('Subscriber', redisStore.sub);
	attachRedisErrorHandlers('Client', redisStore.cmd);

	// Setup Socket.IO
	var sio = undefined;
	if (ssl) {
       sio = io.listen(httpServer, { logger: logger.extendPrefix('socket.io'), key: ssl.key, cert: ssl.cert, ca: ssl.ca });
	}
	else {
		sio = io.listen(httpServer, { logger: logger.extendPrefix('socket.io') });
	}
	sio.configure(function() {
		sio.set('heartbeat timeout', properties['gateway.socketio.timeout']);
		sio.set('heartbeat interval', properties['gateway.socketio.interval']);
		sio.set('transports', ['websocket', 'flashsocket']);
		sio.set('store', redisStore);
	});

	// Start the Flash Policy Server
	sio.flashPolicyServer.on('error', createErrorHandler('Flash Policy Server'));

	var sockets = {};
    var clients = {};

	var rabbitmq;
	// Setup connection to RabbitMQ
	var setupRabbitMq = function() {
		rabbitmq = amqp.createConnection({
			host: properties['gateway.rabbitmq.host'],
			port: properties['gateway.rabbitmq.port'],
			login: properties['gateway.rabbitmq.login'],
			password: properties['gateway.rabbitmq.password']
		});

		rabbitmq.on('ready', function () {
			var durable = properties['gateway.rabbitmq.durable'] == 'true';
			var options = {autoDelete: false, durable: durable, confirm: true};
			var exchange = rabbitmq.exchange('', options);

			exchange.on('error', function () {
				createErrorHandler('RabbitMQ Exchange')
			});

			// Handles a new client socket connection.
			sio.sockets.on('connection', function (socket) {
				sockets[socket.id] = socket;
				logger.info('Connected clients: ' + Object.keys(sockets).length);
				try {
					callbacks.sendMessage({command: 'clientQueueLength', data: Object.keys(sockets).length});
				} catch (error) {
				}

				var socketEndHandler = function (isServerTerminated) {
					var client = clients[socket.id];
					if (client) {
						client.isServerTerminated = isServerTerminated;
					}
					socket.removeListener('logout', socketLogoutHandler);
					socket.removeListener('disconnect', socketDisconnectHandler);
					socket.disconnect();
					delete sockets[socket.id];

					if (client) {
						client.removeListener('dispose', clientDisposeHandler);
						client.dispose();
					}
					delete clients[socket.id];
					logger.info('[End] Connected clients: ' + Object.keys(sockets).length);
					try {
						callbacks.sendMessage({
							command: 'clientQueueLength',
							data: (!sockets || Object.keys(sockets).length <= 0) ? 0 : Object.keys(sockets).length
						});
					} catch (error) {
					}
				};

				var socketDisconnectHandler = function (reason, isServerTerminated) {
					logger.verbose('Socket Disconnected, reason: ' + reason + ', Server Terminated: ' + (isServerTerminated ? 'TRUE' : 'FALSE'));
					socketEndHandler(isServerTerminated);
					logger.info('[Disconnect] Connected clients: ' + Object.keys(sockets).length);
				};
				socket.on('disconnect', socketDisconnectHandler);

				var socketLogoutHandler = function (isServerTerminated) {
					socketEndHandler(isServerTerminated);
					logger.info('[Logout] Connected clients: ' + Object.keys(sockets).length);
				};
				socket.on('logout', socketLogoutHandler);

				var newClient = new Client(socket, exchange, rabbitmq, logger, properties);
				clients[socket.id] = newClient;

				var clientDisposeHandler = function (isServerTerminated) {
					// The client has had some issue which makes it no longer valid so it needs to be disposed of.
					socketDisconnectHandler('Client Disposed', isServerTerminated);
				};
				newClient.on('dispose', clientDisposeHandler);
			});
		});

		rabbitmq.on('error', function () {
			createErrorHandler('RabbitMQ');
		});
	};

	setupRabbitMq();

	this.disposeOfClient = function(theClient) {
		if (!theClient || !theClient.socket) {
			logger.warn("Unable to disposeOfClient, no Client/Client.Socket");
			return;
		}

		theClient.socket.removeListener('logout', socketLogoutHandler);
		theClient.socket.removeListener('disconnect', socketDisconnectHandler);
		theClient.socket.disconnect();
		delete sockets[theClient.socket.id];

		theClient.dispose();
		delete clients[theClient.socket.id];
		logger.info('[Logout] Connected clients: ' + Object.keys(sockets).length);
		try {
			callbacks.sendMessage({command: 'clientQueueLength', data: (!sockets || Object.keys(sockets).length <= 0) ? 0 : Object.keys(sockets).length});
		} catch(error) {}
	};

	this.handleError = function(error, source) {
		var catchAndWarn = callbacks.catchAndWarn;

		catchAndWarn('RabbitMQ', function() { rabbitmq.end(); });

		trapRedisCleanup('Publisher', redisStore.pub);
		trapRedisCleanup('Subscriber', redisStore.sub);
		trapRedisCleanup('Client', redisStore.cmd);

		catchAndWarn('Flash Policy Server', function() {
			sio.flashPolicyServer.close();
		});

		catchAndWarn('Socket IO clients', function() {
			Object.keys(sockets).forEach(function(id) {
				sockets[id].disconnect();
			});
		});
	};
	
	this.handleShutdown = function(shutdownType) {
		logger.info('Closing down Socket IO Server');
		
		var catchAndWarn = callbacks.catchAndWarn;

		catchAndWarn('Socket IO Server', function() {
			sio.server.close();
		});
	};

	// RedisClient resists proper error handling :-(
	function attachRedisErrorHandlers(type, redis) {
		var handler = createErrorHandler('Redis Store ' + type);
		redis.on('error', handler);

		// If the server shuts down we get an "end" instead of an error.
		redis.on('end', handler.bind(null, { stack: 'Unexpected close.' }));
	};

	// RedisClient resists proper error handling :-(
	function trapRedisCleanup(type, redis) {
		callbacks.catchAndWarn('Redis Store ' + type, function() {
			redis.end();  // This call wipes all event handlers!
			redis.stream.on('error', function(error) {
				logger.warn('Error disconnecting Redis Store ' + type + ' (' +
						error.toString() + ')');
			});
		});
	};
}	
