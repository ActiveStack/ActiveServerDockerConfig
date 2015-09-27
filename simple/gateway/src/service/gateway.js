'use strict';

var io = require('socket.io');
var amqp = require('amqp');
var Client = require('./client');
var RedisStore = require('socket.io/lib/stores/redis');

module.exports = Gateway;
/**
 * TODO: Refactor out the callbacks
 */

/**
 * This gateway program serves http requests for the browser client and
 * supporting files.  It also serves as the real-time socket connection for all
 * clients using the socket.io (websockets) protocol.
 *
 * @param httpServer (required)
 * @param properties
 * @param ssl - SSL configuration object. Will hold private key, etc.
 * @param logger (required)
 * @param callbacks	(required)	Object that requires the following functions to be defined: createErrorHandler, sendMessage, catchAndWarn
 */
function Gateway(httpServer, properties, ssl, logger, callbacks) {

    this.httpServer     = httpServer;
    this.properties     = properties;
    this.ssl            = ssl;
    this.logger         = logger;
    this.callbacks      = callbacks;
    this.createErrorHandler = callbacks.createErrorHandler;

    this.rabbitmq       = null;
    this.exchange       = null;
    this.sio            = null;
    this.redisStore     = null;
    this.redisStore     = null;
    this.sockets        = {};
    this.clients        = {};

    this.validateParams();

    this.initRedis();
    this.initSocketIO();
    this.initRabbitMQ();
}

/**
 * Validate input parameters
 */
Gateway.prototype.validateParams = function() {

    if (!this.httpServer) {
        throw new Error('Gateway httpServer is required!');
    }
    if (!this.logger) {
        throw new Error('Gateway logger is required!');
    }
    if (!this.callbacks) {
        throw new Error('Gateway callbacks is required!');
    }
    else {
        if (!this.createErrorHandler) {
            throw new Error('Gateway callbacks.createErrorHandler is required!');
        }
        if (!this.callbacks.sendMessage) {
            throw new Error('Gateway callbacks.sendMessage is required!');
        }
        if (!this.callbacks.catchAndWarn) {
            throw new Error('Gateway callbacks.catchAndWarn is required!');
        }
    }
};

Gateway.prototype.initRedis = function() {
    // Prepare RedisStore for Socket.IO sessions
    var redisOptions = {
        host: this.properties['gateway.redis.host'],
        port: this.properties['gateway.redis.port'],
        //host: process.env.REDIS_PORT_6379_TCP_ADDR,
        //port: process.env.REDIS_PORT_6379_TCP_PORT,
        max_attempts: this.properties['gateway.redis.max_attempts'],
        enable_offline_queue: this.properties['gateway.redis.offline_queue'] == 'true'
    };

    this.redisStore = new RedisStore({
        redisPub: redisOptions,
        redisSub: redisOptions,
        redisClient: redisOptions
    });

    this.redisStore.pub.auth(this.properties['gateway.redis.password']);
    this.redisStore.sub.auth(this.properties['gateway.redis.password']);
    this.redisStore.cmd.auth(this.properties['gateway.redis.password']);

    this.attachRedisErrorHandlers('Publisher', this.redisStore.pub);
    this.attachRedisErrorHandlers('Subscriber', this.redisStore.sub);
    this.attachRedisErrorHandlers('Client', this.redisStore.cmd);
};

Gateway.prototype.initSocketIO = function() {
    // Setup Socket.IO

    if (this.ssl) {
        this.sio = io.listen(this.httpServer, {
            logger: this.logger.extendPrefix('socket.io'),
            key: this.ssl.key,
            cert: this.ssl.cert,
            ca: this.ssl.ca
        });
    }
    else {
        this.sio = io.listen(this.httpServer, {logger: this.logger.extendPrefix('socket.io')});
    }
    this.sio.configure(function () {
        this.sio.set('heartbeat timeout', this.properties['gateway.socketio.timeout']);
        this.sio.set('heartbeat interval', this.properties['gateway.socketio.interval']);
        this.sio.set('transports', ['websocket', 'flashsocket']);
        this.sio.set('store', this.redisStore);
    }.bind(this));

    // Start the Flash Policy Server
    this.sio.flashPolicyServer.on('error', this.createErrorHandler('Flash Policy Server'));
};

/**
 * Initialize RabbitMQ connection
 */
Gateway.prototype.initRabbitMQ = function() {
    this.rabbitmq = amqp.createConnection({
        host: this.properties['gateway.rabbitmq.host'],
        port: this.properties['gateway.rabbitmq.port'],
        //host: process.env.RABBITMQ_1_PORT_5672_TCP_ADDR,
        //port: process.env.RABBITMQ_1_PORT_5672_TCP_PORT,
        login: this.properties['gateway.rabbitmq.login'],
        password: this.properties['gateway.rabbitmq.password']
    });

    this.rabbitmq.on('ready', this.onRabbitReady.bind(this));
};

Gateway.prototype.onRabbitReady = function () {
    var durable = this.properties['gateway.rabbitmq.durable'] == 'true';
    var options = {autoDelete: false, durable: durable, confirm: true};
    this.exchange = this.rabbitmq.exchange('', options);

    this.exchange.on('error', this.createErrorHandler('RabbitMQ Exchange'));

    // Handles a new client socket connection.
    this.sio.sockets.on('connection',this.onSocketConnection.bind(this));

    this.rabbitmq.on('error', this.createErrorHandler('RabbitMQ'));
}

Gateway.prototype.onSocketEnd = function (socket, isServerTerminated) {
    var client = this.clients[socket.id];
    if (client) {
        client.isServerTerminated = isServerTerminated;
    }

    socket.removeAllListeners('logout');
    socket.removeAllListeners('disconnect');

    delete this.sockets[socket.id];

    if (client) {
        client.removeAllListeners('dispose');
        client.dispose();
    }

    delete this.clients[socket.id];

    this.logger.info('[End] Connected clients: ' + Object.keys(this.sockets).length);
    try {
        this.callbacks.sendMessage({
            command: 'clientQueueLength',
            data: (!this.sockets || Object.keys(this.sockets).length <= 0) ? 0 : Object.keys(this.sockets).length
        });
    } catch (error) {}
};

Gateway.prototype.onSocketDisconnect = function (socket, reason, isServerTerminated) {
    this.logger.info('Socket Disconnected, reason: ' + reason + ', Server Terminated: ' + (isServerTerminated ? 'TRUE' : 'FALSE'));
    this.onSocketEnd(socket, isServerTerminated);
    this.logger.info('[Disconnect] Connected clients: ' + Object.keys(this.sockets).length);
};

Gateway.prototype.onSocketLogout = function (socket, isServerTerminated) {
    this.logger.info('[Logout] Connected clients: ' + Object.keys(this.sockets).length);
    socket.disconnect('Client Logout');
};

Gateway.prototype.onClientDispose = function (socket, isServerTerminated) {
    // The client has had some issue which makes it no longer valid so it needs to be disposed of.
    //this.onSocketDisconnect(socket, 'Client Disposed', isServerTerminated);
    socket.disconnect();
};

/**
 * TODO: Move logout, disconnect handlers to Client
 * @param socket
 */
Gateway.prototype.onSocketConnection = function (socket) {
    this.sockets[socket.id] = socket;
    this.logger.info('Connected clients: ' + Object.keys(this.sockets).length);

    try {
        this.callbacks.sendMessage({command: 'clientQueueLength', data: Object.keys(this.sockets).length});
    } catch (error) {}

    socket.on('disconnect', this.onSocketDisconnect.bind(this, socket));
    socket.on('logout', this.onSocketLogout.bind(this, socket));

    var newClient = new Client(socket, this.exchange, this.rabbitmq, this.logger, this.properties);
    this.clients[socket.id] = newClient;

    newClient.on('dispose', this.onClientDispose.bind(this, socket));
};


Gateway.prototype.handleError = function(error, source) {
    var catchAndWarn = this.callbacks.catchAndWarn;

    catchAndWarn('RabbitMQ', function() { this.rabbitmq.end();}.bind(this));

    this.trapRedisCleanup('Publisher', this.redisStore.pub);
    this.trapRedisCleanup('Subscriber', this.redisStore.sub);
    this.trapRedisCleanup('Client', this.redisStore.cmd);

    catchAndWarn('Flash Policy Server', function() {
        this.sio.flashPolicyServer.close();
    }.bind(this));

    catchAndWarn('Socket IO clients', function() {
        Object.keys(this.sockets).forEach(function(id) {
            this.sockets[id].disconnect();
        }.bind(this));
    }.bind(this));
};
	
Gateway.prototype.onShutdown = function(shutdownType) {
    this.logger.info('Closing down Socket IO Server');

    var catchAndWarn = this.callbacks.catchAndWarn;

    catchAndWarn('Socket IO Server', function() {
        this.sio.server.close();
    }.bind(this));
};

	// RedisClient resists proper error handling :-(
Gateway.prototype.attachRedisErrorHandlers = function(type, redis) {
    var handler = this.callbacks.createErrorHandler('Redis Store ' + type);
    redis.on('error', handler);

    // If the server shuts down we get an "end" instead of an error.
    redis.on('end', handler.bind(null, { stack: 'Unexpected close.' }));
};

// RedisClient resists proper error handling :-(
Gateway.prototype.trapRedisCleanup = function(type, redis) {
    this.callbacks.catchAndWarn('Redis Store ' + type, function() {
        redis.end();  // This call wipes all event handlers!
        redis.stream.on('error', function(error) {
            this.logger.warn('Error disconnecting Redis Store ' + type + ' (' +
            error.toString() + ')');
        });
    }.bind(this));
};

