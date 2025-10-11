# AI Survey Bot

An AI-powered chatbot for analyzing citizen surveys, built with Next.js 15, OpenAI Assistants API, and NextAuth authentication.

## 🚀 Features

- **OpenAI Assistant Integration**: Uses OpenAI's Assistants API with thread-based conversations
- **Secure Authentication**: Google OAuth (Microsoft Azure AD ready)
- **Email Whitelist**: Controlled access via allowed email list
- **Persistent Chat History**: LocalStorage-based chat retention
- **Markdown Support**: Rich text formatting with tables, lists, and code blocks
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## 📋 Prerequisites

- Node.js 18.18.0 or higher
- OpenAI API key and Assistant ID
- Google OAuth credentials (or Microsoft Azure AD)

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
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
6. Copy Client ID and Client Secret to `.env.local`

### Microsoft Azure AD (Optional)

1. Register app in [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Create new registration:
   - Name: "GoG Survey Bot"
   - Supported accounts: Single tenant
   - Redirect URI: `https://yourdomain.com/api/auth/callback/azure-ad`
4. Copy Application (client) ID and Directory (tenant) ID
5. Create client secret under **Certificates & secrets**
6. Uncomment Microsoft provider in `src/app/api/auth/[...nextauth]/route.ts`
7. Add credentials to environment variables

## 📁 Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts   # Auth configuration
│   │   │   └── chat/route.ts                  # OpenAI API handler
│   │   ├── ChatApp.tsx                        # Main chat interface
│   │   ├── page.tsx                           # Auth gate
│   │   ├── providers.tsx                      # SessionProvider wrapper
│   │   └── globals.css                        # Tailwind styles
│   └── ...
├── public/
│   └── icon.png                               # App icon
├── .env.local                                 # Environment variables
└── package.json
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

### Cloudflare Pages

```bash
npm run build
npm run deploy
```

Ensure `wrangler.toml` is configured correctly.

## 🚨 Important Notes

- **Remove demo email**: Delete `mailabhirupbanerjee@gmail.com` from `ALLOWED_EMAILS` before production
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

**Built for Government of Caribbean AI Initiative**