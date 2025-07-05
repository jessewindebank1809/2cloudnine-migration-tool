# 2cloudnine Migration Tool

A sophisticated enterprise-grade web application for facilitating seamless data migration between Salesforce organisations, specifically focused on migrating 2cloudnine product objects. Built with modern web technologies and designed for reliability, scalability, and ease of use.

## 🚀 Features

### Core Capabilities
- **Salesforce OAuth Integration**: Secure authentication with Production, Sandbox, and Scratch orgs
- **Data Migration Engine**: Migrate custom objects, records, and relationships with field mapping
- **Pre-built Templates**: Ready-to-use migration templates for:
  - Interpretation Rules
  - Pay Codes
  - Leave Rules
  - Award Classifications and Levels
  - Minimum Pay Rates
- **Real-time Progress Tracking**: Monitor migration status with live updates
- **Multi-org Support**: Connect and manage multiple Salesforce organisations

### Advanced Features
- **Scheduled Migrations**: Schedule migrations with cron expressions
- **Queue Management**: BullMQ-powered job queuing with Redis
- **Rollback Capabilities**: Undo failed migrations
- **Analytics Dashboard**: Track migration metrics and insights
- **Audit Trail**: Complete logging and reporting of migration activities
- **Usage Monitoring**: Track API calls and resource utilisation
- **Admin Panel**: User management and system configuration
- **Feedback System**: Built-in feedback with file attachments support

## 🔧 Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui (Radix UI)
- **State Management**: Zustand, TanStack Query
- **Animations**: Framer Motion
- **Forms**: React Hook Form with Zod validation

### Backend
- **API**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better Auth with Salesforce OAuth
- **Queue Management**: BullMQ with Redis
- **Salesforce Integration**: JSForce
- **Error Tracking**: Sentry

### Infrastructure
- **Runtime**: Node.js / Bun
- **Containerisation**: Docker
- **Deployment**: Fly.io
- **Monitoring**: Built-in analytics and metrics

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Bun 1.0+
- PostgreSQL database
- Redis server (for job queuing)
- Salesforce Developer/Production org with Connected App

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tc9-migration-tool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser** Navigate to
   [http://localhost:3000](http://localhost:3000)

## 🔐 Environment Configuration

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/migration_tool"

# Salesforce OAuth
SALESFORCE_PRODUCTION_CLIENT_ID="your_connected_app_client_id"
SALESFORCE_PRODUCTION_CLIENT_SECRET="your_connected_app_client_secret"
SALESFORCE_SANDBOX_CLIENT_ID="your_sandbox_client_id"
SALESFORCE_SANDBOX_CLIENT_SECRET="your_sandbox_client_secret"

# Better Auth
BETTER_AUTH_SECRET="your_auth_secret"
BETTER_AUTH_URL="http://localhost:3000"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENCRYPTION_KEY="your_32_character_encryption_key"

# Queue Management
REDIS_URL="redis://localhost:6379"

# Error Tracking (Optional)
SENTRY_DSN="your_sentry_dsn"
```

## 🔄 Migration Workflow

1. **Connect Organisations**: Authenticate source and target Salesforce orgs
2. **Discover Schema**: Automatically detect objects and relationships
3. **Create Migration Plan**: Define what data to migrate
4. **Execute Migration**: Run the migration with real-time monitoring
5. **Review Results**: Analyse success/failure rates and logs

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 🚢 Deployment

### Docker

```bash
# Build image
docker build -t migration-tool .

# Run container
docker run -p 3000:3000 migration-tool
```

### Fly.io

```bash
# Deploy to Fly.io
fly deploy
```

## 📝 Scripts

### Development
- `npm run dev` - Start development server
- `npm run dev:fresh:env` - Start with fresh environment variables
- `npm run build` - Build for production
- `npm run start` - Start production server

### Database
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data

### Testing & Quality
- `npm run test` - Run unit tests
- `npm run test:coverage` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Deployment
- `npm run deploy:staging` - Deploy to staging
- `npm run deploy:production` - Deploy to production

## 🏗️ Project Structure

```
src/
├── app/                  # Next.js app router pages and API routes
│   ├── api/             # API endpoints for migration operations
│   ├── auth/            # Authentication pages
│   ├── migrations/      # Migration UI pages
│   ├── orgs/            # Organisation management
│   └── templates/       # Template management
├── components/          # React components
│   ├── features/        # Feature-specific components
│   ├── layout/          # Layout components
│   ├── providers/       # Context providers
│   └── ui/              # Reusable UI components
├── lib/                 # Core business logic
│   ├── auth/            # Authentication utilities
│   ├── migration/       # Migration engine and services
│   ├── salesforce/      # Salesforce API integration
│   └── utils/           # Utility functions
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
└── prisma/              # Database schema and migrations
```

## 🔐 Security Features

- **Token Encryption**: Salesforce tokens are encrypted at rest
- **Session Management**: IP and user agent tracking for security
- **Role-Based Access**: Admin and User role separation
- **CSRF Protection**: Built-in CSRF token validation
- **Secure OAuth Flow**: Industry-standard OAuth 2.0 implementation

---

Built with ❤️ by the 2cloudnine team
