# nexus_insights-saas-neon - Installation Guide

Get your Next.js template up and running in minutes.

---

## Prerequisites

- **Node.js** (version 18.0 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- A code editor like **VS Code** (recommended)

To verify Node.js is installed:
```bash
node --version
npm --version
```

---

## Installation Steps

### Step 1: Extract the Template

Extract the downloaded zip file:

```bash
unzip nexus_insights-saas-neon_nextjs.zip
cd nexus_insights-saas-neon
```

**What's Inside:**
- `src/` - Next.js pages and components
- `public/` - Static assets
- `package.json` - Project dependencies
- `tailwind.config.js` - Tailwind CSS configuration

**Router Type:** This template uses the **App Router**.

---

### Step 2: Install Dependencies

```bash
npm install
```

Or with yarn:
```bash
yarn install
```

---

### Step 3: Start the Development Server

```bash
npm run dev
```

Your site will be available at **http://localhost:3000**

---

## Building for Production

Create an optimized production build:

```bash
npm run build
```

Start the production server:
```bash
npm run start
```

---

## Project Structure

```
nexus_insights-saas-neon/
├── public/
├── src/
│   ├── app/          # App Router pages
│   ├── components/     # Reusable UI components
│   ├── lib/
│   │   ├── utils/      # Utility functions
│   │   └── data/       # Static data and content
│   └── styles/         # CSS files
├── package.json
├── next.config.js
└── tailwind.config.js
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Deployment

This Next.js app can be deployed to:
- [Vercel](https://vercel.com) (recommended)
- [Netlify](https://netlify.com)
- Any Node.js hosting provider

---

## Need Help?

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
