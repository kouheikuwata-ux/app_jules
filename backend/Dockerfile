# 1. Use an official Python runtime as a parent image
FROM python:3.11-slim

# 2. Set the working directory in the container
WORKDIR /app

# 3. Copy the requirements file into the container at /app
COPY requirements.txt .

# 4. Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of the application's code into the container at /app
COPY . .

# 6. Make port 5001 available to the world outside this container
EXPOSE 5001

# 7. Define environment variables
# These should be passed in by the container orchestration system (e.g., Docker Compose, Kubernetes, AWS Fargate)
ENV OPENAI_API_KEY=""
ENV SECRET_KEY=""
ENV FLASK_APP=app.py
ENV DATABASE_URL=""
ENV S3_BUCKET=""
ENV S3_REGION=""

# 8. Run the application using Gunicorn
# The server will be accessible from outside the container on port 5001
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "app:app"]
