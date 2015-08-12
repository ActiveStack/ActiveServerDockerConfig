'use strict';

var cluster = require('cluster');
var os = require('os');
//var redisq = require('redisq');
var redis = require("redis");
var workers = [];
var server = undefined;
var shuttingDown = false;


var megabyte = 1024 * 1024;
var properties = require('node-properties-parser').readSync(process.argv[2] ||
    __dirname + '/../resources/env.properties');

if (cluster.isMaster) {
    var cpuCount = os.cpus().length;
    //var cpuCount = 1;
    var workerCount = properties['cluster.workerCount'] || cpuCount / 2 + 1;
    console.log('CPU count: ' + cpuCount);
    console.log('Worker count: ' + workerCount);

    // Attempt to connect to redis queue.
    try {
        var gatewayControlQueue = properties['gateway.redis.gatewaycontrolqueue'];
        if (!gatewayControlQueue)
            gatewayControlQueue = 'gateway';

        var client = redis.createClient(properties['gateway.redis.port'], properties['gateway.redis.host']);
        if (properties['gateway.redis.password']) {
            client.auth(properties['gateway.redis.password'], function(error, result) {
                if (error)
                    console.log('ERROR connecting to redis: ' + error);
                else
                    console.log('SUCCESSFULLY connected to redis');
            });
        }

        client.on("error", function (err) {
            console.log("Error " + err);
        });

        client.on("message", function (channel, message) {
            try {
                if (message.toLowerCase().trim().indexOf('loglevel') == 0) {
                    console.log('Processing LOGLEVEL message');
                    var params = message.toLowerCase().trim().split(' ');
                    var logLevel = properties['frontend.logLevel'];
                    if (params.length > 1) {
                        logLevel = params[1];
                    }
                    setLogLevel(logLevel);
                }
                else if (message.toLowerCase().trim().indexOf('clientmessageresendinterval') == 0) {
                    console.log('Processing CLIENTMESSAGERESENDINTERVAL message');
                    var params = message.toLowerCase().trim().split(' ');
                    var clientMessageResendInterval = properties['frontend.clientMessageResendInterval'];
                    if (params.length > 1) {
                        clientMessageResendInterval = params[1];
                    }
                    setClientMessageResendInterval(clientMessageResendInterval);
                }
                else if (message.toLowerCase().trim().indexOf('clientcount') == 0) {
                    console.log('Processing CLIENTCOUNT message');
                    getClientCount();
                }
                // TODO: Add workerCount message
                else if (message.toLowerCase().trim().indexOf('restart') == 0) {
                    console.log('Processing RESTART message');
                    var params = message.toLowerCase().trim().split(' ');
                    var restartType = 'immediate';
                    if (params.length > 1) {
                        restartType = params[1];
                    }
                    var restartInterval = undefined;
                    if (params.length > 2)
                        restartInterval = parseInt(params[2]);
                    restartWorkers(restartType, restartInterval);
                }
                else if (message.toLowerCase().trim().indexOf('shutdown') == 0) {
                    console.log('Processing SHUTDOWN message');
                    shuttingDown = true;
                    var params = message.toLowerCase().trim().split(' ');
                    var stopCode = undefined;
                    if (params.length > 1) {
                        stopCode = params[1];
                    }

                    if (stopCode != properties['frontend.shutdownCode']) {
                        console.log('\n************************ INVALID SHUTDOWN CODE RECEIVED!!! ************************\n');
                        return;
                    }
                    var stopType = 'immediate';
                    if (params.length > 2) {
                        stopType = params[2];
                    }
                    var stopTimeout = undefined;
                    if (params.length > 3)
                        stopTimeout = parseInt(params[3]);
                    stopWorkers(stopType, stopTimeout);
                }
                else {
                    console.log("Received Redis unknown message: " + channel + ": " + message);
                }
            } catch(error) {
                console.log('EXCEPTION: ' + error);
            }
        });
        client.on("subscribe", function (channel, count) {
            console.log("Subscribed to redis channel " + channel);
        });
        client.subscribe(gatewayControlQueue);
    } catch(redisError) {
        console.log('REDIS ERROR: Unable to connect to redis queue: ' + redisError);
    }

    for (var i = 0; i < workerCount; ++i) {
        createWorker();
    }
} else {
    server = require('./server.js');
}

function restartWorkers(restartType, restartInterval) {
    var oldWorkers = workers;
    workers = [];
    console.log('Restarting processes - ' + restartType.toUpperCase());

    if (restartType.toLowerCase() === 'immediate') {
        if (!restartInterval)
            restartInterval = 500;
        console.log('Restarting processes at ' + restartInterval + 'ms intervals');
        for(var j=0; j<oldWorkers.length; j++) {
            try {
                if (oldWorkers[j]) {
                    (function(theWorker, theTimeout) {
                        setTimeout(function() {
                            console.log('Destroying Worker ' + theWorker.process.pid);
                            theWorker.disconnect();
                            theWorker.destroy();
                        }, theTimeout);
                    }) (oldWorkers[j], j * restartInterval);
                }
            } catch(error) {
                console.log('Unable to destroy worker: ' + error);
            }
        }
    }
    else {
        for(var j=0; j<oldWorkers.length; j++) {
            try {
                if (oldWorkers[j]) {
                    console.log('sending timeout ' + restartInterval);
                    oldWorkers[j].send({cmd: 'restart', type: 'on_client_queue_empty', data: restartInterval});
                }
            } catch(error) {
                console.log('Unable to destroy worker: ' + error);
            }
        }
    }
}

function stopWorkers(stopType, stopTimeout) {
    console.log('Stopping processes - ' + stopType.toUpperCase());

    if (stopType.toLowerCase() === 'immediate') {
        for(var j=0; j<workers.length; j++) {
            try {
                if (workers[j]) {
                    workers[j].disconnect();
                    workers[j].destroy();
                }
            } catch(error) {
                console.log('Unable to destroy worker: ' + error);
            }
        }
        process.exit();
    }
    else {
        for(var j=0; j<workers.length; j++) {
            try {
                if (workers[j]) {
                    if (stopTimeout)
                        console.log('sending timeout ' + stopTimeout);
                    workers[j].send({cmd: 'stop', type: 'on_client_queue_empty', data: stopTimeout});
                }
            } catch(error) {
                console.log('Unable to destroy worker: ' + error);
            }
        }
    }
}

function setLogLevel(logLevel) {
    console.log('Setting LogLevel - ' + logLevel.toUpperCase());

    for(var j=0; j<workers.length; j++) {
        try {
            if (workers[j]) {
                workers[j].send({cmd: 'logLevel', data: logLevel});
            }
        } catch(error) {
            console.log('Unable to set logLevel: ' + error);
        }
    }
}

function setClientMessageResendInterval(clientMessageResendInterval) {
    console.log('Setting clientMessageResendInterval - ' + clientMessageResendInterval);

    for(var j=0; j<workers.length; j++) {
        try {
            if (workers[j]) {
                workers[j].send({cmd: 'clientMessageResendInterval', data: clientMessageResendInterval});
            }
        } catch(error) {
            console.log('Unable to set clientMessageResendInterval: ' + error);
        }
    }
}

function getClientCount() {
    console.log('Getting clientCount');

    for(var j=0; j<workers.length; j++) {
        try {
            if (workers[j]) {
                workers[j].send({cmd: 'clientCount'});
            }
        } catch(error) {
            console.log('Unable to set clientCount: ' + error);
        }
    }
}

// Exponential backoff for restarts.
var consecutiveFailures = 0;
function resetWorkerRestartDelay() {
    consecutiveFailures = 0;
}
function getNextWorkerRestartDelay() {
    var failureCount = Math.min(consecutiveFailures++, properties['cluster.maxRestartBackoff']);
    var factor = Math.random() * (Math.pow(2, failureCount) - 1);
    return factor * properties['cluster.workerRestartDelay'];
}

function createWorker(forceCreate) {
    if (shuttingDown) {
        console.log('Shutting down, not restarting worker.');
        return;
    }

    if (workerCount <= workers.length) {
        if (!forceCreate) {
            // Only start another worker if forceCreate OR we have not yet reached our max number of worker threads.
            console.log('Reached max num workers, ABORTING createWorker');
            return;
        }
        else {
            console.log('Reached max num workers, FORCE createWorker');
        }
    }

    var worker = cluster.fork();
    var lastHeartbeat;
    var watchdog;
    var pid = worker.process.pid;
    var gotFirstHeartbeat = false;

    worker.on('online', function() {
        console.log('Worker online: ' + pid);
        lastHeartbeat = Date.now();
        watchdog = setInterval(function() {
            var time = Date.now();
            if (lastHeartbeat + properties['cluster.workerTimeout'] < time) {
                console.log('Worker heartbeat stopped, destroying worker: ' + pid);

                try {
                    for(var i=0; i<workers.length; i++) {
                        if (workers[i] === worker) {
                            workers.splice(i, 1);
                            break;
                        }
                    }
                    worker.disconnect();
                    worker.destroy();
                } catch(error) {
                    console.log('Error destroying worker: ' + pid);
                }
            }
        }, properties['cluster.watchdogInterval']);
    });
    worker.on('message', function(message) {
        if (message.command == 'heartbeat') {
            if (!gotFirstHeartbeat) {
                gotFirstHeartbeat = true;
                resetWorkerRestartDelay();
            }

            lastHeartbeat = Date.now();
            for (var type in message.memory) {
                var limit = properties['cluster.memoryLimit.' + type];
                var warning = properties['cluster.memoryWarning.' + type];
                if (limit && (message.memory[type] > limit * megabyte)) {
                    console.log('Worker exceeded hard ' + type + ' memory limit (' +
                        message.memory[type] + '/' + limit * megabyte + ')!');
                    for(var i=0; i<workers.length; i++) {
                        if (workers[i] === worker) {
                            workers.splice(i, 1);
                            break;
                        }
                    }

                    try {
                        console.log('Destroying worker ' + pid);
                        worker.disconnect();
                        worker.destroy();
                    } catch(error) {
                        console.log('Error destroying worker: ' + pid);
                    }
                }
                if (warning && (message.memory[type] > warning * megabyte)) {
                    console.log('Worker exceeded soft ' + type + ' memory limit (' +
                        message.memory[type] + '/' + warning * megabyte + ')!');
                }
            }
        } else if (message.command == 'disconnect') {
            // Let the worker die peacefully.
            try {
                for(var i=0; i<workers.length; i++) {
                    if (workers[i] === worker) {
                        workers.splice(i, 1);
                        break;
                    }
                }
                worker.disconnect();
                worker.destroy();
            } catch(error) {
                console.log('Worker already disconnected: ' + pid);
            }
        } else if (message.command == 'stop') {
            // Let the worker die peacefully, then stop (when all workers have died).
            try {
                console.log('STOPPING worker ' + pid);
                for(var i=0; i<workers.length; i++) {
                    if (workers[i] === worker) {
                        workers.splice(i, 1);
                        break;
                    }
                }
                worker.disconnect();
                worker.destroy();
            } catch(error) {
                console.log('Worker already disconnected: ' + pid);
            }

            if (workers.length <= 0) {
                console.log('Exiting process');
                process.exit();
            }
        } else if (message.command == 'restart') {
            // Let the worker die peacefully, then restart.
            try {
                console.log('RESTARTING worker ' + pid);
                for(var i=0; i<workers.length; i++) {
                    if (workers[i] === worker) {
                        workers.splice(i, 1);
                        break;
                    }
                }
                worker.disconnect();
                worker.destroy();
                // After the worker is destroyed, the on 'exit' handler will pick up the event and automatically restart the worker.
            } catch(error) {
                console.log('Worker already disconnected: ' + pid);
            }
        } else if (message.command == 'clientCount') {
            // Report the clientCount.
            console.log('ClientCount ' + pid + ': ' + message.data);
        } else {
            console.log('Unknown worker message: ', message);
        }
    });
    worker.on('exit', function(code, signal) {
        console.log('Worker ' + pid + ' died (code:' + code + ', signal:' +
            (signal || 'none') + ').  Starting replacement...');
        clearInterval(watchdog);

        for(var i=0; i<workers.length; i++) {
            if (workers[i] === worker) {
                workers.splice(i, 1);
                break;
            }
        }

        setTimeout(createWorker, getNextWorkerRestartDelay());
    });

    workers.push(worker);
}
