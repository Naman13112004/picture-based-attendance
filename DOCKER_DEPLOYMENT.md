# Docker Deployment Guide for Picture-Based Attendance

This document provides instructions on how to run, deploy, and manage the dockerized version of the application.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed.
- Docker Hub account.

---

## 1. Local Development with Docker

To run the full stack locally with hot-reloading:

1. Copy `.env.example` to `.env` in the root and fill in the required variables (Supabase, Google Auth, etc.).
2. Run the development compose file:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```
3. The services will be available at:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000
   - AI Service: http://localhost:8000

---

## 2. GitHub Actions CI/CD Setup

The repository is configured to automatically build and push optimized Docker images to Docker Hub on every push to the `main` branch.

### Required GitHub Secrets

To make the workflow succeed, you must add the following Repository Secrets in your GitHub repository (`Settings` > `Secrets and variables` > `Actions`):

- `DOCKERHUB_USERNAME`: Your Docker Hub username.
- `DOCKERHUB_TOKEN`: A Personal Access Token generated from Docker Hub. (Go to Docker Hub > Account Settings > Security > New Access Token).

**Workflow Features:**
- Uses **Docker Buildx** with layer caching to drastically reduce the build time of the `ai-service` (dlib compilation).
- Tags images with `latest` and a specific Git SHA for easy rollbacks.

---

## 3. Production Deployment (Render)

Render is a great platform to host this application. However, their free tier has strict RAM limits.

### Optimizations Included
- **Multi-stage Builds**: The Next.js frontend uses `standalone` output mode (cutting size by 80%). The `ai-service` builds wheels in one stage and copies them to a lightweight python image, dropping all C++ build tools and source code.
- **Node CI**: We omit `devDependencies` during production builds.

### Render Deployment Steps

#### Backend (Web Service)
1. Create a New Web Service.
2. Choose **Deploy an existing image from a registry**.
3. Image URL: `your_docker_username/snapattend-backend:latest`
4. Set Environment Variables:
   - `DATABASE_URL` (Use Render's PostgreSQL URL)
   - `JWT_SECRET`, `GOOGLE_CLIENT_ID`, etc.
   - `PYTHON_API_URL` (Set this to the Render URL of your AI Service)

#### Frontend (Web Service)
1. Create a New Web Service.
2. Choose **Deploy an existing image**.
3. Image URL: `your_docker_username/snapattend-frontend:latest`
4. Set Environment Variables:
   - `NEXT_PUBLIC_BACKEND_API_URL` (Set to your Render backend URL)

#### AI Service (Web Service)
*The AI Service uses the heavy `face_recognition` library. Deploying this effectively requires specific tuning.*
1. Create a New Web Service using `your_docker_username/snapattend-ai-service:latest`.
2. **Cold Starts**: Render spins down free tier instances after 15 minutes of inactivity. When it wakes up, it has to load the ML models into RAM. **Recommendation**: Either upgrade to a paid "Starter" tier ($7/mo) for the AI Service to prevent cold starts, or use a cron job (like UptimeRobot) to ping the `/` health check endpoint every 10 minutes.
3. **RAM Limits**: `face_recognition` can spike RAM usage above the 512MB free tier limit if many images are processed concurrently. The Docker image uses `python:3.10-slim` to leave as much RAM as possible for the actual model execution.

### General Troubleshooting

- **Database Issues**: If the backend fails to start, ensure the `DATABASE_URL` is correct and PostgreSQL is running.
- **AI Build Fails on GitHub**: If the GitHub Action fails or takes too long, ensure layer caching is working. The first build takes ~5-10 minutes, subsequent builds take <1 minute.
