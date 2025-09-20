# AI CRM Platform

A comprehensive AI-powered CRM platform with intelligent nurturing, analytics, and automation capabilities built with Encore.ts and React.

## Features

- 🤖 AI-powered lead scoring and recommendations
- 📧 Intelligent email nurturing sequences
- 📊 Advanced analytics and reporting
- 🔗 HubSpot integration
- 💳 Stripe payment processing
- 🛡️ GDPR compliance tools
- 🚀 Real-time notifications
- 📈 Performance monitoring

## Tech Stack

- **Backend**: Encore.ts, TypeScript, PostgreSQL, Redis
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Testing**: Vitest
- **Deployment**: Docker, GitHub Actions

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Encore CLI

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-crm-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development environment:
```bash
# Using Docker Compose
docker-compose --profile dev up

# Or run locally
npm run dev
```

## Deployment

### Docker

Build and run with Docker:
```bash
# Build image
docker build -t ai-crm-platform .

# Run container
docker run -p 4000:4000 ai-crm-platform
```

### Using Docker Compose

```bash
# Production
docker-compose up

# Development
docker-compose --profile dev up
```

### Encore.ts Cloud

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run type-check` - Type checking

## API Documentation

The API is built with Encore.ts and provides the following services:

- **Agent**: AI agent management and control
- **AI CRM**: Core CRM functionality with AI features
- **Analytics**: Business intelligence and reporting
- **Auth**: Authentication and authorization
- **Email**: Email campaigns and templates
- **Payment**: Stripe integration for billing
- **HubSpot**: CRM integration
- **Nurturing**: Intelligent lead nurturing
- **Scoring**: AI-powered lead scoring

## Environment Variables

See `.env.example` for all available environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.