# Supplier Selection Optimiser

A generic tool that lets users upload supplier data (CSV), set their demand, and get the optimal supplier selection based on minimum distance and cost.

---

## How to deploy — from zero to a shareable link in ~10 minutes

### Step 1 — Get the code onto GitHub

1. Create a new repo at https://github.com/new (name it `supplier-tool`, set it to private or public)
2. Push this folder to it:
   ```bash
   cd supplier-tool
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/supplier-tool.git
   git push -u origin main
   ```

### Step 2 — Get your Anthropic API key

1. Go to https://console.anthropic.com
2. Create an API key
3. Copy it — you will add it to Vercel in the next step

### Step 3 — Deploy on Vercel (free)

1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New → Project**
3. Select your `supplier-tool` repo and click **Import**
4. Under **Environment Variables**, add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-your-key-here` (the key you copied)
5. Click **Deploy**

Vercel will build and deploy your app. It gives you a URL like:
```
https://supplier-tool-abc123.vercel.app
```
Share this link with your users — that's it!

### Step 4 — Set up the CI/CD pipeline (optional but recommended)

For the GitHub Actions pipeline to also deploy automatically, add these secrets to your GitHub repo:

Go to **GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Secret name        | How to get it                                                    |
|--------------------|------------------------------------------------------------------|
| `VERCEL_TOKEN`     | https://vercel.com/account/tokens → Create token               |
| `VERCEL_ORG_ID`    | Run `npx vercel link` in the project folder, then check `.vercel/project.json` |
| `VERCEL_PROJECT_ID`| Same `.vercel/project.json` file                               |

Once set, every push to `main` will:
1. Run the lint + build checks (CI)
2. If they pass, deploy to Vercel automatically (CD)

---

## Running locally for development

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and add your API key
cp .env.example .env.local
# Edit .env.local and replace the placeholder with your real key

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000

---

## Project structure

```
supplier-tool/
├── pages/
│   ├── index.js          # Main tool UI (template, upload, demand, results)
│   └── api/
│       └── optimise.js   # Server-side API route — calls Anthropic securely
├── .github/
│   └── workflows/
│       └── ci.yml        # GitHub Actions CI/CD pipeline
├── .env.example          # Template for environment variables
├── .gitignore
└── package.json
```

## Customising the tool

- **Change columns**: edit the `parseCSV` function in `pages/index.js`
- **Change optimisation logic**: edit the prompt in `pages/api/optimise.js`
- **Add authentication**: wrap the UI with a login page (e.g. NextAuth.js)
- **Add a database**: store results using Prisma + a free Neon PostgreSQL DB
