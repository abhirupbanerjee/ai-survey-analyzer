// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const ALLOWED_EMAILS = [
  "mailabhirupbanerjee@gmail.com",
  "richard.ramdial@gmail.com",
  "crebeccaaboud@gmail.com",
  "silveraarielle@gmail.com",
  "kellman.dana@gmail.com",

];

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const email = user?.email || profile?.email;
      if (!email) return false;
      return ALLOWED_EMAILS.includes(email.toLowerCase());
    },
  },
});

export { handler as GET, handler as POST };