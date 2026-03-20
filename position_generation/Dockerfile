FROM python:3.11-slim

RUN apt-get update && apt-get install -y wget tar && rm -rf /var/lib/apt/lists/* \
    && wget -q https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-ubuntu-x86-64-avx2.tar && \
    tar -xf stockfish-ubuntu-x86-64-avx2.tar && \
    mv stockfish/stockfish-ubuntu-x86-64-avx2 /usr/local/bin/stockfish && \
    chmod +x /usr/local/bin/stockfish && \
    rm -rf stockfish stockfish-ubuntu-x86-64-avx2.tar

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["celery", "-A", "service.app", "worker", "-Q", "eval,tactics", "--loglevel=info"]
