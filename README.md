# AI Survey Bot

An AI-powered chatbot for analyzing citizen surveys, built with Next.js 15, OpenAI Assistants API, and NextAuth authentication.

## 🚀 Features

- **OpenAI Assistant Integration**: Uses OpenAI's Assistants API with thread-based conversations
- **Secure Authentication**: Google OAuth (Microsoft Azure AD ready)
- **Email Whitelist**: Controlled access via allowed email list
- **Persistent Chat History**: LocalStorage-based chat retention
- **Markdown Support**: Rich text formatting with tables, lists, and code blocks
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- **speech to text and text to speech**: allows voice based chat and read puts through Whisper

## 📋 Prerequisites

- Node.js 18.18.0 or higher
- OpenAI API key and Assistant ID
- Google OAuth credentials (or Microsoft Azure AD)

## 🧰 Tech stack

- Next.js 15 (App Router) — server + client rendering for the web UI
- TypeScript — static typing across the app
- React — UI layer (built with Next.js)
- Tailwind CSS — utility-first styling
- OpenAI Assistants API — conversational assistant & threading
- OpenAI Embeddings / Whisper (optional) — text embeddings and speech features
- NextAuth.js — authentication (Google OAuth; Microsoft Azure AD optional)
- Node.js 18+ — recommended runtime
- Framer Motion — UI animations
- react-markdown + remark-gfm — render assistant responses in Markdown
- dotenv — local environment config for dev
- (Dev) ESLint, Prettier — linting & formatting
- Optional (if you add a local knowledge base): PostgreSQL + pgvector for vector storage and retrieval

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/abhirupbanerjee/ai-survey-analyzer.git
   cd ai-survey-analyser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # OpenAI Configuration
   OPENAI_API_KEY=sk-your-openai-api-key
   OPENAI_ASSISTANT_ID=asst_your-assistant-id
   OPENAI_ORGANIZATION=org-your-org-id  # Optional
   
   # NextAuth Configuration
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-random-secret-string  # Generate: openssl rand -base64 32
   
   # Google OAuth
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   
   # Microsoft Azure AD (Optional)
   # AZURE_AD_CLIENT_ID=your-azure-client-id
   # AZURE_AD_CLIENT_SECRET=your-azure-client-secret
   # AZURE_AD_TENANT_ID=your-azure-tenant-id
   ```

4. **Configure allowed emails**
   Edit `src/app/api/auth/[...nextauth]/route.ts`:
   ```typescript
   const ALLOWED_EMAILS = [
     "your-email@gov.gd",
     "team-member@gov.gd",
   ];
   ```

## 🏃 Run Commands

- **Development Server**
  ```bash
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000)

- **Production Build**
  ```bash
  npm run build
  ```

- **Deploy to Cloudflare Pages**
  ```bash
  npm run deploy
  ```

## 🔐 Authentication Setup

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://{domains name}/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
6. Copy Client ID and Client Secret to `.env.local`

### Microsoft Azure AD (Optional)

1. Register app in [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Create new registration:
   - Name: "app name"
   - Supported accounts: Single tenant
   - Redirect URI: `https://yourdomain.com/api/auth/callback/azure-ad`
4. Copy Application (client) ID and Directory (tenant) ID
5. Create client secret under **Certificates & secrets**
6. Uncomment Microsoft provider in `src/app/api/auth/[...nextauth]/route.ts`
7. Add credentials to environment variables

## 📁 Project Structure

```
├── src/
│ ├── app/
│ │ ├── api/
│ │ │ ├── auth/
│ │ │ │ └── [...nextauth]/route.ts # NextAuth providers & allowed emails
│ │ │ ├── chat/route.ts # Client -> server chat endpoint (threads)
│ │ │ └── assistant/ # handlers for assistant tool calls (if present)
│ │ ├── login/
│ │ │ └── page.tsx # Login page (remember-me, form)
│ │ ├── page.tsx # Main Chat / Auth-gated page
│ │ ├── ChatApp.tsx # Chat UI components and state
│ │ └── providers.tsx # SessionProvider / context
│ ├── lib/ # (recommended) shared helpers
│ │ ├── openai.ts # OpenAI client wrapper (optional)
│ │ ├── embeddings.ts # embedding helpers (optional)
│ │ └── vectorstore.ts # pgvector or other vectorstore helpers (optional)
│ └── components/ # UI components (messages, controls, modals)
├── public/ # static assets (icons, images)
│ └── icon.png
├── scripts/ # optional scripts (init_db.sql, ingest, etc.)
├── .env.example # example environment variables
├── wrangler.toml # Cloudflare Pages / Workers config (if used)
├── package.json
└── README.md



Key files (what they do and where to edit)
- src/app/api/auth/[...nextauth]/route.ts
  - Configure NextAuth providers (Google and optional Azure AD).
  - Where to set/validate the ALLOWED_EMAILS whitelist.
- src/app/api/chat/route.ts
  - Primary server endpoint used by the front-end to create threads and request assistant runs.
- src/app/api/assistant/* (tool-handler and related files)
  - Where assistant tool calls are handled (e.g., retrieval from knowledge base). If you add a local vectorstore, update these handlers to query Postgres/pgvector.
- src/app/page.tsx and src/app/login/page.tsx
  - Frontend pages — login, chat UI, and session handling.
- src/lib (recommended)
  - Add helpers here for OpenAI API usage, embeddings batching, chunking logic, token counting, and DB access (Postgres + pgvector) if you introduce a local KB.
- scripts/init_db.sql (recommended if using a local vector DB)
  - SQL to create vector extension and documents table (pgvector setup).

Environment variables (put these in .env.local or in your deployment settings)
- OPENAI_API_KEY
- OPENAI_ASSISTANT_ID
- OPENAI_ORGANIZATION (optional)
- NEXTAUTH_URL
- NEXTAUTH_SECRET
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
- (Optional for local KB) DATABASE_URL, EMBEDDING_MODEL, EMBEDDING_DIM

Notes & recommendations
- The repository already uses OpenAI Assistants + thread flow. For adding a local knowledge base, create src/lib/vectorstore.ts and update the assistant tool handler to query your Postgres/pgvector store and pass retrieved chunks as context.
- Keep secret keys out of the repository. Use .env.example to document names only.
- Add a simple scripts/ or src/cli/ folder for ingestion tooling (read files, chunk, embed, upsert). That keeps ingestion logic separate from runtime endpoints.

---

```

## 🔧 Configuration

### OpenAI Assistant Setup

1. Create an Assistant at [OpenAI Platform](https://platform.openai.com/assistants)
2. Configure instructions for survey analysis
3. Add knowledge files (PDFs, documents)
4. Copy Assistant ID to `OPENAI_ASSISTANT_ID`

### Email Whitelist

Only emails in `ALLOWED_EMAILS` array can access the app. Update this list in:
```typescript
// src/app/api/auth/[...nextauth]/route.ts
const ALLOWED_EMAILS = [
  "approved@email.com",
];
```

## 📦 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in project settings
4. Deploy


```

Ensure `wrangler.toml` is configured correctly.

## 🚨 Important Notes

- **Remove demo email**: Delete demo emails from `ALLOWED_EMAILS` before production
- **LocalStorage limitations**: Chat history stored client-side only (cleared on cache wipe)
- **API costs**: OpenAI Assistants API charges per usage
- **Thread management**: Each user session maintains separate conversation thread

## 🛡️ Security

- Email-based access control
- Server-side API key management
- NextAuth session encryption
- No client-side API key exposure

## 📄 License

MIT License - See [LICENSE](LICENSE) file

## 🤝 Contributing

Pull requests welcome! For major changes, open an issue first.

## 📧 Support

For issues or questions, contact the development team or create a GitHub issue.

---

**Built for Caribbean AI Initiative**