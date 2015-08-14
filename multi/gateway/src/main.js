/**
 * This is the main entry point into the activestack gateway module
 */
module.exports = new ActiveStackGateway();


/**
 * This class acts as the command handler into the Gateway. Currently it can only act as a singleton.
 * @constructor
 */
function ActiveStackGateway(){
    return {
        server: function(){
            require('./server_application.js');
        },
        console: function(){
            require('./console.js')
        }
    }
}