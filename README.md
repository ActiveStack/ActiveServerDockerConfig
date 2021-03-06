Directions on how to run the ActiveStack Docker containers

# OSX and Windows Setup
 If you are on windows or OSX, use [Docker Toolbox](https://www.docker.com/toolbox) to install docker client, docker-machine, docker-compose, and VirtualBox on you machine.

# Linux Setup
 * [docker client](https://docs.docker.com/installation)
 * [docker-machine](https://docs.docker.com/machine/install-machine)
 * [docker-compose](https://docs.docker.com/compose/install)

# Run the images images
0. Run "Docker Quickstart Terminal".  In the Docker terminal:
2. Clone ActiveStack Docker
 * `git clone git@github.com:activestack/ActiveServerDockerConfig.git`

3. Change directories to ActiveServerDockerConfig
 * `cd ActiveServerDockerConfig/simple` for single docker instances for each component (activeserver, mysql, redis, rabbitmq)
 * `cd ActiveServerDockerConfig/clustred` for some components in a cluster (currently rabbitmq. Others comming soon ...)
4. Start the containers 
 * `docker-compose up` foreground
 * `docker-compose up -d` daemon

## Helpful Commands
From within a Docker terminal:
* `docker-machine ip dev` - To see which ports the containers are running on
* `docker ps` - Lists all running containers
* ` sudo docker exec -i -t <container-d>  bash` - To attach to bash in a particular running container

## Other Notes
* The database files are stored within the MySQL Docker container, which could be useful to create a container with seed data for dev.

