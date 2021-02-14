#!/bin/sh
docker-compose up -d
sleep 20
docker-compose run --rm hasura-node-test sh -c "npm install && npm test"
