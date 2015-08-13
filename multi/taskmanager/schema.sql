CREATE DATABASE IF NOT EXISTS TaskManager;
CREATE DATABASE IF NOT EXISTS TaskManagerAuthManager;
GRANT ALL ON `TaskManager`.* TO 'taskmanager'@'%' IDENTIFIED BY 'Welcome#1';
GRANT ALL ON `TaskManagerAuthManager`.* TO 'taskmanager'@'%' IDENTIFIED BY 'Welcome#1';
FLUSH PRIVILEGES;

