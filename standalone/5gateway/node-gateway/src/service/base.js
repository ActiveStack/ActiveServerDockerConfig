'use strict';

module.exports = Base;

function Base() {
	this.handleError = function(error, source) {
		// Not required
	};
	this.handleShutdown = function(shutdownType) {
		// Not required
	};
    this.dispose = function() {

    };
}
