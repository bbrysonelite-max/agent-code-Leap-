# Git Repository Setup Commands

## Automatic Setup (Recommended)
Run the setup script:
```bash
chmod +x setup-git.sh
./setup-git.sh
```

## Manual Setup (Alternative)
If you prefer to run commands manually:

### 1. Initialize Git and configure
```bash
git init
git config user.name "bbrysonelite-max"
git config user.email "your-email@example.com"  # Update with your email
```

### 2. Add files and commit
```bash
git add .
git status
git commit -m "Initial commit: AI CRM Platform with deployment configuration"
```

### 3. Set up remote and push
```bash
git remote add origin https://github.com/bbrysonelite-max/agent-code-leap.git
git branch -M main
git push -u origin main
```

## Important Notes

1. **Update your email**: Replace `your-email@example.com` with your actual GitHub email
2. **Repository URL**: I'm using `agent-code-leap` as the repository name - adjust if different
3. **Authentication**: You may need to authenticate with GitHub (use personal access token)

## If Repository Already Exists
If the repository already exists on GitHub:
```bash
git remote set-url origin https://github.com/bbrysonelite-max/agent-code-leap.git
git push -u origin main
```

## Files Being Committed
- All backend services and API endpoints
- Complete frontend React application
- Docker configuration (Dockerfile, docker-compose.yml)
- CI/CD pipeline (GitHub Actions)
- Build configuration (TypeScript, ESLint, Vitest)
- Documentation (README.md)
- Deployment scripts