# 2CloudNine Migration Tool

A standalone Salesforce data migration platform built with Next.js, designed to
facilitate seamless data migration between Salesforce organizations.

## 🚀 Features

- **Salesforce OAuth Integration**: Secure authentication with Salesforce
  organizations
- **Data Migration**: Migrate custom objects, records, and relationships
- **Real-time Progress Tracking**: Monitor migration status with live updates
- **Multi-org Support**: Connect and manage multiple Salesforce organizations
- **Migration Templates**: Pre-built templates for common migration scenarios
- **Audit Trail**: Complete logging and reporting of migration activities

## 🏗️ Project Structure

```
tc9-migration-tool/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   ├── home/             # Home pages
│   │   ├── migrations/        # Migration management
│   │   └── orgs/              # Organization management
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── forms/            # Form components
│   │   ├── layout/           # Layout components
│   │   └── features/         # Feature-specific components
│   ├── lib/                  # Utility libraries
│   │   ├── auth/             # Authentication utilities
│   │   ├── database/         # Database utilities
│   │   ├── migration/        # Migration logic
│   │   ├── salesforce/       # Salesforce integration
│   │   └── utils/            # General utilities
│   ├── hooks/                # React hooks
│   └── types/                # TypeScript definitions
├── scripts/                  # Utility scripts
│   ├── auth/                 # Authentication scripts
│   ├── database/             # Database setup scripts
│   └── deployment/           # Deployment scripts
├── docs/                     # Documentation
│   └── screenshots/          # Project screenshots
├── prisma/                   # Database schema and migrations
├── public/                   # Static assets
└── specs/                    # Technical specifications
```

## 🎨 Design System

The project implements the 2CloudNine design language with:

- **Primary Colors**: 2CloudNine blue (#2491EB)
- **Typography**: Inter font family with custom sizing
- **Components**: Built with Radix UI primitives and Tailwind CSS
- **Spacing**: Consistent layout spacing (24px, 16px, 48px)

## 🔧 Technology Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Custom Salesforce OAuth implementation
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
SALESFORCE_CLIENT_ID="your_connected_app_client_id"
SALESFORCE_CLIENT_SECRET="your_connected_app_client_secret"
SALESFORCE_REDIRECT_URI="http://localhost:3000/api/auth/callback/salesforce"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_nextauth_secret"

# Application
NODE_ENV="development"
```

## 📊 Salesforce Integration

### Supported Objects

- Custom objects (tc9_interpretation_rule__c, tc9_breakpoint__c,
  tc9_pay_code__c)
- Standard objects (Account, Contact, etc.)
- Custom relationships and lookups

### API Features

- **Bulk API**: For large data migrations (>200 records)
- **REST API**: For smaller datasets and metadata operations
- **Metadata API**: For schema discovery and validation

## 🔄 Migration Workflow

1. **Connect Organizations**: Authenticate source and target Salesforce orgs
2. **Discover Schema**: Automatically detect objects and relationships
3. **Create Migration Plan**: Define what data to migrate
4. **Execute Migration**: Run the migration with real-time monitoring
5. **Review Results**: Analyze success/failure rates and logs

## 📝 Scripts

### Authentication Scripts (`scripts/auth/`)

- `test-auth-flow.js` - Test OAuth authentication flow
- `check-connected-app.js` - Verify connected app configuration
- `extract-consumer-key.js` - Extract client credentials

### Database Scripts (`scripts/database/`)

- `dbsetup.js` - Initialize database schema

### Deployment Scripts (`scripts/deployment/`)

- `deploy.sh` - Deploy to production
- `setup-env.js` - Environment configuration helper

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:auth
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

## 📚 Documentation

- [API Documentation](./docs/api.md)
- [Migration Guide](./docs/migration-guide.md)
- [Troubleshooting](./docs/troubleshooting.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

## 🆘 Support

For support and questions:

- Create an issue in this repository
- Contact the 2CloudNine team
- Check the documentation in the `docs/` directory

---

Built with ❤️ by the 2CloudNine team
