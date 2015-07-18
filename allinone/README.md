# Docker image
* target: `percero/activestack`
* private till tested internally then public

# Specs
* OS: `Debian:wheezy` 
  * base public images based on this

#### Application Versions
* NodeJS v0.10.x
* [TODO] Node-Gateway (https://github.com/percero/node-gateway)
  * This also has the pfcontrol: https://github.com/percero/node-gateway/blob/master/scripts/pfcontrol
* JavaSDK v1.6
* MySQL v5.x
* Redis v2.8.x
* RabbitMQ v3.3.x

#### Other
* [TODO] Node-Gateway (https://github.com/percero/node-gateway)

# Base Docker Images used
* https://registry.hub.docker.com/u/readytalk/nodejs/
* https://registry.hub.docker.com/_/redis/
* https://github.com/docker-library/java/tree/master/openjdk-7-jdk
* https://registry.hub.docker.com/_/mysql/
* https://registry.hub.docker.com/_/rabbitmq/

# Building all in one image
* [Setup](https://github.com/percero/docker/blob/master/README.md) your machine for docker
* `./build-images.sh`

# Push to hub.docker.com
* Need percero login credentials
* `docker login`
* `docker push percero/activestack`

# Run the standalone image
* `docker run -d -P -v $HOME/activestack:/opt/activestack --name activestack --oom-kill-disable -e MYSQL_ROOT_PASSWORD=q7CQhRLBGNTYK4 percero/gateway`

# Attach to the standalone image
* `docker exec -i -t activestack bash`
