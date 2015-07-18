# Docker Repo
This repo contains the configs used to build the activestack docker images

# Docker images
The build containers are currently stored  in the [docker hub](https://hub.docker.com) under the percero user account

# Docker install directions
Follow the install [OSX](https://docs.docker.com/installation/mac/) or [Windows](https://docs.docker.com/installation/windows/) directions  to setup your machine for docker

# Example run of an ActiveStack docker image
`$ docker run -d -P -v $HOME/activestack:/opt/activestack --name standalone percero/activestack`

* create the activestack directory in your $HOME dir prior to mapping it above
* `-d` run the container as a deamon
* `-P` publish exposed ports from the container to your localhost. 
  * On non-linux the localhost is the boot2docker VM.
  * To directly access the ports exposed thus use the docker ip `boot2docker ip` e.g. 192.168.59.103:3306
* `-v` maps VM's `$HOME/activestack  directory from the VM to the container
  * boot2docker shares your /Users directory with the VM but not the container. You need to use `-v` to tell it what to map

# Attach to containers bash shell
`docker exec -i -t activestack bash`
