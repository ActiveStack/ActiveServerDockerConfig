CREATE DATABASE IF NOT EXISTS SyncEngine;
CREATE DATABASE IF NOT EXISTS SyncEngineAuthManager;
GRANT ALL ON `SyncEngine`.* TO 'taskmanager'@'%' IDENTIFIED BY 'Welcome#1';
GRANT ALL ON `SyncEngineAuthManager`.* TO 'taskmanager'@'%' IDENTIFIED BY 'Welcome#1';
FLUSH PRIVILEGES;

