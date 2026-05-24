FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install SWE-bench evaluation harness
RUN pip install --no-cache-dir swebench

# Install Mythos CLI
# Adjust the method based on your distribution
COPY . /opt/mythos
WORKDIR /opt/mythos
RUN bun install && bun run build

# Create evaluation workspace
RUN mkdir -p /eval/workspace

WORKDIR /eval

# Default entrypoint runs the evaluation
ENTRYPOINT ["bun", "run", "/opt/mythos/scripts/benchmark/runner.ts"]
