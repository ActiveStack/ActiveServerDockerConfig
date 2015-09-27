'use strict';

var winston = require('winston');

module.exports = PrefixedLogger;

/**
 * @class This is a wrapper for a Winston instance that prefixes all messages.
 *
 * @param logger Winston instance.
 * @param {String} prefix Prefix to append to all logging calls made on this
 * instance.
 */
function PrefixedLogger(prefix) {

    var logger = new winston.Logger({
        transports: [
            new winston.transports.Console({ level: 'info' })
        ],
        levels: { silly: 0, debug: 1, verbose: 2, info: 3, warn: 4, error: 5 }
    });

    this.prefix = prefix?prefix:process.pid;
    //this.__proto__ = logger;

    /**
     * Constructs the logging functions based on the levels
     */
    Object.keys(logger.levels).forEach(function(level) {
        this[level] = function() {
            var newDate = new Date();
            arguments[0] = newDate.getFullYear() + "-" +
            (newDate.getMonth()+1) + "-" +
            newDate.getDate() + " " +
            newDate.getHours() + ":" +
            newDate.getMinutes() + ":" +
            newDate.getSeconds() + "," +
            newDate.getMilliseconds() + " " +
            this.prefix + ' > ' +
            arguments[0];

            logger[level].apply(logger, arguments);
        };
    }, this);
}

PrefixedLogger.prototype.extendPrefix = function(prefix){
    return new PrefixedLogger(this.prefix+" "+prefix);
}
