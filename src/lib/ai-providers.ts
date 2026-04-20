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

export type MiniMaxModel =
  | 'music-2.5'
  | 'music-2.5-turbo'
  | 'music-2.6'
  | 'music-cover'

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
  model?: MiniMaxModel
  outputFormat?: 'mp3' | 'wav' | 'pcm'
  lyricsOptimizer?: boolean
  sampleRate?: 16000 | 24000 | 32000 | 44100
  bitrate?: 32000 | 64000 | 128000 | 256000
  aigcWatermark?: boolean
}

export type ContinueParams = {
  originalAudioUrl: string
  prompt: string
  model?: MiniMaxModel
  duration?: number
}

export type StemSplitResult = Record<string, unknown> & {
  audioUrl: string
}

export type AIProvider = {
  name: string
  generate: (params: SongParams, apiKey: string, apiUrl: string) => Promise<string>
  getProgress: (taskId: string, apiKey: string, apiUrl: string) => Promise<GenerationProgress>
  download: (taskId: string, apiKey: string, apiUrl: string) => Promise<string>
  continue?: (params: ContinueParams, apiKey: string, apiUrl: string) => Promise<string>
  splitStems?: (
    params: { audioUrl: string },
    apiKey: string,
    apiUrl: string
  ) => Promise<StemSplitResult[]>
}

const MINI_MAX_ERROR_MESSAGES: Record<number, string> = {
  1002: '请求过于频繁，请稍后再试',
  1004: 'API鉴权失败，请检查配置',
  1008: '账户余额不足，请充值后重试',
  1026: '内容包含敏感词，请修改后重试',
  2013: '请求参数错误，请检查输入',
  2049: '无效的API Key，请检查配置',
}

interface MiniMaxBaseResponse {
  status_code?: number | string
  status_msg?: string
}

interface MiniMaxTaskPayload {
  task_id?: string
  status?: number | string
  progress?: number
  stage?: string
  audio?: string
  audio_url?: string
  audio_download_url?: string
  video_url?: string
  error?: string
  error_code?: number
}

interface MiniMaxEnvelope {
  data?: MiniMaxTaskPayload
  task_id?: string
  base_resp?: MiniMaxBaseResponse
  error?: {
    error_code?: number | string
    message?: string
  } | string
}

// MiniMax Provider - Official API Implementation
// API Docs: https://platform.minimaxi.com/docs/api-reference/music-generation
// Model: music-2.6, music-cover
export const miniMaxProvider: AIProvider = {
  name: 'MiniMax',

  async generate(params, apiKey, apiUrl) {
    const baseUrl = apiUrl || 'https://api.minimaxi.com'

    // Music generation can take up to 3-5 minutes for complex songs
    // Set timeout to 5 minutes to avoid premature abortion
    const response = await fetch(`${baseUrl}/v1/music_generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildGenerationRequestBody(params)),
      signal: AbortSignal.timeout(300000), // 5 minutes
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw buildMiniMaxError(errorData, `HTTP ${response.status}`)
    }

    const data = await response.json() as MiniMaxEnvelope
    assertMiniMaxSuccess(data)
    return parseGenerationResponse(data)
  },

  async getProgress(taskId, apiKey, apiUrl) {
    if (taskId.startsWith('audio:')) {
      const audioUrl = taskId.slice(6)
      return {
        status: 'COMPLETED' as GenerationStatus,
        progress: 100,
        stage: 'completed',
        audioUrl,
      }
    }

    const baseUrl = apiUrl || 'https://api.minimaxi.com'

    // Progress check polls for completion - generation can take 3-5 minutes
    // Set timeout to 5 minutes to match generation timeout
    const response = await fetch(`${baseUrl}/v1/music_generation_info?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(300000), // 5 minutes for polling operation
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw buildMiniMaxError(errorData, `HTTP ${response.status}`)
    }

    const data = await response.json() as MiniMaxEnvelope
    assertMiniMaxSuccess(data)
    return mapMiniMaxStatus(data)
  },

  async download(taskId, apiKey, apiUrl) {
    if (taskId.startsWith('audio:')) {
      return taskId.slice(6)
    }

    const baseUrl = apiUrl || 'https://api.minimaxi.com'

    const response = await fetch(`${baseUrl}/v1/music_generation_info?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw buildMiniMaxError(errorData, `HTTP ${response.status}`)
    }

    const data = await response.json() as MiniMaxEnvelope
    assertMiniMaxSuccess(data)

    const progress = mapMiniMaxStatus(data)
    if (!progress.audioUrl) {
      throw new Error('Audio not ready yet')
    }

    return progress.audioUrl
  },

  async continue(params, apiKey, apiUrl) {
    const baseUrl = apiUrl || 'https://api.minimaxi.com'

    const response = await fetch(`${baseUrl}/v1/music_generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildContinuationRequestBody(params)),
      signal: AbortSignal.timeout(300000), // 5 minutes for continuation
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw buildMiniMaxError(errorData, `HTTP ${response.status}`)
    }

    const data = await response.json() as MiniMaxEnvelope
    assertMiniMaxSuccess(data)
    return parseGenerationResponse(data)
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

function buildGenerationRequestBody(params: SongParams): Record<string, unknown> {
  const model = params.model || 'music-2.6'
  const prompt = buildPrompt(params)
  const outputFormat = params.outputFormat || 'mp3'

  const commonBody = {
    model,
    prompt,
    stream: false,
    output_format: 'url',
    audio_setting: {
      sample_rate: params.sampleRate || 44100,
      bitrate: params.bitrate || 256000,
      format: outputFormat,
    },
    aigc_watermark: params.aigcWatermark || false,
  }

  if (model === 'music-cover') {
    return {
      ...commonBody,
      audio_url: params.referenceAudio,
    }
  }

  const isInstrumental = params.isInstrumental || !params.lyrics || params.lyrics.trim() === ''

  return {
    ...commonBody,
    lyrics: isInstrumental ? undefined : params.lyrics,
    is_instrumental: isInstrumental,
    lyrics_optimizer: params.lyricsOptimizer,
  }
}

function buildContinuationRequestBody(params: ContinueParams): Record<string, unknown> {
  return {
    model: params.model || 'music-2.6',
    prompt: params.prompt,
    audio_url: params.originalAudioUrl,
    stream: false,
    output_format: 'url',
    duration: params.duration,
  }
}

// Build prompt from song params for MiniMax
function buildPrompt(params: SongParams): string {
  const parts: string[] = []

  if (params.genre.length > 0) {
    parts.push(params.genre.join(', '))
  }

  if (params.mood) {
    parts.push(`Mood: ${params.mood}`)
  }

  if (params.instruments.length > 0) {
    parts.push(`Instruments: ${params.instruments.join(', ')}`)
  }

  if (params.referenceSinger) {
    parts.push(`Style: ${params.referenceSinger}`)
  }

  if (params.referenceSong) {
    parts.push(`Reference Song: ${params.referenceSong}`)
  }

  if (params.userNotes) {
    parts.push(`Description: ${params.userNotes}`)
  }

  return parts.join('; ')
}

function getMiniMaxPayload(data: MiniMaxEnvelope | MiniMaxTaskPayload): MiniMaxTaskPayload {
  if ('data' in data && data.data) {
    return data.data
  }

  return data as MiniMaxTaskPayload
}

function parseGenerationResponse(data: MiniMaxEnvelope): string {
  const payload = getMiniMaxPayload(data)
  const audioUrl = payload.audio || payload.audio_url || payload.audio_download_url
  const status = normalizeMiniMaxStatus(payload.status, Boolean(payload.error))

  if (audioUrl && status === 'COMPLETED') {
    return `audio:${audioUrl}`
  }

  const taskId = payload.task_id || data.task_id
  if (!taskId) {
    throw new Error('MiniMax API error: Missing task ID in response')
  }

  return taskId
}

function mapMiniMaxStatus(data: MiniMaxEnvelope | MiniMaxTaskPayload): GenerationProgress {
  const payload = getMiniMaxPayload(data)
  const audioUrl = payload.audio || payload.audio_url || payload.audio_download_url

  let status = normalizeMiniMaxStatus(payload.status, Boolean(payload.error))
  if (status === 'PENDING' && audioUrl) {
    status = 'COMPLETED'
  }

  let progress = payload.progress || 0
  if (status === 'PENDING') progress = 10
  else if (status === 'GENERATING') progress = progress || 50
  else if (status === 'COMPLETED') progress = 100
  else if (status === 'FAILED') progress = 0

  return {
    status,
    progress,
    stage: payload.stage || defaultStageForStatus(status),
    audioUrl,
    videoUrl: payload.video_url,
    error: payload.error,
  }
}

function normalizeMiniMaxStatus(
  rawStatus: MiniMaxTaskPayload['status'],
  hasError: boolean
): GenerationStatus {
  if (hasError) {
    return 'FAILED'
  }

  switch (rawStatus) {
    case 2:
    case '2':
    case 'completed':
      return 'COMPLETED'
    case 1:
    case '1':
    case 'processing':
    case 'generating':
      return 'GENERATING'
    case -1:
    case '-1':
    case 'failed':
    case 'error':
      return 'FAILED'
    case 0:
    case '0':
    case 'pending':
      return 'PENDING'
    default:
      return 'PENDING'
  }
}

function defaultStageForStatus(status: GenerationStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed'
    case 'GENERATING':
      return 'processing'
    case 'FAILED':
      return 'failed'
    default:
      return 'pending'
  }
}

function assertMiniMaxSuccess(data: MiniMaxEnvelope): void {
  const apiStatusCode = data.base_resp?.status_code

  if (
    apiStatusCode === undefined ||
    apiStatusCode === null ||
    apiStatusCode === 0 ||
    apiStatusCode === '0' ||
    apiStatusCode === 'Success' ||
    apiStatusCode === 'success'
  ) {
    return
  }

  throw buildMiniMaxError(data, `API error: ${String(apiStatusCode)}`)
}

function buildMiniMaxError(errorData: MiniMaxEnvelope, fallback: string): Error {
  const rawCode =
    typeof errorData.error === 'object'
      ? errorData.error?.error_code
      : undefined

  const fallbackCode = errorData.base_resp?.status_code
  const errorCode = rawCode ?? fallbackCode
  const normalizedCode =
    typeof errorCode === 'string' ? Number(errorCode) : errorCode

  const mappedMessage =
    typeof normalizedCode === 'number' && Number.isFinite(normalizedCode)
      ? MINI_MAX_ERROR_MESSAGES[normalizedCode]
      : undefined

  const rawErrorMessage =
    typeof errorData.error === 'object'
      ? errorData.error?.message
      : typeof errorData.error === 'string'
        ? errorData.error
        : undefined

  const errorMessage =
    mappedMessage ||
    rawErrorMessage ||
    errorData.base_resp?.status_msg ||
    fallback

  return new Error(`MiniMax API error: ${errorMessage}`)
}
