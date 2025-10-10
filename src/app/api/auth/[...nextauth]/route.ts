import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
//import MicrosoftProvider from "next-auth/providers/microsoft";//for GD email service provider; change if applicable
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EMAILS = [
  "mailabhirupbanerjee@gmail.com",
  //"eachangelead@dg4r.gov.gd",
  //"projectmanager@dg4r.gov.gd",
  //"digitaldirector@ict.gov.gd", 
  //"lendon90@gmail.com", 
  // Add more emails as needed for permissions
  // emails listed here will be allowed secured access to the bot
  // remove mailabhirupbanerjee@gmail.com 
  // add your GR / gmail id to get access 
  // redoply to git and create a fresh build for local hosting or on vercel to leverage the Ci/CD
];

/*
const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    //MicrosoftProvider({
    //  clientId: process.env.MICROSOFT_CLIENT_ID,
    //  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    //  tenantId: process.env.MICROSOFT_TENANT_ID
   // }),
  ],
  // Add more NextAuth config as needed

  callbacks: {
    async signIn({ user, profile }) {
      // Use either user.email or profile.email (depends on provider)
      const email = user?.email || profile?.email;
      if (!email) return false;
      return ALLOWED_EMAILS.includes(email.toLowerCase());
    },
  },

});

*/


// Export authOptions for server-side use
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }: { user: { email?: string | null }, profile?: { email?: string } }) {
      const email = (user?.email ?? undefined) || profile?.email;
      if (!email) return false;
      return ALLOWED_EMAILS.includes(email.toLowerCase());
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
//export { handler as GET, handler as POST };

