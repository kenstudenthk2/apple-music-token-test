# Zero-dependency Node app (see package.json "engines": node >=18). No
# npm install step is needed — this base image only provides the runtime.
#
# Build from the REPO ROOT, not this folder:
#   docker build -f deploy/Dockerfile -t appletune-pairing .
# docker-compose.yml (next task) sets this via `context: ..`.
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY pairing-server.js test-token.js ./
COPY public ./public

# node:20-alpine already ships an unprivileged "node" user/group.
USER node

ENV PORT=8787
ENV HOST=0.0.0.0
EXPOSE 8787

# /api/version will report "no-git" in this container: .git is intentionally
# excluded (.dockerignore) to avoid shipping repo history into a running
# container. pairing-server.js already treats a checkout without .git as a
# normal, handled case — this is that same fallback, not a new failure mode.
CMD ["node", "pairing-server.js"]
