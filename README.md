# 2cloudnine Migration Tool

A standalone web application built with Next.js, designed to facilitate seamless
data migration between 2cloudnine product objects. Written in TypeScript. Works
with prebuilt migration templates.

## 🚀 Features

- **Salesforce OAuth Integration**: Secure authentication with Salesforce
  organisations
- **Data Migration**: Migrate custom objects, records, and relationships
- **Real-time Progress Tracking**: Monitor migration status with live updates
- **Multi-org Support**: Connect and manage multiple Salesforce organisations
- **Migration Templates**: Pre-built templates for common migration scenarios
- **Audit Trail**: Complete logging and reporting of migration activities

## 🔧 Technology Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Salesforce OAuth with Better Auth
- **API Integration**: Salesforce REST/Bulk APIs
- **Deployment**: Docker, Fly.io

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Salesforce Developer/Production org

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

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## 🏗️ Project Structure

```
src/
├── app/              # Next.js app router
├── components/       # React components
├── lib/             # Utility libraries
├── hooks/           # React hooks
└── types/           # TypeScript definitions
```

---

Built with ❤️ by the 2cloudnine team
