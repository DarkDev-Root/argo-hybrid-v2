FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates curl wget iproute2 procps \
    openssh-server \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/run/sshd /root/.ssh \
    && chmod 700 /root/.ssh

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY index.js .
RUN chmod +x index.js

EXPOSE 3000
CMD ["npm", "start"]
