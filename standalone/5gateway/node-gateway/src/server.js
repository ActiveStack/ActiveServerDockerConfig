'use strict';

var version = '1.0.0';
var versionDate = '2013-10-17';

console.log('\n**************************** PERCERO GATEWAY SERVER: v' + version + ' ' + versionDate + ' ****************************\n');

var winston = require('winston');
var fs = require('fs');
var https = require('https');
var exiting = false;
var restartOnClientQueueEmpty = false;
var stopOnClientQueueEmpty = false;
var currentClientQueueLength = 0;
var properties = require('node-properties-parser').readSync(process.argv[2] ||
		__dirname + '/../resources/env.properties');

var logger = (function() {
	var logger = new winston.Logger({
		transports: [
			new winston.transports.Console({ level: properties['frontend.logLevel'] })
		],
		levels: { silly: 0, debug: 1, verbose: 2, info: 3, warn: 4, error: 5 }
	});

	require('./prefixed_logger').decorateLogger(logger);
	return logger.extendPrefix(process.pid);
})();

var useSsl = properties['frontend.ssl'];
if (useSsl && (useSsl === 'true' || useSsl === 't' || useSsl === '1' || useSsl === 1)) {
    useSsl = true;
}
else {
    useSsl = false;
}

var ssl = undefined;
try {
    // var privateKey = fs.readFileSync(__dirname + '/../ssl/server_DEV.key').toString();
    // var certificate = fs.readFileSync(__dirname + '/../ssl/server_DEV.crt').toString();
    // var ca = fs.readFileSync(__dirname + '/../ssl/server_DEV.csr').toString();
    // var privateKey = fs.readFileSync(__dirname + '/../ssl/psiglobaldb.com.key').toString();
    // var certificate = fs.readFileSync(__dirname + '/../ssl/464e16864a577.crt').toString();
    // var ca = fs.readFileSync(__dirname + '/../ssl/psiglobaldb.com.csr').toString();
    var privateKey = fs.readFileSync(__dirname + '/../ssl/psiinformatics.com.private.key').toString();
    var certificate = fs.readFileSync(__dirname + '/../ssl/psiinformatics.com.crt').toString();
    var ca = fs.readFileSync(__dirname + '/../ssl/psiinformatics.com.csr').toString();
    ssl = {
        key: privateKey,
        cert:certificate,
        ca: ca
    };
} catch(error) {
    useSsl = false;
    logger.info('NOT using SSL');
    logger.error(error);
}

var app = (function() {
	var express = require('express');
	// var app = express();
    var app = express(ssl);
	app.configure(function() {
		app.set('views', __dirname + '/../views');
		app.use(express.bodyParser());
		app.use(express.static(__dirname + '/../static'));

		var expressLogger = logger.extendPrefix('express');
		app.use(express.logger({
			stream: { write: function(m) { expressLogger.info(m.trim()); } }
		}));
		app.use(app.router);
	});
/**

//  app.configure(function() {
        app.set('views', __dirname + '/../views');
//      app.use(express.bodyParser());
        app.use(bodyParser.json());
        app.use(express.static(__dirname + '/../static'));

//      app.use(morgan('combined'));
        var expressLogger = logger.extendPrefix('express');
        var accessLogStream = { write: function(m) { expressLogger.info(m.trim()); } };
        app.use(morgan('combined', 
            {
                stream: accessLogStream
            }
        ));
//      app.use(express.logger({
//          stream: { write: function(m) { expressLogger.info(m.trim()); } }
//      }));
//      app.use(app.router);
//  });

**/	

	return app;
})();

var httpServer = (function() {
	var httpServer = app.listen(properties['frontend.port'],
			properties['frontend.host'], function() {
		logger.info('Frontend ready on http' + (useSsl ? 's' : '') + '://' +
				(properties['frontend.host'] || '*') + ':' +
				(useSsl ? '443' : properties['frontend.port']));
	});
	httpServer.on('error', createErrorHandler('HTTP Server'));

	return httpServer;
})();

if (useSsl) {
    var httpsServer = https.createServer(ssl, app);
    httpsServer.listen(443);
    logger.info('Using SSL for WebServices');
}

var services = (function() {
	var Default = require('./service/default');
	var Gateway = require('./service/gateway');
	//var Upload = require('./service/upload');

	var callbacks = {
		createErrorHandler: createErrorHandler,
		catchAndWarn: catchAndWarn,
		isExiting: isExiting,
		sendMessage: receiveMessage
	};

	var services = [];
	// services.push(new Gateway(httpServer, properties, logger, callbacks));
    if (useSsl) {
        services.push(new Gateway(httpsServer, properties, ssl, logger, callbacks));
    }
    else {
        services.push(new Gateway(httpServer, properties, undefined, logger, callbacks));
    }
	// services.push(new Upload(app, properties, logger, callbacks));

	// Defaults must be last
	services.push(new Default(app, properties, logger, callbacks));

	return services;
})();

var heartbeat = (function() {
    if (process.send) {
		return setInterval(function() {
			process.send({ command: 'heartbeat', memory: process.memoryUsage() });
		}, properties['cluster.heartbeatInterval']);
	}
})();

var checkMemoryUsage = function() {
    var memoryUsage = process.memoryUsage();
    var megabyte = 1024 * 1024;
    for (var type in memoryUsage) {
        //console.log('Memory ' + type + ' Usage: ' + (memoryUsage[type] / megabyte) + 'MB');
        var limit = properties['cluster.memoryLimit.' + type];
        var warning = properties['cluster.memoryWarning.' + type];
        if (limit && (memoryUsage[type] > limit * megabyte)) {
            logger.error('Worker exceeded hard ' + type + ' memory limit (' +
                memoryUsage[type] + '/' + limit * megabyte + ')!');
        }
        if (warning && (memoryUsage[type] > warning * megabyte)) {
            logger.warn('Worker exceeded soft ' + type + ' memory limit (' +
                memoryUsage[type] + '/' + warning * megabyte + ')!');
        }
    }
};

function receiveMessage (message) {
	logger.debug('Received message from service');
	if (message) {
		if (message.command === 'clientQueueLength') {
			currentClientQueueLength = message.data;
			if (restartOnClientQueueEmpty && currentClientQueueLength <= 0) {
				logger.info('Client Queue is Empty: RESTARTING');
				process.send({command: 'restart'});
			}
			else if (stopOnClientQueueEmpty && currentClientQueueLength <= 0) {
				logger.info('Client Queue is Empty: STOPPING');
				process.send({command: 'stop'});
			}
		}
	}
};

process.on('message', function (msg) {
	// Listen for messages from the master process (if any exists).
	if (msg.cmd === 'restart') {
		var type = msg.type;
		var data = parseInt(msg.data);
		console.log('server received restart message: ' + type);
		if (type.toLowerCase() === 'on_client_queue_empty') {
			
			services.forEach(function(service) {
				service.handleShutdown(type);
			});

			if (currentClientQueueLength <= 0) {
				process.send({command: 'restart'});
			}
			else {
				restartOnClientQueueEmpty = true;

				if (data) {
					// Set the timeout to restart this server process.
					logger.info('Restart request received. ' + currentClientQueueLength + ' client(s) currently connected. Setting restart timeout to ' + data);
					setTimeout(function() {
						logger.warn('Server Restart timeout, restarting process with ' + currentClientQueueLength + ' connected client(s)');
						process.send({command: 'restart'});
					}, data);
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
		console.log('server received stop message: ' + type);
		if (type.toLowerCase() === 'on_client_queue_empty') {
			
			services.forEach(function(service) {
				service.handleShutdown(type);
			});
			
			if (currentClientQueueLength <= 0) {
				process.send({command: 'stop'});
			}
			else {
				stopOnClientQueueEmpty = true;
				
				if (data) {
					// Set the timeout to restart this server process.
					logger.info('Stop request received. ' + currentClientQueueLength + ' client(s) currently connected. Setting stop timeout to ' + data);
					setTimeout(function() {
						logger.warn('Server Stop timeout, stopping process with ' + currentClientQueueLength + ' connected client(s)');
						process.send({command: 'stop'});
					}, data);
				}
			}
		}
		else {
			process.send({command: 'stop'});
		}
	}
	else if (msg.cmd.toLowerCase() === 'loglevel') {
		var logLevel = msg.data;
		console.log('Setting LogLevel to ' + logLevel);
		logger.remove(winston.transports.Console);
		logger.add(winston.transports.Console, { level: logLevel });
	}
	else if (msg.cmd.toLowerCase() === 'clientmessageresendinterval') {
		var clientMessageResendInterval = msg.data;
		console.log('Setting clientMessageResendInterval to ' + clientMessageResendInterval);
		properties['frontend.clientMessageResendInterval'] = clientMessageResendInterval;
	}
	else if (msg.cmd.toLowerCase() === 'clientcount') {
		console.log('Getting clientCount: ' + currentClientQueueLength + ' client(s) currently connected');
		process.send({command: 'clientCount', data: currentClientQueueLength});
	}
	else {
		console.log('server received unknown message: ' + JSON.stringify(msg));
	}
});

function createErrorHandler(source) {
	return function(error) {
		logger.error('Fatal ' + source + ' error: ', error.stack);

		clearInterval(heartbeat);
		if (process.send && !isExiting()) {
			catchAndWarn('master communication channel', function() {
				process.send({ command: 'disconnect' });
			});
		}

		catchAndWarn('HTTP Server', function() { httpServer.close(); });

		services.forEach(function(service) {
			service.handleError(error, source);
		});

		exiting = true;
	};
}

function catchAndWarn(connection, cleanup) {
	try {
		cleanup();
	} catch(error) {
		if (!isExiting()) {
			logger.warn('Error disconnecting ' + connection + ' (' +
					error.toString() + ')');
		}
	}
}

function isExiting() {
	return exiting;
}


setInterval(function() {
    try {
        checkMemoryUsage();
    } catch(error) {
        console.log(error);
    }
}, 1000);
