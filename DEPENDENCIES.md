# Dependencies & Acknowledgments

**E-Commerce Software — Marketplace Backend**

---

## Open-Source Projects & Their Licenses

This backend software builds on the work of many talented developers and
open-source communities. We are grateful for their contributions.

---

## Core Dependencies

### Commerce Engine
| Project | License | Purpose |
|---------|---------|---------|
| **MedusaJS** | MIT | Core e-commerce platform and API |
| Link | https://github.com/medusajs/medusa | - |

### Runtime & Language
| Project | License | Purpose |
|---------|---------|---------|
| **Node.js** | MIT | JavaScript runtime environment |
| **TypeScript** | Apache 2.0 | Type-safe JavaScript |
| Link | https://nodejs.org | https://www.typescriptlang.org |

### Database
| Project | License | Purpose |
|---------|---------|---------|
| **PostgreSQL** | PostgreSQL License | Relational database |
| **TypeORM** | MIT | Database ORM |
| Link | https://www.postgresql.org | https://typeorm.io |

### Web Framework
| Project | License | Purpose |
|---------|---------|---------|
| **Express.js** | MIT | Web application framework |
| **NestJS** | MIT | Progressive Node.js framework |
| Link | https://expressjs.com | https://nestjs.com |

---

## Authentication & Security

| Project | License | Purpose |
|---------|---------|---------|
| **Passport.js** | MIT | Flexible authentication middleware |
| **JWT (jsonwebtoken)** | MIT | JSON Web Token implementation |
| **bcryptjs** | MIT | Password hashing |
| **helmet** | MIT | HTTP headers security |

---

## Payment Processing

| Project | License | Purpose |
|---------|---------|---------|
| **Stripe SDK** | Proprietary | Payment processor integration |
| **Razorpay SDK** | Proprietary | Indian payment gateway |
| **Medusa Payment Plugins** | MIT | Payment provider adapters |

---

## File Storage & Cloud

| Project | License | Purpose |
|---------|---------|---------|
| **DigitalOcean Spaces SDK** | MIT | Cloud object storage |
| **AWS SDK** | Apache 2.0 | Amazon cloud services |
| **Google Cloud SDK** | Apache 2.0 | Google cloud services |
| **Multer** | MIT | File upload middleware |

---

## Logging & Monitoring

| Project | License | Purpose |
|---------|---------|---------|
| **Winston** | MIT | Logging library |
| **Pino** | MIT | Fast logger |
| **Sentry** | Proprietary/open-source | Error tracking |
| **Morgan** | MIT | HTTP request logger |

---

## Data Validation & Serialization

| Project | License | Purpose |
|---------|---------|---------|
| **Joi / Yup** | BSD / MIT | Data validation |
| **class-validator** | MIT | Decorator-based validation |
| **Serializers** | MIT | Data serialization |

---

## Email & Notifications

| Project | License | Purpose |
|---------|---------|---------|
| **Nodemailer** | MIT | Email sending |
| **SendGrid SDK** | MIT | Email service |
| **Twilio SDK** | Apache 2.0 | SMS/communications |

---

## Task Scheduling & Queues

| Project | License | Purpose |
|---------|---------|---------|
| **Bull** | MIT | Redis-based job queue |
| **node-cron** | MIT | Task scheduling |
| **RabbitMQ client** | MIT | Message queuing |

---

## Development & Testing

| Project | License | Purpose |
|---------|---------|---------|
| **Jest** | MIT | Testing framework |
| **Supertest** | MIT | HTTP assertion library |
| **ESLint** | MIT | Code linting |
| **Prettier** | MIT | Code formatting |
| **Nodemon** | MIT | Development auto-reload |

---

## How to Find All Dependencies

Run one of these commands in the project root:

```bash
# List direct dependencies
npm ls --depth=0

# View package.json
cat package.json

# View all resolved versions
cat yarn.lock  # or package-lock.json

# Check for vulnerabilities
npm audit
```

---

## MedusaJS Ecosystem

This backend uses **MedusaJS**, which provides:

### Core Features:
- RESTful API for e-commerce
- Admin APIs for management
- Product catalog management
- Order processing pipeline
- Customer management
- Extensible plugin system
- Multi-tenant ready
- Commerce modules (payments, shipping, etc.)

### MedusaJS Dependencies:
MedusaJS itself depends on many projects (Express, TypeORM, PostgreSQL, etc.),
each with their own separate licenses.

**Medusa License:** MIT (https://github.com/medusajs/medusa)

---

## License Compliance

### Your Responsibilities:

1. **Review Licenses:**
   - Check each dependency's license in node_modules/[package-name]/LICENSE
   - GitHub repository (github.com/[owner]/[package])
   - npmjs.com package page

2. **Comply with Terms:**
   - MIT/Apache/BSD: Include license notices
   - GPL: Disclose source code (share-alike requirement)
   - Proprietary: Follow specific terms

3. **In Your Distributions:**
   - Include LICENSES directory with all dependency licenses
   - List all dependencies in DEPENDENCIES.md
   - Include attribution notices

4. **Common License Types:**
   | License | Viral? | Attribution | Commercial | Modification |
   |---------|--------|-------------|------------|--------------|
   | MIT | No | Required | Allowed | Allowed |
   | Apache 2.0 | No | Required | Allowed | Allowed |
   | BSD | No | Required | Allowed | Allowed |
   | GPL | Yes* | Required | Allowed** | Required |
   | AGPL | Yes | Required | Allowed** | Required |

   \* Viral = requires sharing source code
   \*\* Only if source is disclosed

---

## Third-Party Services

Some integrations use external services with separate terms:

| Service | Purpose | License |
|---------|---------|---------|
| **Razorpay** | Payment processing | Proprietary |
| **Stripe** | Payment processor | Proprietary |
| **DigitalOcean** | Cloud services | Proprietary |
| **SendGrid** | Email service | Proprietary |
| **Sentry** | Error tracking | Proprietary/Open |
| **AWS/GCP** | Cloud infrastructure | Proprietary |

These services have **separate Terms of Service** beyond this license.

---

## Vulnerability Management

Keep your dependencies updated and secure:

```bash
# Check for security vulnerabilities
npm audit

# Update dependencies
npm update

# Audit and fix
npm audit fix

# Regular scanning
npm audit --production
```

---

## Open Source Contributions

If you improve or modify any dependencies:

1. **Contribute back** to the original projects
2. **Follow** each project's CONTRIBUTING.md
3. **Submit** pull requests to maintainers
4. **Credit** original authors in your contributions
5. **Respect** each project's governance

---

## License Questions?

**Q: Can I use this commercially?**
A: Yes, but review each dependency's license. Most MIT/Apache/BSD licenses
   allow commercial use. GPL has share-alike requirements.

**Q: Do I need to distribute all licenses?**
A: If you distribute the code, YES. Include all dependency licenses.

**Q: Where are all the licenses?**
A: Check node_modules/[package-name]/LICENSE for each dependency.

**Q: What if licenses conflict?**
A: The more restrictive license applies. Avoid GPL + proprietary combinations.

**Q: How do I list all licenses?**
A: Use npm-license-checker:
   ```bash
   npm install -g npm-license-checker
   nlc
   ```

---

## Complete Dependency List

For a complete, always-up-to-date list of all dependencies:

```bash
npm ls
```

This shows the entire dependency tree with versions.

---

## Summary

This backend is built on excellent open-source projects. Every dependency
has been carefully chosen for quality, maintainability, and license
compatibility.

**Always review licenses** of all your dependencies before deployment.
This document is informational; each dependency's actual license governs
its legal usage.

---

**Special Thanks** to:
- **MedusaJS team** and contributors
- **Node.js foundation** and maintainers
- All open-source developers whose work makes this possible

**Thank you! 🙏**

---

Last Updated: March 2026
Contact: hk8913114@gmail.com
GitHub: https://github.com/Newbie-Himanshu
