// Prisma Client stub for build purposes
// Run `npx prisma generate` when network allows to generate the actual client

// This is a minimal stub that allows TypeScript to compile
// Replace with actual generated Prisma Client when network is available

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

export const PrismaClient = class {
  constructor() {
    console.warn('Using Prisma stub - run npx prisma generate for actual client')
  }
  user = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async (data: AnyRecord) => data,
    update: async (data: AnyRecord) => data,
    delete: async () => null,
  }
  song = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async (data: AnyRecord) => data,
    update: async (data: AnyRecord) => data,
    delete: async () => null,
  }
  apiConfig = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async (data: AnyRecord) => data,
    update: async (data: AnyRecord) => data,
    delete: async () => null,
  }
  subscription = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async (data: AnyRecord) => data,
    update: async (data: AnyRecord) => data,
    delete: async () => null,
  }
  account = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async (data: AnyRecord) => data,
    delete: async () => null,
  }
  session = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async (data: AnyRecord) => data,
    delete: async () => null,
  }
  $connect = async () => {}
  $disconnect = async () => {}
}

// Re-export types from schema for convenience
export type User = {
  id: string
  email: string | null
  name: string | null
  image: string | null
  emailVerified: Date | null
  createdAt: Date
  updatedAt: Date
}

export type Song = {
  id: string
  title: string
  lyrics: string | null
  genre: string[]
  mood: string | null
  instruments: string[]
  referenceSinger: string | null
  referenceSong: string | null
  userNotes: string | null
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
  audioUrl: string | null
  coverUrl: string | null
  shareToken: string | null
  userId: string
  createdAt: Date
  updatedAt: Date
}
