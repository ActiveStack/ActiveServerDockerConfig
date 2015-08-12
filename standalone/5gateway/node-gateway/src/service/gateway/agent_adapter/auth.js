'use strict';

var Base = require('./base');
var Sync = require('./sync');
var sys = require('util');

module.exports = Auth;


Auth.CN_PREFIX = 'com.percero.agents.auth.vo';

/**
 * @class Performs special processing on gateway messages related to the auth
 * agent.
 *
 * @extends Base
 * @param session Active client session.
 * @param logger Winston instance.
 * @param {Object} callbacks Allows this agent to interact with the gateway.
 * @param {Function} callbacks.registerAgent
 * @param {Function} callbacks.unregisterAgent
 * @param {Function} callbacks.sendToClient
 * @param {Function} callbacks.sendToAgent
 */
function Auth(session, logger, callbacks) {
	Base.call(this);

	this.getCNPrefix = function() {
		return Auth.CN_PREFIX;
	};

	this.getEvents = function() {
		return [
			'authenticateOAuthAccessToken',
			'authenticateOAuthCode',
			'authenticateUserAccount',
			'getAllServiceProviders',
			'getOAuthRequestToken',
			'getRegAppOAuths',
			'getRegisteredApplication',
			'getServiceUsers',
			'logoutUser',
			'testCall',
			'validateUserByToken'
		];
	};

	this.processSpecialMessage = function(type, message) {
		if ((type == 'reconnect') && session.isLoggedIn()) {
			callbacks.registerAgent(new Sync(session, logger, callbacks));
		} else if (type == 'logout') {
			// TODO: Move this messaging into the client
			var disconnectAuthMessage = session.populateMessage({
				cn: Auth.CN_PREFIX + '.DisconnectRequest'
			});
			callbacks.sendToAgent('disconnectAuth', disconnectAuthMessage);
			session.logout();
		}
	};

	this.processRequest = function(cn, request) {
		if ((cn == 'AuthenticateOAuthCodeRequest') ||
					(cn == 'AuthenticateOAuthAccessTokenRequest')) {
			session.regAppKey = request.regAppKey;
			//session.svcOauthKey = request.svcOauthKey;
		}
	};

	this.processResponse = function(cn, response) {
		if (cn == 'UserToken') {
			if (response.user.hasOwnProperty("ID"))
				session.userId = response.user.ID;
			else if (response.user.hasOwnProperty("id"))
				session.userId = response.user.id;
			else
				logger.error("Invalid User in response.");
			session.token = response.token;
			session.deviceId = response.deviceId;
		} else if (response.result &&
				((cn == 'AuthenticateUserAccountResponse') ||
				 (cn == 'AuthenticateOAuthCodeResponse') ||
				 (cn == 'AuthenticateOAuthAccessTokenResponse'))) {
			
			if (response.result.user.hasOwnProperty("ID"))
				session.userId = response.result.user.ID;
			else if (response.result.user.hasOwnProperty("id"))
				session.userId = response.result.user.id;
			else
				logger.error("Invalid User in response.result");
			session.token = response.result.token;
			session.deviceId = response.result.deviceId;
            logger.debug('Received AuthResponse: ' + cn);
		} else {
			return;
		}

		callbacks.registerAgent(new Sync(session, logger, callbacks));
	};
}
