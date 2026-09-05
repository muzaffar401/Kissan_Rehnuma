FROM python:3.14-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY pyproject.toml README.md ./
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY token_server.py .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Install Python dependencies
RUN pip install --no-cache-dir -e .

EXPOSE 8080

# "agent"        — run Alembic migrations, then the LiveKit agent worker
# "token-server" — run the token server for the frontend (port 8080)
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["agent"]
