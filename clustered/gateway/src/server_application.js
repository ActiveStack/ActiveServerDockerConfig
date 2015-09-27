var GatewayServer = require('./server'),
    AppContext = require('injecterooski').AppContext,
    PrefixedLogger = require('./logging/prefixed_logger');

var appContext = new AppContext();

var server = new GatewayServer();

appContext.register([
    server,
    new PrefixedLogger()
]);

appContext.resolve();

server.start();