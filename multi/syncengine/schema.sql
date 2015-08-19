CREATE DATABASE IF NOT EXISTS SyncEngine;
CREATE DATABASE IF NOT EXISTS SyncEngineAuthManager;
GRANT ALL ON `SyncEngine`.* TO 'syncengine'@'%' IDENTIFIED BY 'Welcome#1';
GRANT ALL ON `SyncEngineAuthManager`.* TO 'syncengine'@'%' IDENTIFIED BY 'Welcome#1';
FLUSH PRIVILEGES;

