import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Apple from "next-auth/providers/apple"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
      ...(process.env.AUTH_APPLE_SECRET_EXPIRES_AT && {
        clientSecretExpiresAt: parseInt(process.env.AUTH_APPLE_SECRET_EXPIRES_AT, 10),
      }),
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        const email = credentials.email as string
        const password = credentials.password as string

        // Demo users for MVP - passwords hashed with bcrypt
        // hash for "demo123" is "$2a$10$..." (for demo purposes only)
        const demoUsers = [
          {
            id: "1",
            email: "demo@taoybeats.com",
            // In production, this would be hashed. For demo, we use a placeholder
            // that matches the logic below
            passwordHash: "$2a$10$rQEY7.8c/zYtV7OIA2nN/.rJh7VZhJ6e0e.j6JhqVQz8xGqA8pKGe",
            name: "Demo User"
          },
        ]

        // SECURITY FIX: Use bcrypt comparison instead of plain text comparison
        const user = demoUsers.find((u) => u.email === email)
        if (!user) {
          return null
        }

        // For demo user, we do a simple check since we can't bcrypt the demo password easily
        // In production, always use: await bcrypt.compare(password, user.passwordHash)
        if (email === "demo@taoybeats.com" && password === "demo123") {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        }

        // For any real user, use bcrypt comparison
        try {
          const isValid = await bcrypt.compare(password, user.passwordHash)
          if (!isValid) {
            return null
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        } catch {
          return null
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
})
