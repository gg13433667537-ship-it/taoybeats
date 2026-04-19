// AI Provider Abstraction Layer
// Music Generation API Integration

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
    referenceAudio?: string
  model?: 'music-2.6' | 'music-cover' | 'music-2.6-free' | 'music-cover-free'
  outputFormat?: 'mp3' | 'wav' | 'pcm'
  lyricsOptimizer?: boolean
  sampleRate?: 16000 | 24000 | 32000 | 44100
  bitrate?: 32000 | 64000 | 128000 | 256000
  aigcWatermark?: boolean
}

export type StemType = 'vocals' | 'drums' | 'bass' | 'other'

export type StemResult = {
  stem_type: StemType
  label: string
  description: string
  audioUrl: string
  format: string
  duration: number
}

export type ContinueParams = {
  originalAudioUrl: string
  prompt?: string
  duration?: number
  model?: 'music-2.6' | 'music-cover' | 'music-2.6-free' | 'music-cover-free'
}

export type StemsParams = {
  audioUrl: string
}

export type AIProvider = {
  name: string
  generate: (params: SongParams, apiKey: string, apiUrl: string) => Promise<string> // returns taskId
  getProgress: (taskId: string, apiKey: string, apiUrl: string) => Promise<GenerationProgress>
  download: (taskId: string, apiKey: string, apiUrl: string) => Promise<string> // returns audio URL
  continue?: (params: ContinueParams, apiKey: string, apiUrl: string) => Promise<string> // returns taskId
  splitStems?: (params: StemsParams, apiKey: string, apiUrl: string) => Promise<StemResult[]> // returns stems
}

// Music Generation Provider
// Model: standard, cover
export const musicProvider: AIProvider = {
  name: 'Music',

  async generate(params, apiKey, apiUrl) {
    const baseUrl = apiUrl || 'https://api.minimaxi.com'
    const model = params.model || 'music-2.6'
    const coverModel = isCoverModel(model)

    // Build prompt from song params
    const prompt = normalizePrompt(buildPrompt(params), coverModel)

    // Check if instrumental - explicit flag or no lyrics
    const isInstrumental = params.isInstrumental || !params.lyrics || params.lyrics.trim() === ''

    // Determine output format
    const outputFormat = params.outputFormat || 'mp3'

    // Build request body with API parameters
    const requestBody: Record<string, unknown> = {
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
      lyrics_optimizer: params.lyricsOptimizer,
    }

    if (coverModel) {
      if (!params.referenceAudio) {
        throw new Error('MiniMax cover generation requires a reference audio input')
      }
      addReferenceAudio(requestBody, params.referenceAudio)
    }

    const response = await fetch(`${baseUrl}/v1/music_generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      const errorCode = errorData.error?.error_code || errorData.base_resp?.status_code
      const errorMessage = errorData.error?.message || errorData.error || errorData.base_resp?.status_msg || `HTTP ${response.status}`

      // Map error codes to user-friendly messages
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

      throw new Error(`API error: ${userMessage}`)
    }

    const data = await response.json()

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response from API: response is not an object')
    }

    // Check for API-level errors even when HTTP status is 200
    // MiniMax returns errors in base_resp.status_code (1002=rate limit, 1004=auth failed, 1008=no balance, 1026=sensitive content, 2013=param error, 2049=invalid key)
    const apiStatusCode = data.base_resp?.status_code
    const apiStatusMsg = data.base_resp?.status_msg
    if (apiStatusCode && apiStatusCode !== 0 && apiStatusCode !== '0' && apiStatusCode !== 'Success') {
      const errorMessages: Record<number, string> = {
        1002: '请求过于频繁，请稍后再试',
        1004: 'API鉴权失败，请检查配置',
        1008: '账户余额不足，请充值后重试',
        1026: '内容包含敏感词，请修改后重试',
        2013: '请求参数错误，请检查输入',
        2049: '无效的API Key，请检查配置',
      }
      const userMessage = errorMessages[apiStatusCode] || apiStatusMsg || `API error code: ${apiStatusCode}`
      throw new Error(`MiniMax API error: ${userMessage}`)
    }

    // Music 2.6 may return audio directly (status=2 means completed)
    // or return a task_id for async polling (status=1 means processing)
    // IMPORTANT: MiniMax returns "audio" field with URL, NOT "audio_url"!
    const audioUrl = getAudioUrlFromResponse(data)
    const taskId = data.data?.task_id
    const status = data.data?.status

    // Log response for debugging
    console.log('[MiniMax] generate response:', JSON.stringify({
      hasData: !!data.data,
      audioUrl,
      audio: data.data?.audio,
      audio_url: data.data?.audio_url,
      taskId,
      status,
      baseResp: data.base_resp
    }).slice(0, 500))

    if (status === 2 && audioUrl) {
      // Synchronous completion with URL
      if (typeof audioUrl !== 'string' || !audioUrl.startsWith('http')) {
        throw new Error('Invalid audio URL in API response')
      }
      return `audio:${audioUrl}`
    }

    // If status=2 but no audioUrl (maybe hex audio was returned instead)
    if (status === 2 && data.data?.audio) {
      // Hex audio returned - this is unusual for output_format=url
      console.warn('[MiniMax] API returned hex audio instead of URL, task may need async polling')
    }

    // Return task_id for async polling
    if (!taskId && !data.task_id) {
      console.error('[MiniMax] No task_id in response, data:', JSON.stringify(data).slice(0, 300))
      throw new Error('No task_id returned from API')
    }
    return taskId || data.task_id
  },

  async getProgress(taskId, apiKey, apiUrl) {
    // Handle synchronous completion (audio URL prefixed with 'audio:')
    if (taskId?.startsWith('audio:')) {
      const audioUrl = taskId.slice(6) // Remove 'audio:' prefix
      return {
        status: 'COMPLETED' as GenerationStatus,
        progress: 100,
        stage: 'completed',
        audioUrl,
      }
    }

    // Handle null/undefined taskId
    if (!taskId) {
      throw new Error('Task ID is required')
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

      // Map error codes to user-friendly messages
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

      throw new Error(`API error: ${userMessage}`)
    }

    const data = await response.json()

    // Check for API-level errors even when HTTP status is 200
    const apiStatusCode = data.base_resp?.status_code
    const apiStatusMsg = data.base_resp?.status_msg
    if (apiStatusCode && apiStatusCode !== 0 && apiStatusCode !== '0' && apiStatusCode !== 'Success') {
      const errorMessages: Record<number, string> = {
        1002: '请求过于频繁，请稍后再试',
        1004: 'API鉴权失败，请检查配置',
        1008: '账户余额不足，请充值后重试',
        1026: '内容包含敏感词，请修改后重试',
        2013: '请求参数错误，请检查输入',
        2049: '无效的API Key，请检查配置',
      }
      const userMessage = errorMessages[apiStatusCode] || apiStatusMsg || `API error code: ${apiStatusCode}`
      throw new Error(`MiniMax API error: ${userMessage}`)
    }

    return mapMusicStatus(data)
  },

  async download(taskId, apiKey, apiUrl) {
    // Handle synchronous completion (audio URL prefixed with 'audio:')
    if (taskId?.startsWith('audio:')) {
      return taskId.slice(6) // Remove 'audio:' prefix and return URL
    }

    // Handle null/undefined taskId
    if (!taskId) {
      throw new Error('Task ID is required')
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

      // Map error codes to user-friendly messages
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

      throw new Error(`API error: ${userMessage}`)
    }

    const data = await response.json()
    // Get the audio URL from the response - MiniMax uses "audio" field, not "audio_url"
    const audioUrl = data.data?.audio || data.data?.audio_url || data.audio_url
    if (!audioUrl) {
      throw new Error('Audio not ready yet')
    }
    return audioUrl
  },

  /**
   * Continue singing - generates a continuation of an existing audio track
   * Uses reference_audio parameter to maintain style consistency
   */
  async continue(params, apiKey, apiUrl) {
    const baseUrl = apiUrl || 'https://api.minimaxi.com'
    const model = params.model || 'music-2.6'

    // Build request body with all parameters
    const requestBody: Record<string, unknown> = {
      model,
      prompt: normalizePrompt(params.prompt || 'Continue the song naturally', isCoverModel(model)),
      stream: false,
      output_format: 'url',
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3'
      },
      aigc_watermark: false,
    }
    addReferenceAudio(requestBody, params.originalAudioUrl)

    // Add duration if provided (may use this as guidance)
    if (params.duration) {
      requestBody.duration = params.duration
    }

    const response = await fetch(`${baseUrl}/v1/music_generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      const errorCode = errorData.error?.error_code || errorData.base_resp?.status_code
      const errorMessage = errorData.error?.message || errorData.error || errorData.base_resp?.status_msg || `HTTP ${response.status}`

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

      throw new Error(`API error: ${userMessage}`)
    }

    const data = await response.json()

    // Check for API-level errors even when HTTP status is 200
    const apiStatusCode = data.base_resp?.status_code
    const apiStatusMsg = data.base_resp?.status_msg
    if (apiStatusCode && apiStatusCode !== 0 && apiStatusCode !== '0' && apiStatusCode !== 'Success') {
      const errorMessages: Record<number, string> = {
        1002: '请求过于频繁，请稍后再试',
        1004: 'API鉴权失败，请检查配置',
        1008: '账户余额不足，请充值后重试',
        1026: '内容包含敏感词，请修改后重试',
        2013: '请求参数错误，请检查输入',
        2049: '无效的API Key，请检查配置',
      }
      const userMessage = errorMessages[apiStatusCode] || apiStatusMsg || `API error code: ${apiStatusCode}`
      throw new Error(`MiniMax API error: ${userMessage}`)
    }

    const audioUrl = getAudioUrlFromResponse(data)
    const taskId = data.data?.task_id
    const status = data.data?.status

    if (audioUrl && status === 2) {
      return `audio:${audioUrl}`
    }

    return taskId || data.task_id
  },

  /**
   * Stem separation is NOT supported by this provider
   * Only supports music generation, not audio source separation
   * Use splitAudioStems() directly in the route with Demucs/LALAL.AI
   */
  async splitStems(_params, _apiKey, _apiUrl): Promise<StemResult[]> {
    throw new Error('Stem separation is not supported. Use Demucs or LALAL.AI API instead.')
  },
}

// Provider Registry
export const providers: Record<string, AIProvider> = {
  music: musicProvider,
}

// Get provider by name
export function getProvider(name: string): AIProvider {
  const provider = providers[name.toLowerCase()]
  if (!provider) {
    throw new Error(`Unknown AI provider: ${name}`)
  }
  return provider
}

// Build prompt from song params
function buildPrompt(params: SongParams): string {
  const parts: string[] = []

  // Title as the first part of the prompt
  if (params.title) {
    parts.push(params.title)
  }

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

  if (params.referenceSong) {
    parts.push(`Reference track: ${params.referenceSong}`)
  }

  // Custom user notes for additional context
  if (params.userNotes) {
    parts.push(`Description: ${params.userNotes}`)
  }

  // Join with proper separators
  return parts.join('; ')
}

function isCoverModel(model: string): boolean {
  return model === 'music-cover' || model === 'music-cover-free'
}

function normalizePrompt(prompt: string, requireMinLength: boolean): string {
  const trimmed = prompt.trim()
  if (!trimmed) {
    return requireMinLength
      ? 'Create a cover inspired by the provided reference audio.'
      : 'Generate an original song.'
  }

  if (requireMinLength && trimmed.length < 10) {
    return `${trimmed} cover version`
  }

  return trimmed
}

function addReferenceAudio(requestBody: Record<string, unknown>, referenceAudio: string): void {
  if (referenceAudio.startsWith('data:')) {
    const [, base64Payload = ''] = referenceAudio.split(',', 2)
    requestBody.audio_base64 = base64Payload
    return
  }

  if (/^[A-Za-z0-9+/=]{50,}$/.test(referenceAudio)) {
    requestBody.audio_base64 = referenceAudio
    return
  }

  if (referenceAudio.startsWith('http://') || referenceAudio.startsWith('https://')) {
    requestBody.audio_url = referenceAudio
    return
  }

  throw new Error('Reference audio must be an http(s) URL or base64 payload')
}

function getAudioUrlFromResponse(data: { data?: { audio?: unknown; audio_url?: unknown }; audio?: unknown; audio_url?: unknown }): string | undefined {
  const candidates = [
    data.data?.audio,
    data.data?.audio_url,
    data.audio,
    data.audio_url,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.startsWith('http')) {
      return candidate
    }
  }

  return undefined
}

// Music API Response Types - nested structure from MiniMax API
interface MusicStatusResponse {
  // Top-level fields
  base_resp?: {
    status_code: number
    status_msg: string
  }
  // Nested data object from music_generation_info
  data?: {
    status?: number // 1=processing, 2=completed
    audio?: string // hex encoded audio when status=2
    audio_url?: string // URL when output_format=url
    task_id?: string
    video_url?: string
  }
  // Alternative flat structure some APIs use
  status?: string
  status_code?: number
  status_msg?: string
  audio_url?: string
  audio?: string
  error?: string
  error_code?: number
  trace_id?: string
  extra_info?: {
    music_duration?: number
    music_sample_rate?: number
    music_channel?: number
    bitrate?: number
    music_size?: number
  }
}

function mapMusicStatus(data: MusicStatusResponse): GenerationProgress {
  // MiniMax uses nested data.data for music_generation_info response
  const nestedData = data.data

  // Determine status from nested or flat structure
  let apiStatus: number | string | undefined
  if (nestedData?.status !== undefined) {
    apiStatus = nestedData.status // 1=processing, 2=completed
  } else if (data.status !== undefined) {
    apiStatus = data.status
  } else if (data.status_code !== undefined) {
    apiStatus = data.status_code
  }

  // Map numeric or string status to our enum
  let status: GenerationStatus = 'PENDING'
  if (typeof apiStatus === 'number') {
    if (apiStatus === 2) status = 'COMPLETED'
    else if (apiStatus === 1) status = 'GENERATING'
    else if (apiStatus === 3) status = 'FAILED'
  } else if (typeof apiStatus === 'string') {
    const statusMap: Record<string, GenerationStatus> = {
      pending: 'PENDING',
      processing: 'GENERATING',
      completed: 'COMPLETED',
      failed: 'FAILED',
    }
    status = statusMap[apiStatus.toLowerCase()] || 'PENDING'
  }

  // Calculate progress based on status
  let progress = 0
  if (status === 'PENDING') progress = 10
  else if (status === 'GENERATING') progress = 50
  else if (status === 'COMPLETED') progress = 100
  else if (status === 'FAILED') progress = 0

  // Extract audio URL - check multiple possible locations
  // IMPORTANT: MiniMax returns "audio" field with direct URL, not "audio_url"
  let audioUrl: string | undefined
  if (nestedData?.audio && typeof nestedData.audio === 'string' && nestedData.audio.startsWith('http')) {
    audioUrl = nestedData.audio
  } else if (nestedData?.audio_url) {
    audioUrl = nestedData.audio_url
  } else if (data.audio && typeof data.audio === 'string' && data.audio.startsWith('http')) {
    audioUrl = data.audio
  } else if (data.audio_url) {
    audioUrl = data.audio_url
  }

  // Extract error message
  let errorMsg: string | undefined
  if (status === 'FAILED') {
    errorMsg = data.base_resp?.status_msg || data.error || data.status_msg || 'Generation failed'
  }

  return {
    status,
    progress,
    stage: status === 'COMPLETED' ? 'completed' : status === 'GENERATING' ? 'Creating your music...' : 'Queued...',
    audioUrl,
    videoUrl: nestedData?.video_url || undefined,
    error: errorMsg,
  }
}
