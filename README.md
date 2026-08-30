# 💊 Pharmacy Companion Pro

> A modern Pharmacy CRM designed to simplify pharmacy operations — from stock and expiry management to invoice processing, OCR, and automated email workflows.

**Pharmacy Companion Pro** is a full-stack pharmacy management and CRM solution built to help pharmacies and clinics reduce manual work, keep inventory organized, and stay ahead of expiring medicines.

Instead of relying on spreadsheets, manually entering invoice information, and checking expiry dates one by one, Pharmacy Companion Pro brings these workflows into a single dashboard.

## ✨ Features

### 📦 Inventory & Stock Management

Manage your pharmacy inventory from one centralized system.

* Add and manage medicines
* Track available stock
* Monitor inventory levels
* Organize medicine information
* Track stock movement
* Identify items that need attention
* Maintain a structured inventory database

### 📸 OCR Invoice Extraction

Manually entering information from supplier bills can be repetitive and error-prone.

Pharmacy Companion Pro includes an OCR-powered image extraction workflow that can read information from uploaded bills and help convert them into structured data.

**Workflow:**

```text
Upload Bill Image
       ↓
    OCR Engine
       ↓
Extract Bill Information
       ↓
Review / Validate
       ↓
Add to Inventory
```

This helps reduce repetitive data entry when processing pharmacy purchase invoices.

### ⏰ Expiry Tracking & Alerts

Keep track of medicines before they reach their expiry date.

The expiry dashboard helps pharmacy operators quickly identify:

* Expired medicines
* Medicines approaching expiry
* Inventory requiring attention
* Upcoming expiry dates

Instead of discovering expired stock manually, important expiry information is surfaced directly through the dashboard.

### 📊 Pharmacy Dashboard

Get an operational overview of the pharmacy from a single place.

The dashboard provides visibility into important areas such as:

* Inventory status
* Expiry information
* Stock levels
* Alerts
* Pharmacy activity
* Operational metrics

### 📧 Automated Email System

Pharmacy Companion Pro includes email automation capabilities for reducing repetitive communication.

The system can be used to:

* Send automated emails
* Process pharmacy-related email workflows
* Handle incoming emails
* Extract information from emails
* Centralize email communication

### 📥 Email Fetching

The application can connect to an email inbox and retrieve incoming messages.

This enables workflows where supplier or pharmacy-related information received through email can be brought into the application instead of requiring staff to manually switch between systems.

### 🤖 AI-Assisted Workflows

The project integrates AI capabilities to support automation-heavy workflows.

AI can be used alongside structured pharmacy data to reduce manual processing and make operational tasks easier to manage.

### 🧾 Bill & Purchase Management

Purchase information can be captured and organized so that incoming stock becomes part of the pharmacy's inventory workflow.

Combined with OCR, this creates a faster workflow for processing supplier bills.

---

## 🏗️ Tech Stack

### Frontend

* **React 19**
* **TypeScript**
* **Vite**
* **TanStack Router**
* **TanStack React Query**
* **Tailwind CSS**
* **Radix UI**
* **Recharts**
* **Lucide React**

### Backend / Data

* **PostgreSQL**
* **Drizzle ORM**
* **Drizzle Kit**

### AI & Document Processing

* **OpenAI API**
* **Azure AI Form Recognizer**
* **PDF.js**

### Email

* **IMAPFlow**
* **MailParser**

The repository's package configuration confirms these core technologies and integrations.

---

## 🧠 Architecture Overview

Pharmacy Companion Pro is designed around several interconnected operational workflows:

```text
                         ┌──────────────────┐
                         │ Pharmacy Staff   │
                         └────────┬─────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │ Pharmacy Dashboard  │
                       └──────────┬──────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
       ┌─────────────┐     ┌─────────────┐    ┌─────────────┐
       │  Inventory  │     │    Bills    │    │    Email    │
       │ Management  │     │ Processing  │    │ Automation  │
       └──────┬──────┘     └──────┬──────┘    └──────┬──────┘
              │                   │                   │
              │                   ▼                   │
              │            ┌─────────────┐            │
              │            │ OCR / AI    │            │
              │            │ Extraction  │            │
              │            └──────┬──────┘            │
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  ▼
                       ┌─────────────────────┐
                       │     PostgreSQL      │
                       │   + Drizzle ORM     │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │ Expiry & Stock      │
                       │ Alerts / Dashboard  │
                       └─────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

* Node.js
* npm
* PostgreSQL
* Required API credentials for enabled integrations

### 1. Clone the repository

```bash
git clone https://github.com/Codewith-me1/pharmacy-companion-pro.git
cd pharmacy-companion-pro
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file from the provided example:

```bash
cp .env.example .env
```

Then configure the required database, AI, OCR, and email credentials.

> Never commit your `.env` file or API keys to the repository.

### 4. Set up the database

Generate the Drizzle migration files:

```bash
npm run db:generate
```

Push the schema to your database:

```bash
npm run db:push
```

If the project includes seed data, you can populate the database with:

```bash
npm run db:seed
```

The available database scripts are defined in the project's `package.json`.

### 5. Start the development server

```bash
npm run dev
```

The application will be available through the local Vite development server.

---

## 🗂️ Project Structure

```text
pharmacy-companion-pro/
│
├── public/                 # Static assets
│
├── src/
│   ├── components/         # Reusable UI components
│   ├── lib/                # Database and application utilities
│   └── ...                 # Application routes and features
│
├── drizzle/                # Database migrations/schema
├── .env.example            # Environment configuration template
├── drizzle.config.ts       # Drizzle configuration
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration
└── tsconfig.json           # TypeScript configuration
```

---

## 🔄 Core Workflow

### Supplier Bill → Inventory

```text
Supplier Bill
     │
     ▼
Upload Image
     │
     ▼
OCR Processing
     │
     ▼
Extract Bill Data
     │
     ▼
Review Information
     │
     ▼
Update Inventory
     │
     ▼
Expiry / Stock Tracking
```

### Email → Pharmacy Workflow

```text
Incoming Email
      │
      ▼
Email Fetcher
      │
      ▼
Parse Email
      │
      ▼
Extract Relevant Information
      │
      ▼
Process / Store
      │
      ▼
Pharmacy Dashboard
```

---

## 🎯 Why Pharmacy Companion Pro?

Pharmacy operations often involve repetitive administrative work:

* Entering information from supplier bills
* Keeping stock records updated
* Checking medicine expiry dates
* Monitoring inventory
* Processing emails
* Searching through operational information

Pharmacy Companion Pro aims to bring these workflows together and automate the repetitive parts.

The goal is simple:

> **Less manual data entry. Better inventory visibility. Faster pharmacy operations.**

---

## 🔐 Security & Configuration

Because this application can handle pharmacy and operational information, production deployments should follow appropriate security practices.

Recommended practices include:

* Store credentials in environment variables
* Never commit API keys
* Use strong database credentials
* Restrict database access
* Configure secure email credentials
* Use HTTPS in production
* Apply appropriate authentication and authorization
* Validate OCR-extracted information before committing inventory changes

OCR and AI-generated information should always be reviewed before being treated as authoritative pharmacy records.

---

## 🛣️ Future Improvements

Potential areas for further development include:

* Barcode scanning
* Supplier management
* Purchase order automation
* Low-stock predictive alerts
* Advanced sales analytics
* Multi-pharmacy support
* Role-based access control
* Audit logs
* Automated supplier reconciliation
* WhatsApp notifications
* Advanced AI invoice validation
* Medicine search and recommendations
* Exportable inventory and financial reports

---

## 🤝 Contributing

Contributions, ideas, and improvements are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/your-feature
```

3. Make your changes
4. Run linting and tests where applicable
5. Commit your changes

```bash
git commit -m "Add: your feature"
```

6. Push your branch

```bash
git push origin feature/your-feature
```

7. Open a Pull Request

---

## 📄 License

Add your preferred open-source license to the repository.

---

## 👨‍💻 Project

**Pharmacy Companion Pro**

A pharmacy CRM focused on inventory management, OCR-powered bill processing, expiry monitoring, and automated communication.

**Repository:**
https://github.com/Codewith-me1/pharmacy-companion-pro
