FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install all language toolchains
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    nodejs \
    npm \
    golang-go \
    rustc \
    cargo \
    g++ \
    bash \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python test tools
RUN pip3 install --break-system-packages pytest

# Install Node test tools
RUN npm install -g jest ts-node typescript

# Install Bun for TypeScript/Olympuz
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /eval

CMD ["bash"]
