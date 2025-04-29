FROM python:3.10-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY back-end.py /app/
COPY requirements.txt /app/

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8585

CMD ["uvicorn", "back-end:app", "--host", "0.0.0.0", "--port", "8585"] 