CREATE DATABASE IF NOT EXISTS ActiveServer;
CREATE DATABASE IF NOT EXISTS ActiveServerAuthManager;
GRANT ALL ON `ActiveServer`.* TO 'activeserver'@'%' IDENTIFIED BY 'Welcome#1';
GRANT ALL ON `ActiveServerAuthManager`.* TO 'activeserver'@'%' IDENTIFIED BY 'Welcome#1';
FLUSH PRIVILEGES;

