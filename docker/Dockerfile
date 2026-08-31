# syntax=docker/dockerfile:1

# Pinned to an exact Bun version rather than `:1` or `:latest`, which both move. A base image that
# shifts underneath a release means the artefact that passed the gates is not the artefact that
# shipped — the same class of claim this repo refuses to make anywhere else.
FROM oven/bun:1.3.14-alpine AS runtime
WORKDIR /usr/src/app

# No dependency stage, and no node_modules in the image.
#
# Bun's own guide splits dev and production installs, which is right when a runtime has third-party
# dependencies. This one has none: `dependencies` in package.json is empty, every third-party
# package is a devDependency used by the gates, and the only non-relative imports under src/ are
# `bun:sqlite` and `node:crypto`. Installing anything here would ship a toolchain the process never
# loads, and `bun install` at build time would fail closed the day that stops being true — which is
# the behaviour worth having.
#
# The gates are not run here either. `bun run verify` needs tests/ and scripts/, which .dockerignore
# keeps out of the build context on purpose, and CI runs the identical command on every push.

# tsconfig comes along because it is load-bearing at runtime, not just at build: `paths` maps
# @custodian/* onto src/*/index.ts, and Bun resolves those at import time. Without it the process
# cannot find a single component.
#
# One file, not two. tsconfig.base.json was merged into tsconfig.json when the 27 workspace packages
# collapsed; this COPY still named it for one commit, and the build broke with nothing to catch it
# because CI did not build the image. It does now.
COPY package.json tsconfig.json ./
COPY src ./src

# Every durable store lands in one mounted directory. Scattered across the image they are lost on
# redeploy — and for the sealed stores that is not a cache miss, it is ciphertext that outlives the
# process while nothing can ever read it again.
RUN mkdir -p /data && chown bun:bun /data
ENV CUSTODIAN_LOG_DB=/data/custodian-log.sqlite \
    CUSTODIAN_CLAIMS_DB=/data/custodian-claims.sqlite \
    CUSTODIAN_REGISTRY_DB=/data/custodian-registry.sqlite \
    CUSTODIAN_INDEX_DB=/data/custodian-index.sqlite \
    HOST=0.0.0.0 \
    PORT=8787
VOLUME ["/data"]
EXPOSE 8787

# The image ships with this user; the process writes only to /data, which is a volume.
USER bun

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD bun -e "process.exit((await fetch('http://127.0.0.1:8787/health')).ok ? 0 : 1)"

# Exec form, so the process is PID 1 and receives SIGTERM directly. Under a shell it would not, and
# `server.stop()` would never run — in-flight runs would be cut off mid-write, which for the
# execution log means losing the tail of the record that run exists to leave behind.
ENTRYPOINT ["bun", "src/agent/main.ts"]
