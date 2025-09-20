#!/bin/bash

echo "🚀 Setting up Git repository for AI CRM Platform..."

# Initialize Git if not already initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
fi

# Set up Git configuration
echo "⚙️ Setting up Git configuration..."
git config user.name "bbrysonelite-max"
git config user.email "bbrysonelite@gmail.com"

# Add all files to staging
echo "📝 Adding files to Git staging..."
git add .

# Show status
echo "📊 Current Git status:"
git status

# Create initial commit
echo "💾 Creating initial commit..."
git commit -m "Initial commit: AI CRM Platform with deployment configuration

- Add comprehensive backend services (agent, AI CRM, analytics, auth, etc.)
- Add React frontend with modern UI components
- Add Docker configuration for containerization
- Add CI/CD pipeline with GitHub Actions
- Add testing setup with Vitest
- Add build configuration (TypeScript, ESLint)
- Add deployment scripts and documentation"

# Add remote origin (update the URL as needed)
echo "🔗 Setting up remote origin..."
git remote add origin https://github.com/bbrysonelite-max/agent-code-leap.git

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git branch -M main
git push -u origin main

echo "✅ Git repository setup complete!"
echo "📱 Your repository is now available at: https://github.com/bbrysonelite-max/agent-code-leap"