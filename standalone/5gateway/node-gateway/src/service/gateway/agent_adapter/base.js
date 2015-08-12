'use strict';

module.exports = Base;

/**
 * @class Base class for agent specific processing on gateway messages.
 */
function Base() {
	var prefixRegex;

	/**
	 * @returns {RegExp} RegExp matching the class name prefix for this agent.
	 */
	this.getCNPrefixRegex = function() {
		if (prefixRegex) {
			return prefixRegex;
		}

		var prefix = this.getCNPrefix();
		var escapedPrefix = prefix.replace(/([\\/'*+?|()\[\]{}.^$])/g, '\\$1');
		prefixRegex = new RegExp('^' + escapedPrefix + '\.');
		return prefixRegex;
	};

	/**
	 * @returns {String} Class name prefix this agent cares about.
	 */
	this.getCNPrefix = function() {
		throw new Error('Not implemented error');
	};

	/**
	 * @returns {String[]} Events this agent is responsible for.
	 */
	this.getEvents = function() {
		throw new Error('Not implemented error');
	};

	/**
	 * @param {String} type Name of special message (eg. connect, disconnect)
	 * @param {Object} message Full contents of message.
	 */
	this.processSpecialMessage = function(type, message) {
		// Not required
	};

	/**
	 * @param {String} cn Class name relative to the prefix for eazy matching.
	 * @param {Object} request Full contents of the request.
	 */
	this.processRequest = function(cn, request) {
		// Not required
	};

	/**
	 * @param {String} cn Class name relative to the prefix for eazy matching.
	 * @param {Object} response Full contents of the response.
	 */
	this.processResponse = function(cn, response) {
		// Not required
	};
}
