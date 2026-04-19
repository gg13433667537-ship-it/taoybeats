// AI Provider Abstraction Layer
// MiniMax Music 2.6 - Official API Integration

export type GenerationStatus =
  | 'PENDING'
  | 'GENERATING'
  | 'COMPLETED'
  | 'FAILED'

export type GenerationProgress = {
  status: GenerationStatus
  progress: number // 0-100
  stage?: string
  audioUrl?: string
  videoUrl?: string
  error?: string
}

export type SongParams = {
  title: string
  lyrics: string
  genre: string[]
  mood: string
  instruments: string[]
  referenceSinger?: string
  referenceSong?: string
  userNotes?: string
  isInstrumental?: boolean
  voiceId?: string
  referenceAudio?: string
  model?: 'music-2.6' | 'music-cover'
  outputFormat?: 'mp3' | 'wav' | 'pcm'
  lyricsOptimizer?: boolean
  sampleRate?: 16000 | 24000 | 32000 | 44100
  bitrate?: 32000 | 64000 | 128000 | 256000
  aigcWatermark?: boolean
}

export type AIProvider = {
  name: string
  generate: (params: SongParams, apiKey: string, apiUrl: string) => Promise<string> // returns taskId
  getProgress: (taskId: string, apiKey: string, apiUrl: string) => Promise<GenerationProgress>
  download: (taskId: string, apiKey: string, apiUrl: string) => Promise<string> // returns audio URL
}

// MiniMax Provider - Official API Implementation
// API Docs: https://platform.minimaxi.com/docs/api-reference/music-generation
// Model: music-2.6, music-cover
export const miniMaxProvider: AIProvider = {
  name: 'MiniMax',

  async generate(params, apiKey, apiUrl) {
    const baseUrl = apiUrl || 'https://api.minimaxi.com'
    const model = params.model || 'music-2.6'

    // Build prompt from song params
    const prompt = buildPrompt(params)

    // Check if instrumental - explicit flag or no lyrics
    const isInstrumental = params.isInstrumental || !params.lyrics || params.lyrics.trim() === ''

    // Determine output format
    const outputFormat = params.outputFormat || 'mp3'

    const response = await fetch(`${baseUrl}/v1/music_generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        lyrics: isInstrumental ? undefined : params.lyrics,
        is_instrumental: isInstrumental,
        stream: false,
        output_format: 'url',
        audio_setting: {
          sample_rate: params.sampleRate || 44100,
          bitrate: params.bitrate || 256000,
          format: outputFormat
        },
        aigc_watermark: params.aigcWatermark || false,
        voice_id: params.voiceId,
        reference_audio: params.referenceAudio,
        lyrics_optimizer: params.lyricsOptimizer,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      const errorCode = errorData.error?.error_code || errorData.base_resp?.status_code
      const errorMessage = errorData.error?.message || errorData.error || errorData.base_resp?.status_msg || `HTTP ${response.status}`

      // Map MiniMax error codes to user-friendly messages
      const errorMessages: Record<number, string> = {
        1002: '请求过于频繁，请稍后再试',
        1004: 'API鉴权失败，请检查配置',
        1008: '账户余额不足，请充值后重试',
        1026: '内容包含敏感词，请修改后重试',
        2013: '请求参数错误，请检查输入',
        2049: '无效的API Key，请检查配置',
      }

      const userMessage = errorCode && errorMessages[errorCode]
        ? errorMessages[errorCode]
        : errorMessage

      throw new Error(`MiniMax API error: ${userMessage}`)
    }

    const data = await response.json()

    // Music 2.6 may return audio directly (status=2 means completed)
    // or return a task_id for async polling (status=1 means processing)
    const audioUrl = data.data?.audio
    const taskId = data.data?.task_id
    const status = data.data?.status

    if (audioUrl && status === 2) {
      // Synchronous completion - return audio URL prefixed with 'audio:'
      return `audio:${audioUrl}`
    }

    // Return task_id for async polling
    return taskId || data.task_id
  },

  async getProgress(taskId, apiKey, apiUrl) {
    // Handle synchronous completion (audio URL prefixed with 'audio:')
    if (taskId.startsWith('audio:')) {
      const audioUrl = taskId.slice(6) // Remove 'audio:' prefix
      return {
        status: 'COMPLETED' as GenerationStatus,
        progress: 100,
        stage: 'completed',
        audioUrl,
      }
    }

    const baseUrl = apiUrl || 'https://api.minimaxi.com'

    const response = await fetch(`${baseUrl}/v1/music_generation_info?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      const errorCode = errorData.error?.error_code || errorData.base_resp?.status_code
      const errorMessage = errorData.error?.message || errorData.error || errorData.base_resp?.status_msg || `HTTP ${response.status}`

      // Map MiniMax error codes to user-friendly messages
      const errorMessages: Record<number, string> = {
        1002: '请求过于频繁，请稍后再试',
        1004: 'API鉴权失败，请检查配置',
        1008: '账户余额不足，请充值后重试',
        1026: '内容包含敏感词，请修改后重试',
        2013: '请求参数错误，请检查输入',
        2049: '无效的API Key，请检查配置',
      }

      const userMessage = errorCode && errorMessages[errorCode]
        ? errorMessages[errorCode]
        : errorMessage

      throw new Error(`MiniMax API error: ${userMessage}`)
    }

    const data = await response.json()
    return mapMiniMaxStatus(data)
  },

  async download(taskId, apiKey, apiUrl) {
    // Handle synchronous completion (audio URL prefixed with 'audio:')
    if (taskId.startsWith('audio:')) {
      return taskId.slice(6) // Remove 'audio:' prefix and return URL
    }

    const baseUrl = apiUrl || 'https://api.minimaxi.com'

    const response = await fetch(`${baseUrl}/v1/music_generation_info?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      const errorCode = errorData.error?.error_code || errorData.base_resp?.status_code
      const errorMessage = errorData.error?.message || errorData.error || errorData.base_resp?.status_msg || `HTTP ${response.status}`

      // Map MiniMax error codes to user-friendly messages
      const errorMessages: Record<number, string> = {
        1002: '请求过于频繁，请稍后再试',
        1004: 'API鉴权失败，请检查配置',
        1008: '账户余额不足，请充值后重试',
        1026: '内容包含敏感词，请修改后重试',
        2013: '请求参数错误，请检查输入',
        2049: '无效的API Key，请检查配置',
      }

      const userMessage = errorCode && errorMessages[errorCode]
        ? errorMessages[errorCode]
        : errorMessage

      throw new Error(`MiniMax API error: ${userMessage}`)
    }

    const data = await response.json()
    // Get the audio URL from the response - MiniMax uses data.audio for URL output
    const audioUrl = data.data?.audio || data.data?.audio_url || data.audio_url
    if (!audioUrl) {
      throw new Error('Audio not ready yet')
    }
    return audioUrl
  },
}

// Provider Registry
export const providers: Record<string, AIProvider> = {
  minimax: miniMaxProvider,
}

// Alias for backwards compatibility
export const musicProvider = miniMaxProvider

// Get provider by name
export function getProvider(name: string): AIProvider {
  const provider = providers[name.toLowerCase()]
  if (!provider) {
    throw new Error(`Unknown AI provider: ${name}`)
  }
  return provider
}

// Build prompt from song params for MiniMax
function buildPrompt(params: SongParams): string {
  const parts: string[] = []

  // Genre as comma-separated style tags
  if (params.genre.length > 0) {
    parts.push(params.genre.join(', '))
  }

  // Mood - make it more descriptive
  if (params.mood) {
    parts.push(`Mood: ${params.mood}`)
  }

  // Additional context from instruments
  if (params.instruments.length > 0) {
    parts.push(`Instruments: ${params.instruments.join(', ')}`)
  }

  // Reference artist / style reference
  if (params.referenceSinger) {
    parts.push(`Style: ${params.referenceSinger}`)
  }

  // Custom user notes for additional context
  if (params.userNotes) {
    parts.push(`Description: ${params.userNotes}`)
  }

  // Join with proper separators
  return parts.join('; ')
}

// MiniMax API Response Types
interface MiniMaxStatusResponse {
  status?: string
  progress?: number
  stage?: string
  audio_url?: string
  audio_download_url?: string
  video_url?: string
  error?: string
  error_code?: number
}

function mapMiniMaxStatus(data: MiniMaxStatusResponse): GenerationProgress {
  // MiniMax status: pending, processing, completed, failed
  const statusMap: Record<string, GenerationStatus> = {
    pending: 'PENDING',
    processing: 'GENERATING',
    completed: 'COMPLETED',
    failed: 'FAILED',
  }

  const status = statusMap[data.status || ''] || 'PENDING'

  // Calculate progress based on status
  let progress = data.progress || 0
  if (status === 'PENDING') progress = 10
  else if (status === 'GENERATING') progress = progress || 50
  else if (status === 'COMPLETED') progress = 100
  else if (status === 'FAILED') progress = 0

  return {
    status,
    progress,
    stage: data.stage || data.status,
    audioUrl: data.audio_url || data.audio_download_url,
    videoUrl: data.video_url,
    error: data.error,
  }
}
