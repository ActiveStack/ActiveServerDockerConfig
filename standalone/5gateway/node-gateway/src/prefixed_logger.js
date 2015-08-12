'use strict';

module.exports = PrefixedLogger;
module.exports.decorateLogger = decorateLogger;

/**
 * @class This is a wrapper for a Winston instance that prefixes all messages.
 *
 * @param logger Winston instance.
 * @param {String} prefix Prefix to append to all logging calls made on this
 * instance.
 */
function PrefixedLogger(logger, prefix) {
	this.__proto__ = logger;

	Object.keys(logger.levels).forEach(function(level) {
		this[level] = function() {
			var newDate = new Date();
			arguments[0] = newDate.getFullYear() + "-" + (newDate.getMonth()+1) + "-" + newDate.getDate() + " " + newDate.getHours() + ":" + newDate.getMinutes() + ":" + newDate.getSeconds() + "," + newDate.getMilliseconds() + " " + prefix + ' > ' + arguments[0];
			logger[level].apply(logger, arguments);
		};
	}, this);
}

/**
 * Creates an "extendPrefix" method on the specified logger instance.  This new
 * method returns a PrefixedLogger based on the specified prefix.
 *
 * @param logger Winston instance to decorate.
 */
function decorateLogger(logger) {
	logger.extendPrefix = function(prefix) {
		return new PrefixedLogger(this, prefix);
	};
}
