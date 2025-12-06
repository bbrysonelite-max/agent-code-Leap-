# Railway Deployment Steps

1. Go to https://railway.app/
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Connect the express-backend repo
6. Add PostgreSQL database (click "Add Service" → "Database" → "PostgreSQL")
7. Set environment variables from .env file
8. Deploy

OR use CLI:
```bash
npm i -g @railway/cli
railway login
railway init
railway up
```
