'use strict';

var Base = require('./base');

module.exports = Sync;

Sync.CN_PREFIX = 'com.percero.agents.sync.vo';

/**
 * @class Performs special processing on gateway messages related to the sync
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
function Sync(session, logger, callbacks) {
	Base.call(this);

	// If the session has an existingClientId that is DIFFERENT from its clientId, then issue a ReconnectMessage instead.
	if (session.existingClientId && session.existingClientId !== session.clientId) {
		var reconnectMessage = session.populateMessage({
			cn: Sync.CN_PREFIX + '.ReconnectRequest',
			existingClientId: session.existingClientId,
			existingClientIds: session.existingClientIds
		});
		logger.verbose('Reconnect Message for session client ' + session.clientId + ': ' + JSON.stringify(reconnectMessage));
		callbacks.sendToAgent('reconnect', reconnectMessage);
	}
	else {
		var connectMessage = session.populateMessage({
			cn: Sync.CN_PREFIX + '.ConnectRequest'
		});
		logger.verbose('Connect Message for session client ' + session.clientId + ': ' + JSON.stringify(connectMessage));
		callbacks.sendToAgent('connect', connectMessage);
	}

	this.getCNPrefix = function() {
		return Sync.CN_PREFIX;
	};

	this.getEvents = function() {
		return [
			'createObject',
			'create',
			'delete',
			'deletesReceived',
			'logout',
			'findByExample',
			'findById',
			'findByIds',
			'findUnique',
			'getHistory',
			'countAllByName',
			'getAllByName',
			'processTransaction',
			'putObject',
			'removeObject',
			'runProcess',
			'runQuery',
			'searchByExample',
			'update',
			'updatesReceived',
			'upgradeClient',
			'getChangeWatcher'
		];
	};

	this.processSpecialMessage = function(type, message) {
		logger.debug('sync.js processSpecialMessage: ' + type + ' / ' + message);
		if (type == 'hibernate') {
			// TODO: Move this messaging into the client
			var hibernateMessage = session.populateMessage({
				cn: Sync.CN_PREFIX + '.HibernateRequest'
			});
			callbacks.sendToAgent('hibernate', hibernateMessage);
		/*
		} else if (type == 'logout') {
			// TODO: Move this messaging into the client
			var disconnectMessage = session.populateMessage({
				cn: Sync.CN_PREFIX + '.DisconnectRequest',
			});
			callbacks.sendToAgent('disconnect', disconnectMessage);
			callbacks.unregisterAgent(Sync.CN_PREFIX);
		*/
		} else if (type == 'disconnect') {
            if (message == "socket close") {
                // This sockect is temporarily closed.  Client may reconnect in the future.
                var hibernateMessage = session.populateMessage({
                    cn: Sync.CN_PREFIX + '.HibernateRequest'
                });
                callbacks.sendToAgent('hibernate', hibernateMessage);
            }
            else if (message == "socket end") {
                // This sockect is completely closed, need to delete queue.
                var disconnectMessage = session.populateMessage({
                    cn: Sync.CN_PREFIX + '.DisconnectRequest'
                });
				if (disconnectMessage.existingClientId) {
					delete disconnectMessage.existingClientId;
				}
				if (disconnectMessage.existingClientIds) {
					delete disconnectMessage.existingClientIds;
				}
                callbacks.sendToAgent('disconnect', disconnectMessage);
            }
			else {
				logger.verbose('Socket disconnected for another reason: ' + message);
			}
            callbacks.unregisterAgent(Sync.CN_PREFIX);
		}
	};

	this.processResponse = function(cn, response) {
		// CONNECT RESPONSE
		if (cn == 'ConnectResponse') {
			logger.verbose('Handling ConnectResponse for client ' + response.clientId);
			if (!response.clientId) {
				logger.error('Invalid ClientID for ConnectResponse, unregistering agents (existing client ID ' + session.existingClientId + ')');
				// ConnectResponse is indicating this client is INVALID.
				session.logout();
				callbacks.unregisterAgent(Sync.CN_PREFIX);
			}
		}

		// RE-CONNECT RESPONSE
		else if (cn == 'ReconnectResponse') {
			logger.verbose('Handling ReconnectResponse for client ' + response.clientId);
			//session.existingClientIds = undefined;
			if (!response.clientId) {
				logger.error('Invalid ClientID for ReconnectResponse, unregistering agents (existing client ID ' + session.existingClientId + ')');

				// No longer need the existingClientId;
				session.existingClientId = undefined;
				delete session.existingClientId;

				session.logout();
				callbacks.unregisterAgent(Sync.CN_PREFIX);
			}
			else {
				// No longer need the existingClientId;
				session.existingClientId = undefined;
				delete session.existingClientId;
			}
		}
	};
}
