'use strict';

var fs = require('fs');
var https = require('https');
var http = require('http');

module.exports = GatewayWorker;

function GatewayWorker(logger, properties){
    this.logger = logger;
    this.properties = properties;
    this.useSsl = false;
    this.ssl = null;
    this.httpServer = null;
    this.currentClientQueueLength = 0;
    this.exiting = false;
    this.restartOnClientQueueEmpty = false;
    this.stopOnClientQueueEmpty = false;

    this.init();
}

GatewayWorker.prototype.init = function(){
    this.initSSL();
    this.initHttpServer();
    this.initServices();
};

GatewayWorker.prototype.initHttpServer = function(){
    var httpServer;
    if(!this.useSsl){
        httpServer = http.createServer(this.app);
    }
    else {
        httpServer = https.createServer(this.ssl, this.app);
    }

    httpServer.on('error', this.createErrorHandler('HTTP Server'));
    this.httpServer = httpServer;
};

GatewayWorker.prototype.initServices = function(){
    var Gateway = require('./service/gateway');
    //var Upload = require('./service/upload');

    var callbacks = {
        createErrorHandler: this.createErrorHandler.bind(this),
        catchAndWarn: this.catchAndWarn.bind(this),
        isExiting: this.isExiting.bind(this),
        sendMessage: this.receiveMessage.bind(this)
    };

    this.services = [
        new Gateway(this.httpServer, this.properties, this.ssl, this.logger, callbacks)
    ];
};

GatewayWorker.prototype.initSSL = function(){
    var useSsl = this.properties['frontend.ssl'];
    if (useSsl && (useSsl === 'true' || useSsl === 't' || useSsl === '1' || useSsl === 1)) {
        useSsl = true;
    }
    else {
        useSsl = false;
    }

    var ssl;
    if (useSsl) {
        try {
            var privateKey = fs.readFileSync(__dirname + '/../ssl/psiinformatics.com.private.key').toString();
            var certificate = fs.readFileSync(__dirname + '/../ssl/psiinformatics.com.crt').toString();
            var ca = fs.readFileSync(__dirname + '/../ssl/psiinformatics.com.csr').toString();
            ssl = {
                key: privateKey,
                cert: certificate,
                ca: ca
            };
        } catch (error) {
            useSsl = false;
            this.logger.info('NOT using SSL');
            this.logger.error(error);
        }
    }

    this.ssl = ssl;
    this.useSsl = useSsl;
};

GatewayWorker.prototype.isExiting = function(){
    return this.exiting;
};

GatewayWorker.prototype.checkMemoryUsage = function () {
    var memoryUsage = process.memoryUsage();
    var megabyte = 1024 * 1024;
    for (var type in memoryUsage) {
        var limit = this.properties['cluster.memoryLimit.' + type];
        var warning = this.properties['cluster.memoryWarning.' + type];
        if (limit && (memoryUsage[type] > limit * megabyte)) {
            this.logger.error('Worker exceeded hard ' + type + ' memory limit (' +
            memoryUsage[type] + '/' + limit * megabyte + ')!');
        }
        if (warning && (memoryUsage[type] > warning * megabyte)) {
            this.logger.warn('Worker exceeded soft ' + type + ' memory limit (' +
            memoryUsage[type] + '/' + warning * megabyte + ')!');
        }
    }
};

GatewayWorker.prototype.receiveMessage = function(message) {
    this.logger.debug('Received message from service');
    if (message) {
        if (message.command === 'clientQueueLength') {
            this.currentClientQueueLength = message.data;
            if (this.restartOnClientQueueEmpty && this.currentClientQueueLength <= 0) {
                this.logger.info('Client Queue is Empty: RESTARTING');
                process.send({command: 'restart'});
            }
            else if (this.stopOnClientQueueEmpty && this.currentClientQueueLength <= 0) {
                this.logger.info('Client Queue is Empty: STOPPING');
                process.send({command: 'stop'});
            }
        }
    }
};

GatewayWorker.prototype.onProcessMessage = function (msg) {
    // Listen for messages from the master process (if any exists).
    if (msg.cmd === 'restart') {
        var type = msg.type;
        var data = parseInt(msg.data);
        this.logger.info('server received restart message: ' + type);
        if (type.toLowerCase() === 'on_client_queue_empty') {

            this.services.forEach(function (service) {
                service.handleShutdown(type);
            });

            if (this.currentClientQueueLength <= 0) {
                process.send({command: 'restart'});
            }
            else {
                this.restartOnClientQueueEmpty = true;

                if (data) {
                    // Set the timeout to restart this server process.
                    this.logger.info('Restart request received. ' + this.currentClientQueueLength + ' client(s) currently connected. Setting restart timeout to ' + data);
                    setTimeout(function () {
                        this.logger.warn('Server Restart timeout, restarting process with ' + this.currentClientQueueLength + ' connected client(s)');
                        process.send({command: 'restart'});
                    }.bind(this), data);
                }
            }
        }
        else {
            process.send({command: 'restart'});
        }
    }
    else if (msg.cmd === 'stop') {
        var type = msg.type;
        var data = parseInt(msg.data);
        this.logger.info('server received stop message: ' + type);
        if (type.toLowerCase() === 'on_client_queue_empty') {

            this.services.forEach(function (service) {
                service.handleShutdown(type);
            });

            if (this.currentClientQueueLength <= 0) {
                process.send({command: 'stop'});
            }
            else {
                this.stopOnClientQueueEmpty = true;

                if (data) {
                    // Set the timeout to restart this server process.
                    this.logger.info('Stop request received. ' + this.currentClientQueueLength + ' client(s) currently connected. Setting stop timeout to ' + data);
                    setTimeout(function () {
                        this.logger.warn('Server Stop timeout, stopping process with ' + this.currentClientQueueLength + ' connected client(s)');
                        process.send({command: 'stop'});
                    }.bind(this), data);
                }
            }
        }
        else {
            process.send({command: 'stop'});
        }
    }
    else if (msg.cmd.toLowerCase() === 'loglevel') {
        throw new Error('NOT IMPLEMENTED');
        //var logLevel = msg.data;
        //this.logger.info('Setting LogLevel to ' + logLevel);
        //logger.remove(winston.transports.Console);
        //logger.add(winston.transports.Console, {level: logLevel});
    }
    else if (msg.cmd.toLowerCase() === 'clientmessageresendinterval') {
        var clientMessageResendInterval = msg.data;
        this.logger.info('Setting clientMessageResendInterval to ' + clientMessageResendInterval);
        this.properties['frontend.clientMessageResendInterval'] = clientMessageResendInterval;
    }
    else if (msg.cmd.toLowerCase() === 'clientcount') {
        this.logger.info('Getting clientCount: ' + this.currentClientQueueLength + ' client(s) currently connected');
        process.send({command: 'clientCount', data: this.currentClientQueueLength});
    }
    else {
        this.logger.info('server received unknown message: ' + JSON.stringify(msg));
    }
};

GatewayWorker.prototype.createErrorHandler = function createErrorHandler(source) {
    return function (error) {
        this.logger.error('Fatal ' + source + ' error: ', error.stack);

        clearInterval(this.heartbeat);
        if (process.send && !this.exiting) {
            this.catchAndWarn('master communication channel', function () {
                process.send({command: 'disconnect'});
            });
        }

        this.catchAndWarn('HTTP Server', function () {
            this.httpServer.close();
        });

        this.services.forEach(function (service) {
            service.handleError(error, source);
        });

        this.exiting = true;
    }.bind(this);
};

GatewayWorker.prototype.catchAndWarn = function catchAndWarn(connection, cleanup) {
    try {
        cleanup();
    } catch (error) {
        if (!this.exiting) {
            this.logger.warn('Error disconnecting ' + connection + ' (' +error.toString() + ')');
        }
    }
};

GatewayWorker.prototype.startHeartbeartPoller = function(){
    if (process.send) {
        this.heartbeat = setInterval(function () {
            process.send({command: 'heartbeat', memory: process.memoryUsage()});
        }, this.properties['cluster.heartbeatInterval']);
    }
};

GatewayWorker.prototype.startMemoryUsagePoller = function(){
    setInterval(function () {
        try {
            this.checkMemoryUsage();
        } catch (error) {
            this.logger.info(error);
        }
    }.bind(this), 1000);
};

GatewayWorker.prototype.start = function() {
    process.on('message', this.onProcessMessage.bind(this));
    this.startHeartbeartPoller();
    this.startMemoryUsagePoller();

    this.httpServer.listen(
        this.properties['frontend.port'],
        this.properties['frontend.host'],
        function () {
            this.logger.info('Worker ready on http' + (this.useSsl ? 's' : '') + '://' +
            (this.properties['frontend.host'] || '*') + ':' + (this.properties['frontend.port']));
        }.bind(this)
    );
};


