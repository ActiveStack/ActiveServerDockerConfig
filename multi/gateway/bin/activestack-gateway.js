#!/usr/bin/env node
var gateway = require('../src/main.js');

// Pull the command from the command line
var command = process.argv[2] || 'server';

switch(command.toLowerCase()){
    case 's':
        gateway.server();
        break;
    case 'server':
        gateway.server();
        break;
    case 'c':
        gateway.console();
        break;
    case 'console':
        gateway.console();
        break;
    default:
        gateway.server();
        break;
}