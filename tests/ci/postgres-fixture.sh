#!/usr/bin/env bash
set -euo pipefail

name=$1
database=$2
image='postgres@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929'

# Never point these tests at a remote engine or a published database.
test -z "${DOCKER_HOST:-}${DOCKER_CONTEXT:-}"
test "$(docker context inspect --format '{{ (index .Endpoints "docker").Host }}')" = unix:///var/run/docker.sock
docker pull "$image"
docker tag "$image" postgres:17.6
docker run -d --rm --name "$name" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e "POSTGRES_DB=$database" "$image"
test "$(docker inspect "$name" --format '{{.HostConfig.NetworkMode}} {{.HostConfig.Privileged}} {{len .HostConfig.Binds}} {{len .HostConfig.PortBindings}}')" = 'none false 0 0'

for attempt in {1..30}; do
  if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres -d "$database" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done
echo 'Isolated PostgreSQL fixture did not become ready.' >&2
exit 1
