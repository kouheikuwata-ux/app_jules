# Stage 1: Base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install dependencies
# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Run the application using gunicorn
# The --bind 0.0.0.0:5000 is important to accept connections from outside the container
# We need to point gunicorn to the Flask app instance, which is `app` in `app.py`
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
