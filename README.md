# GoG Citizen Survey Bot 



## Installation Guidelines (Fresh)

1. **Clone the repository**  
   ```bash
   git clone https://github.com/abhirupbanerjee/abhirupbanerjee.git
   cd abhirupbanerjee
   ```

2. **Install dependencies**  
   ```bash
   # Using npm
   npm install

   # Or using yarn
   yarn install
   ```

3. **Set up environment variables**  
   Copy the example environment file and update with your credentials:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to add values for database, API keys, and authentication providers.

## Run Commands

- **Start the Development Server**
  ```bash
  npm run dev
  # or
  yarn dev
  ```

- **Build for Production**
  ```bash
  npm run build
  # or
  yarn build
  ```

- **Run Tests**
  ```bash
  npm test
  # or
  yarn test
  ```

## Add-ons: Auth Service Providers

The project supports multiple authentication service providers.  
To add a new provider such as Microsoft:

1. **Install Provider Library**  
   ```bash
   npm install @auth/microsoft
   # or
   yarn add @auth/microsoft
   ```

2. **Update Auth Configuration**  
   In your authentication setup file (route.js under api/auth):
   You can also regulate specific email ids to be provided access
   By default google service auth is setup and needs to be transferred
   ```js
   import MicrosoftProvider from '@auth/microsoft';
   // ...
   providers: [
     MicrosoftProvider({
       clientId: process.env.MICROSOFT_CLIENT_ID,
       clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
     }),
     // ...other providers
   ]
   ```

4. **Set Environment Variables**  
   Add to your `.env` file:
   ```
   MICROSOFT_CLIENT_ID=your-client-id
   MICROSOFT_CLIENT_SECRET=your-client-secret
   // add tenets if applicable
   ```

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)

## Email service integration
------------------------------------------------------------------------
## Google email services
This is already integrated as default but will be removed on handover.

-----------------------------------------------------------------------

## 🔐 Microsoft Login Integration (Azure AD) Setup

### **Step 1: Register Your Application in Azure**

1. **Log in to the [Azure Portal](https://portal.azure.com/).**
2. In the left menu, select **Azure Active Directory**.
3. Go to **App registrations**.
4. Click **New registration**.
5. Fill out the form:

   * **Name:**
     *(Choose a descriptive name, e.g., “Grenada AI Assistant”)*
   * **Supported account types:**

     * Recommended: **Accounts in this organizational directory only (Single tenant)**
   * **Redirect URI:**

     * **Type:** Web
     * **Value(s):**

       * For production: `https://yourdomain.com/api/auth/callback/azure-ad`
       * For local development: `http://localhost:3000/api/auth/callback/azure-ad`
     * You can add multiple redirect URIs if needed.
6. Click **Register**.

---

### **Step 2: Get Your Credentials**

After registration:

1. On the app registration **Overview** page, copy:

   * **Application (client) ID**
   * **Directory (tenant) ID**
2. In the left menu, select **Certificates & secrets**.
3. Click **New client secret**, provide a description, and choose an expiry.
4. Click **Add**.
5. **Copy the generated secret value** and save it securely—you won't be able to see it again!

---

### **Step 3: Save Credentials in Vercel**

Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard):

1. Click **Settings** > **Environment Variables**.
2. **Add these variables:**

| Key                      | Value from Azure Portal                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `AZURE_AD_CLIENT_ID`     | Application (client) ID                                           |
| `AZURE_AD_CLIENT_SECRET` | Client Secret (from step 2.5)                                     |
| `AZURE_AD_TENANT_ID`     | Directory (tenant) ID                                             |
| `NEXTAUTH_URL`           | Your production site URL (e.g., `https://yourdomain.com`)         |
| `NEXTAUTH_SECRET`        | A random, secure string (generate with `openssl rand -base64 32`) |

> ⚠️ **Never share your client secret.**
> ⚠️ **Remember to add the same variables in `.env.local` for local development!**

---

### **Step 4: Deploy & Test**

* After adding environment variables, **redeploy** your project on Vercel.
* Try logging in with your Microsoft enterprise account.
* You should be redirected to Microsoft, then back to your app.

---

### **Reference**

* [Azure AD Provider Docs](https://next-auth.js.org/providers/azure-ad)
* [Register an App in Azure](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

## **Quick Checklist**

* [ ] Register Azure AD App
* [ ] Copy Client ID, Tenant ID, and create a Client Secret
* [ ] Add environment variables to Vercel
* [ ] Add redirect URIs in Azure (local + production)
* [ ] Redeploy app

---

**If you have any questions, contact your IT admin or the development team.**

