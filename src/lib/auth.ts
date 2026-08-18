import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Config de NextAuth usada SOLO por la pantalla /conectar, para que el
 * dueño del negocio autorice (una vez) el acceso de la app a su Google
 * Drive/Sheets. No se usa para el login diario de los empleados (eso es
 * usuario + PIN, ver internalSession.ts).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.file",
          ].join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // El refresh_token solo viene la primera vez que el usuario autoriza.
      if (account?.refresh_token) {
        token.refreshToken = account.refresh_token;
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).refreshToken = token.refreshToken;
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: "/conectar",
  },
};
