FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source files (busts cache when ANY file changes)
# Built: 2026-04-23T18:46:14Z
COPY . .

ENV PORT=5000
EXPOSE 5000

CMD ["python3", "orchestrator.py"]
