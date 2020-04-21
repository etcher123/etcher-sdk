# Etcher SDK

See [examples](./examples) and [typedoc generated README](./doc/README.md)


## Howto

In order to build the examples on your machine:

    ./build-examples.sh

In order to build the examples in a Docker container:

    # For apt-cacher-ng users
    export http_proxy=http://172.17.0.1:3142

    # Create the docker image 'ubuntu/etcher-sdk/example-builder'
    cd docker
    ./build-docker-image.sh
    cd ..

    # Build the examples in the docker container
    ./docker/build-examples-in-container.sh

