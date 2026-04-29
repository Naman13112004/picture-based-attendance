#!/bin/bash

echo "🚀 Setting up Picture-Based Attendance System..."

# --- Frontend ---
echo "📦 Installing Frontend Dependencies..."
cd frontend
npm install
cd ..

# --- Backend ---
echo "📦 Installing Backend Dependencies..."
cd backend
npm install
cd ..

# --- AI Service ---
echo "📦 Installing AI Service Dependencies..."
cd ai-service
# It is recommended to use a virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv based on OS
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ "$OSTYPE" == "win32"* ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ..

echo "✅ Setup Complete!"
echo "Make sure you have copied .env.example to .env and filled in the values."
echo "You can now run the services individually."
