# Pull base image.
FROM debian:wheezy


RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*

# Default to UTF-8 file.encoding
ENV LANG C.UTF-8

#ENV JAVA_VERSION 7u79
#ENV JAVA_DEBIAN_VERSION 7u79-2.5.5-1~deb8u1

RUN apt-get update && apt-get install -y openjdk-7-jdk && rm -rf /var/lib/apt/lists/*

# If you're reading this and have any feedback on how this image could be
#   improved, please open an issue or a pull request so we can discuss it!

