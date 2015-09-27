'use strict';

var cluster = require('cluster'),
    os = require('os'),
    redis = require("redis"),
    propParser = require('node-properties-parser'),
    GatewayWorker = require('./worker'),
    MEGABYTE = 1024 * 1024;

module.exports = GatewayServer;

function GatewayServer(propertiesFile) {
    this.workers = [];
    this.server = null;
    this.shuttingDown = false;
    this.propertiesFile = propertiesFile;
    this.properties = null;
    this.logger = null;
    this.consecutiveFailures = 0;
    this.workerCount;
}

GatewayServer.prototype.inject = function(prefixedLogger){
    this.logger = prefixedLogger;
}
GatewayServer.prototype.init = function(){
    if(this.propertiesFile)
        try{
            this.properties = propParser.readSync(__dirname + this.propertiesFile);
        }catch(e){
            this.logger.warn('Could not load properties file from ./'+this.propertiesFile);
            try{
                this.properties = propParser.readSync(this.propertiesFile);
            }catch(e2){
                this.logger.warn('Could not load properties file from '+this.propertiesFile);
            }
        }

    if(!this.properties)
        this.properties = propParser.readSync(__dirname + '/../resources/env.default.properties');
}

GatewayServer.prototype.start = function(){

    var cpuCount = os.cpus().length;
    this.workerCount = this.properties['cluster.workerCount'] || cpuCount / 2 + 1;

    if(cluster.isMaster){
        var version = '1.0.0';
        var versionDate = '2013-10-17';
        this.logger.info('\n**************************** ACTIVESTACK GATEWAY SERVER: v' + version + ' ' + versionDate + ' ****************************\n');
        this.logger.info('CPU count: ' + cpuCount);
        this.logger.info('Worker count: ' + this.workerCount);
    }

    if (cluster.isMaster && this.workerCount > 1) {
        // Attempt to connect to redis queue.
        try {
            var gatewayControlQueue = this.properties['gateway.redis.gatewaycontrolqueue'];
            if (!gatewayControlQueue)
                gatewayControlQueue = 'gateway';

            var client = redis.createClient(this.properties['gateway.redis.port'], this.properties['gateway.redis.host']);
            //var client = redis.createClient(process.env.REDIS_PORT_6379_TCP_PORT, process.env.REDIS_PORT_6379_TCP_ADDR);
            if (this.properties['gateway.redis.password']) {
                client.auth(this.properties['gateway.redis.password'], function(error, result) {
                    if (error)
                        this.logger.info('ERROR connecting to redis: ' + error);
                    else
                        this.logger.info('SUCCESSFULLY connected to redis');
                }.bind(this));
            }

            client.on("error", function (err) {
                this.logger.info("Error " + err);
            }.bind(this));

            client.on("message", function (channel, message) {
                try {
                    if (message.toLowerCase().trim().indexOf('loglevel') == 0) {
                        this.logger.info('Processing LOGLEVEL message');
                        var params = message.toLowerCase().trim().split(' ');
                        var logLevel = this.properties['frontend.logLevel'];
                        if (params.length > 1) {
                            logLevel = params[1];
                        }
                        this.setLogLevel(logLevel);
                    }
                    else if (message.toLowerCase().trim().indexOf('clientmessageresendinterval') == 0) {
                        this.logger.info('Processing CLIENTMESSAGERESENDINTERVAL message');
                        var params = message.toLowerCase().trim().split(' ');
                        var clientMessageResendInterval = this.properties['frontend.clientMessageResendInterval'];
                        if (params.length > 1) {
                            clientMessageResendInterval = params[1];
                        }
                        this.setClientMessageResendInterval(clientMessageResendInterval);
                    }
                    else if (message.toLowerCase().trim().indexOf('clientcount') == 0) {
                        this.logger.info('Processing CLIENTCOUNT message');
                        this.getClientCount();
                    }
                    // TODO: Add workerCount message
                    else if (message.toLowerCase().trim().indexOf('restart') == 0) {
                        this.logger.info('Processing RESTART message');
                        var params = message.toLowerCase().trim().split(' ');
                        var restartType = 'immediate';
                        if (params.length > 1) {
                            restartType = params[1];
                        }
                        var restartInterval;
                        if (params.length > 2)
                            restartInterval = parseInt(params[2]);
                        this.restartWorkers(restartType, restartInterval);
                    }
                    else if (message.toLowerCase().trim().indexOf('shutdown') == 0) {
                        this.logger.info('Processing SHUTDOWN message');
                        this.shuttingDown = true;
                        var params = message.toLowerCase().trim().split(' ');
                        var stopCode;
                        if (params.length > 1) {
                            stopCode = params[1];
                        }

                        if (stopCode != properties['frontend.shutdownCode']) {
                            this.logger.info('\n************************ INVALID SHUTDOWN CODE RECEIVED!!! ************************\n');
                            return;
                        }
                        var stopType = 'immediate';
                        if (params.length > 2) {
                            stopType = params[2];
                        }
                        var stopTimeout;
                        if (params.length > 3)
                            stopTimeout = parseInt(params[3]);
                        this.stopWorkers(stopType, stopTimeout);
                    }
                    else {
                        this.logger.info("Received Redis unknown message: " + channel + ": " + message);
                    }
                } catch(error) {
                    this.logger.info('EXCEPTION: ' + error);
                }
            }.bind(this));
            client.on("subscribe", function (channel, count) {
                this.logger.info("Subscribed to redis channel " + channel);
            }.bind(this));
            client.subscribe(gatewayControlQueue);
        } catch(redisError) {
            this.logger.info('REDIS ERROR: Unable to connect to redis queue: ' + redisError);
        }

        for (var i = 0; i < this.workerCount; ++i) {
            this.createWorker();
        }
    } else {
        var worker = new GatewayWorker(this.logger, this.properties);
        worker.start();
    }
}


GatewayServer.prototype.restartWorkers = function(restartType, restartInterval) {
    var oldWorkers = this.workers;
    this.workers = [];
    this.logger.info('Restarting processes - ' + restartType.toUpperCase());

    if (restartType.toLowerCase() === 'immediate') {
        if (!restartInterval)
            restartInterval = 500;
        this.logger.info('Restarting processes at ' + restartInterval + 'ms intervals');
        for(var j=0; j<oldWorkers.length; j++) {
            try {
                if (oldWorkers[j]) {
                    (function(theWorker, theTimeout) {
                        setTimeout(function() {
                            this.logger.info('Destroying Worker ' + theWorker.process.pid);
                            theWorker.disconnect();
                            theWorker.destroy();
                        }.bind(this), theTimeout);
                    }) (oldWorkers[j], j * restartInterval);
                }
            } catch(error) {
                this.logger.info('Unable to destroy worker: ' + error);
            }
        }
    }
    else {
        for(var j=0; j<oldWorkers.length; j++) {
            try {
                if (oldWorkers[j]) {
                    this.logger.info('sending timeout ' + restartInterval);
                    oldWorkers[j].send({cmd: 'restart', type: 'on_client_queue_empty', data: restartInterval});
                }
            } catch(error) {
                this.logger.info('Unable to destroy worker: ' + error);
            }
        }
    }
}

GatewayServer.stopWorkers = function(stopType, stopTimeout) {
    this.logger.info('Stopping processes - ' + stopType.toUpperCase());

    if (stopType.toLowerCase() === 'immediate') {
        for(var j = 0; j < this.workers.length; j++) {
            try {
                if (this.workers[j]) {
                    this.workers[j].disconnect();
                    this.workers[j].destroy();
                }
            } catch(error) {
                this.logger.info('Unable to destroy worker: ' + error);
            }
        }
        process.exit();
    }
    else {
        for(var j = 0; j< this.workers.length; j++) {
            try {
                if (this.workers[j]) {
                    if (stopTimeout)
                        this.logger.info('sending timeout ' + stopTimeout);
                    this.workers[j].send({cmd: 'stop', type: 'on_client_queue_empty', data: stopTimeout});
                }
            } catch(error) {
                this.logger.info('Unable to destroy worker: ' + error);
            }
        }
    }
}

GatewayServer.prototype.setLogLevel = function(logLevel) {
    this.logger.info('Setting LogLevel - ' + logLevel.toUpperCase());

    for(var j = 0; j < this.workers.length; j++) {
        try {
            if (this.workers[j]) {
                this.workers[j].send({cmd: 'logLevel', data: logLevel});
            }
        } catch(error) {
            this.logger.info('Unable to set logLevel: ' + error);
        }
    }
}

GatewayServer.prototype.setClientMessageResendInterval = function(clientMessageResendInterval) {
    this.logger.info('Setting clientMessageResendInterval - ' + clientMessageResendInterval);

    for(var j = 0; j < this.workers.length; j++) {
        try {
            if (this.workers[j]) {
                this.workers[j].send({cmd: 'clientMessageResendInterval', data: clientMessageResendInterval});
            }
        } catch(error) {
            this.logger.info('Unable to set clientMessageResendInterval: ' + error);
        }
    }
}

GatewayServer.prototype.getClientCount = function() {
    this.logger.info('Getting clientCount');

    for(var j = 0; j < this.workers.length; j++) {
        try {
            if (this.workers[j]) {
                this.workers[j].send({cmd: 'clientCount'});
            }
        } catch(error) {
            this.logger.info('Unable to set clientCount: ' + error);
        }
    }
}

GatewayServer.prototype.resetWorkerRestartDelay = function() {
    this.consecutiveFailures = 0;
}

GatewayServer.prototype.getNextWorkerRestartDelay = function() {
    var failureCount = Math.min(this.consecutiveFailures++, this.properties['cluster.maxRestartBackoff']);
    var factor = Math.random() * (Math.pow(2, failureCount) - 1);
    return factor * this.properties['cluster.workerRestartDelay'];
}

GatewayServer.prototype.createWorker = function(forceCreate) {
    if (this.shuttingDown) {
        this.logger.info('Shutting down, not restarting worker.');
        return;
    }

    if (this.workerCount <= this.workers.length) {
        if (!forceCreate) {
            // Only start another worker if forceCreate OR we have not yet reached our max number of worker threads.
            this.logger.info('Reached max num workers, ABORTING createWorker');
            return;
        }
        else {
            this.logger.info('Reached max num workers, FORCE createWorker');
        }
    }

    var worker = cluster.fork();
    var lastHeartbeat;
    var watchdog;
    var pid = worker.process.pid;
    var gotFirstHeartbeat = false;

    worker.on('online', function() {
        this.logger.info('Worker online: ' + pid);
        lastHeartbeat = Date.now();
        watchdog = setInterval(function() {
            var time = Date.now();
            if (lastHeartbeat + this.properties['cluster.workerTimeout'] < time) {
                this.logger.info('Worker heartbeat stopped, destroying worker: ' + pid);

                try {
                    for(var i = 0; i < this.workers.length; i++) {
                        if (this.workers[i] === worker) {
                            this.workers.splice(i, 1);
                            break;
                        }
                    }
                    worker.disconnect();
                    worker.destroy();
                } catch(error) {
                    this.logger.info('Error destroying worker: ' + pid);
                }
            }
        }.bind(this), this.properties['cluster.watchdogInterval']);
    }.bind(this));

    worker.on('message', function(message) {
        if (message.command == 'heartbeat') {
            if (!gotFirstHeartbeat) {
                gotFirstHeartbeat = true;
                this.resetWorkerRestartDelay();
            }

            lastHeartbeat = Date.now();
            for (var type in message.memory) {
                var limit = this.properties['cluster.memoryLimit.' + type];
                var warning = this.properties['cluster.memoryWarning.' + type];
                if (limit && (message.memory[type] > limit * MEGABYTE)) {
                    this.logger.info('Worker exceeded hard ' + type + ' memory limit (' +
                    message.memory[type] + '/' + limit * MEGABYTE + ')!');
                    for(var i = 0; i < this.workers.length; i++) {
                        if (this.workers[i] === worker) {
                            this.workers.splice(i, 1);
                            break;
                        }
                    }

                    try {
                        this.logger.info('Destroying worker ' + pid);
                        worker.disconnect();
                        worker.destroy();
                    } catch(error) {
                        this.logger.info('Error destroying worker: ' + pid);
                    }
                }
                if (warning && (message.memory[type] > warning * MEGABYTE)) {
                    this.logger.info('Worker exceeded soft ' + type + ' memory limit (' +
                    message.memory[type] + '/' + warning * MEGABYTE + ')!');
                }
            }
        } else if (message.command == 'disconnect') {
            // Let the worker die peacefully.
            try {
                for(var i = 0; i < this.workers.length; i++) {
                    if (this.workers[i] === worker) {
                        this.workers.splice(i, 1);
                        break;
                    }
                }
                worker.disconnect();
                worker.destroy();
            } catch(error) {
                this.logger.info('Worker already disconnected: ' + pid);
            }
        } else if (message.command == 'stop') {
            // Let the worker die peacefully, then stop (when all workers have died).
            try {
                this.logger.info('STOPPING worker ' + pid);
                for(var i = 0; i < this.workers.length; i++) {
                    if (this.workers[i] === worker) {
                        this.workers.splice(i, 1);
                        break;
                    }
                }
                worker.disconnect();
                worker.destroy();
            } catch(error) {
                this.logger.info('Worker already disconnected: ' + pid);
            }

            if (this.workers.length <= 0) {
                this.logger.info('Exiting process');
                process.exit();
            }
        } else if (message.command == 'restart') {
            // Let the worker die peacefully, then restart.
            try {
                this.logger.info('RESTARTING worker ' + pid);
                for(var i = 0; i < this.workers.length; i++) {
                    if (this.workers[i] === worker) {
                        this.workers.splice(i, 1);
                        break;
                    }
                }
                worker.disconnect();
                worker.destroy();
                // After the worker is destroyed, the on 'exit' handler will pick up the event and automatically restart the worker.
            } catch(error) {
                this.logger.info('Worker already disconnected: ' + pid);
            }
        } else if (message.command == 'clientCount') {
            // Report the clientCount.
            this.logger.info('ClientCount ' + pid + ': ' + message.data);
        } else {
            this.logger.info('Unknown worker message: ', message);
        }
    }.bind(this));
    worker.on('exit', function(code, signal) {
        this.logger.info('Worker ' + pid + ' died (code:' + code + ', signal:' +
        (signal || 'none') + ').  Starting replacement...');
        clearInterval(watchdog);

        for(var i = 0; i < this.workers.length; i++) {
            if (this.workers[i] === worker) {
                this.workers.splice(i, 1);
                break;
            }
        }

        setTimeout(this.createWorker.bind(this), this.getNextWorkerRestartDelay());
    }.bind(this));

    this.workers.push(worker);
}
