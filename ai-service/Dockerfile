# Stage 1: Build Stage
FROM python:3.10-slim AS builder

WORKDIR /build

# Install OS dependencies needed for compiling dlib and face_recognition
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    pkg-config \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install them, building wheels
COPY requirements.txt .

# We create wheels for all dependencies to avoid installing build tools in final image
RUN pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt

# Stage 2: Final Runtime Stage
FROM python:3.10-slim AS runner

WORKDIR /app

# Install runtime OS dependencies required by OpenCV and dlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy the pre-built wheels from the builder stage
COPY --from=builder /build/wheels /wheels
COPY --from=builder /build/requirements.txt .

# Install packages from the built wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Copy application code
COPY . .

# Run the FastAPI server
EXPOSE 8000
ENV PORT=8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
