Directions on how to run the ActiveStack Docker containers

# OSX and Windows Setup
 If you are on windows or OSX, use [Docker Toolbox](https://www.docker.com/toolbox) to install docker client, docker-machine, docker-compose, and VirtualBox on you machine.

# Linux Setup
 * [docker client](https://docs.docker.com/installation)
 * [docker-machine](https://docs.docker.com/machine/install-machine)
 * [docker-compose](https://docs.docker.com/compose/install)

# Run the images images
* Clone ActiveStack Docker
 * `git clone git@github.com:percero/docker.git`
* Change directories to the docker
 * `cd docker`
* Set your environment variables to talk to your current docker host
 * `eval "$(docker-machine env dev)"` - if using docker-machine where dev is the name of your docker machine
 * If using kinematic, open the docker quickstart terminal and run commands from there
* Create a docker host on your machine
 * `docker-compose up`

# Convert docker machine
* If you previously used boot2docker to start your docker host shut it down before using a different method.
