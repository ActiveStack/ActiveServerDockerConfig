'use strict';

// TODO: Implement rolling session secret.
var MAX_SESSION_AGE = (new Date(0)).setUTCDate(7);  // 7 days
var SESSION_SECRET =
		'YsDOJ6HtriYWK23OSeoEMSo687vc6yMIs9q9d4yzAUDer45tRTpsThFK0hIJWyFb' +
		'Ng6iXgmOvm2bhTgXVqFOMyqxQ6DB85NkQXyedOVlEvcUq98rAudPTDwjIPE17XiW' +
		'POF3cWUyWo1WJ6xPHT8ku2KsAlscyCFm3sWOZTIcgdQl9gzPvl8DrqAaIrnv1R8B' +
		'k7ztIsmAyFC3lGK82LFmxh1oSWBwxyMIzyvB2BWs8DLsvgiS4I7suStuDWoHKnMZ' +
		'JzQdxJAB5SItI0tTLFeQmbSVunoAo1t1dmk1FqjJ2JwPyXz0dfxteFMXGCODewXp' +
		'lAN3pYif2eCbNyJKjkhq1gS1FIhlQlupvRKmHeYEFg1QHuCiRO4pVngYiRNs0eQY' +
		'MnDJCiskuWA3OeFKkF1ZZYqNwJWMt58gDcIFIiRkX4tDN4qON4mrWVmFfiBiEXaV' +
		'0EFbtFwZvvfNYUwMygWzvTOMXVEiwZwfdH7BIuAiicOC3fmfKEYMZgknUMORsB2u';

var crypto = require('crypto');

module.exports = Session;

/**
 * @class Manages a long-lived client session.  Supports signed save/load for
 * storage offload to client.
 *
 * @param logger Winstan instance.
 */
function Session(logger) {
	var contents = {
		clientId: crypto.randomBytes(16).toString('hex'),
		existingClientId: undefined,
		existingClientIds: undefined,
		deviceId: undefined,
		regAppKey: undefined,
		//svcOauthKey: undefined,
		token: undefined,
		userId: undefined
	};
	var dirty = true;

	// Creates a getter/setter pair for each piece of session data.
	Object.keys(contents).forEach(function(key) {
		Object.defineProperty(this, key, {
			enumerable: true,
			get: getValue.bind(this, key),
			set: setValue.bind(this, key)
		});
	}, this);

	function getValue(key) {
		return contents[key];
	}

	function setValue(key, value) {
		if (contents[key] !== value) {
			dirty = true;
			contents[key] = value;
		}
	}

	function clone(copy) {
		copy = copy || {};
		Object.keys(contents).forEach(function(key) {
			copy[key] = getValue(key);
		});
		return copy;
	}

	function signSession(encodedSession) {
		var hmac = crypto.createHmac('sha512', SESSION_SECRET);
		hmac.update(encodedSession);

		return hmac.digest('base64');
	}

	/**
	 * Provides a signed copy of this session to the callback if this session is
	 * dirty.  This session is dirty if it has been modified since it was last
	 * saved (modification includes load()s).  Runs on the next tick so any
	 * pending session changes are included.
	 *
	 * @param {Function} callback Called with a signed session string if this
	 * session is dirty.
	 */
	this.save = function(callback) {
		process.nextTick(function() {
			if (dirty) {
				logger.debug('Saving session: ', contents);

				dirty = false;
				var jsonCopy = JSON.stringify(clone({ savedAt: Date.now() }));

				var encodedSession = new Buffer(jsonCopy).toString('base64');
				callback(encodedSession + ';' + signSession(encodedSession));
			}
		});
	};

	/**
	 * Validates this session string and, if valid, loads its contents into this
	 * session.
	 *
	 * @param {String} signedSession
	 * @returns {Boolean} True if valid and false if invalid.
	 */
	this.load = function(signedSession) {
		if (signedSession && (typeof signedSession.split == 'function')) {
			var parts = signedSession.split(';');
		} else {
			logger.warn('Dropping invalid session: ' + signedSession);
			return false;
		}

		if (parts.length != 2) {
			logger.warn('Dropping invalid session: ' + signedSession);
			return false;
		}

		var encodedSession = parts[0];
		var signature = parts[1];

		if (signature != signSession(encodedSession)) {
			logger.warn('Dropping (potentially) tampered session: ' + signedSession);
			return false;
		}

		var copy = JSON.parse(new Buffer(encodedSession, 'base64').toString());
		if (copy.savedAt < Date.now() - MAX_SESSION_AGE) {
			logger.warn('Dropping expired session: ' + signedSession);
			return false;
		}
		delete copy.savedAt;

		Object.keys(contents).forEach(function(key) {
			setValue(key, copy[key]);
			delete copy[key];
		});
		// Dirty ourselves so the client gets an update with a newer timestamp.
		dirty = true;

		var leftovers = Object.keys(copy);
		if (leftovers.length > 0) {
			logger.warn('Dropping unexpected session keys ' +
					JSON.stringify(leftovers) + ': ' + signedSession);
		}

		logger.debug('Loaded session: ', contents);
		return true;
	};

	/**
	 * Add the properties of this session to the given message.
	 *
	 * @param {Object} [message={}] The object to decorate.
	 */
	this.populateMessage = function(message) {
		return clone(message);
	};

	/**
	 * Clears the session properties pertaining to the logged in session.  This
	 * will finalize on the next tick so anything currently running can finish
	 * with the current session.
	 */
	this.logout = function() {
		var self = this;
		process.nextTick(function() {
			self.token = undefined;
			self.userId = undefined;
		});
	};

	/**
	 * Validates the current session contains logged-in credentials.  The
	 * credentials may be expired as we have no way of knowing here.
	 *
	 * @returns {Boolean} True if session appears to be logged-in.
	 */
	this.isLoggedIn = function() {
		return !!this.userId;
	};

	Object.freeze(this);
}
