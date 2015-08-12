'use strict';

var Base = require('./base');

module.exports = Default;

function Default(app, properties, logger, callbacks) {
	Base.call(this);

	app.get('/', function(request, response) {
		response.render('index.ejs', {
			title: 'Browser Client',
			host: properties['gateway.host'],
			port: properties['gateway.port'],
			oauth_client_id: properties['oauth.google.client_id'],
			oauth_client_secret: properties['oauth.google.client_secret'],
			oauth_redirect_uri: properties['oauth.redirectUri']
		});
	});

	// A Route for Creating a 500 Error (Useful to keep around)
	app.get('/500', function(request, response) {
		throw new Error('This is a 500 Error.');
	});

	// The 404 Route (ALWAYS Keep this as the last route)
	app.get('/*', function(request, response) {
		throw new NotFound('Page ' + request.url + ' not found.');
	});

	// Setup the error handler
	app.use(function(error, request, response, next) {
		if (error instanceof NotFound) {
			response.status(404).render('404.ejs', {
				title : '404 - Not Found',
				request: request
			});
		} else {
			response.status(500).render('500.ejs', {
				title : 'The server encountered an error.',
				error: error
			});
		}
	});

	function NotFound(message) {
		this.name = 'NotFound';
		Error.call(this, message);
		Error.captureStackTrace(this, NotFound);
	}
}
