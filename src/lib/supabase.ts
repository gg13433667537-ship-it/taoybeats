import { createClient } from '@supabase/supabase-js'

// Supabase client for browser
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient(supabaseUrl, supabaseAnonKey)
}

// Supabase client for server
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Database types
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          name: string | null
          tier: 'FREE' | 'PRO'
          daily_usage: number
          monthly_usage: number
          daily_reset_at: string
          monthly_reset_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          name?: string | null
          tier?: 'FREE' | 'PRO'
          daily_usage?: number
          monthly_usage?: number
          daily_reset_at?: string
          monthly_reset_at?: string
        }
        Update: {
          email?: string | null
          name?: string | null
          tier?: 'FREE' | 'PRO'
          daily_usage?: number
          monthly_usage?: number
        }
      }
      songs: {
        Row: {
          id: string
          user_id: string
          title: string
          lyrics: string | null
          original_lyrics: string | null
          genre: string[]
          mood: string | null
          instruments: string[]
          status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
          lyrics_compression_applied: boolean
          lyrics_compression_reason: string | null
          lyrics_compression_model: string | null
          lyrics_compression_limit: number | null
          audio_url: string | null
          share_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          lyrics?: string | null
          original_lyrics?: string | null
          genre?: string[]
          mood?: string | null
          instruments?: string[]
          status?: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
          lyrics_compression_applied?: boolean
          lyrics_compression_reason?: string | null
          lyrics_compression_model?: string | null
          lyrics_compression_limit?: number | null
          audio_url?: string | null
          share_token?: string | null
        }
        Update: {
          title?: string
          lyrics?: string | null
          original_lyrics?: string | null
          genre?: string[]
          mood?: string | null
          instruments?: string[]
          status?: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
          lyrics_compression_applied?: boolean
          lyrics_compression_reason?: string | null
          lyrics_compression_model?: string | null
          lyrics_compression_limit?: number | null
          audio_url?: string | null
        }
      }
    }
  }
}
