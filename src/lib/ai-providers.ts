// AI Provider Abstraction Layer
// Supports multiple AI music backends: MiniMax, Suno, Udio, and custom

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
}

export type AIProvider = {
  name: string
  generate: (params: SongParams, apiKey: string, apiUrl: string, modelId?: string) => Promise<string> // returns taskId
  getProgress: (taskId: string, apiKey: string, apiUrl: string) => Promise<GenerationProgress>
  download: (taskId: string, apiKey: string, apiUrl: string) => Promise<string> // returns audio URL
}

// MiniMax Provider - Real API Implementation
// API Docs: https://api.minimax.chat/document
export const miniMaxProvider: AIProvider = {
  name: 'MiniMax',

  async generate(params, apiKey, apiUrl, modelId) {
    const baseUrl = apiUrl || 'https://api.minimax.chat'
    const model = modelId || 'music-2.6'

    // Build prompt from song params (for music description)
    const prompt = buildPrompt(params)

    // Check if instrumental (no lyrics)
    const isInstrumental = !params.lyrics || params.lyrics.trim() === ''

    const response = await fetch(`${baseUrl}/api/v1/music_generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        lyrics: params.lyrics || undefined,
        is_instrumental: isInstrumental,
        stream: false,
        output_format: 'url',
        audio_setting: {
          duration: 180, // 3 minutes default
        },
        aigc_watermark: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`MiniMax API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    // MiniMax returns task_id in data
    return data.task_id || data.data?.task_id
  },

  async getProgress(taskId, apiKey, apiUrl) {
    const baseUrl = apiUrl || 'https://api.minimax.chat'

    const response = await fetch(`${baseUrl}/api/v1/music_generation_info?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`MiniMax API error: ${response.status}`)
    }

    const data = await response.json()
    return mapMiniMaxStatus(data)
  },

  async download(taskId, apiKey, apiUrl) {
    const baseUrl = apiUrl || 'https://api.minimax.chat'

    const response = await fetch(`${baseUrl}/api/v1/music_generation_info?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`MiniMax API error: ${response.status}`)
    }

    const data = await response.json()
    // Get the audio URL from the response
    const audioUrl = data.data?.audio_url || data.audio_url
    if (!audioUrl) {
      throw new Error('Audio not ready yet')
    }
    return audioUrl
  },
}

// Suno Provider
export const sunoProvider: AIProvider = {
  name: 'Suno',

  async generate(params, apiKey, apiUrl, modelId) {
    const baseUrl = apiUrl || 'https://api.suno.ai'

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: buildPrompt(params),
        tags: params.genre.join(','),
        title: params.title,
        make_instrumental: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`Suno API error: ${response.status}`)
    }

    const data = await response.json()
    return data.task_id || data.id
  },

  async getProgress(taskId, apiKey, apiUrl) {
    const baseUrl = apiUrl || 'https://api.suno.ai'

    const response = await fetch(`${baseUrl}/api/get/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Suno API error: ${response.status}`)
    }

    const data = await response.json()
    return mapSunoStatus(data)
  },

  async download(taskId, apiKey, apiUrl) {
    const data = await this.getProgress(taskId, apiKey, apiUrl)
    if (data.audioUrl) {
      return data.audioUrl
    }
    throw new Error('Audio not ready yet')
  },
}

// Udio Provider
export const udioProvider: AIProvider = {
  name: 'Udio',

  async generate(params, apiKey, apiUrl, modelId) {
    const baseUrl = apiUrl || 'https://api.udio.com'

    const response = await fetch(`${baseUrl}/v1/music/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: buildPrompt(params),
        genres: params.genre,
        mood: params.mood,
      }),
    })

    if (!response.ok) {
      throw new Error(`Udio API error: ${response.status}`)
    }

    const data = await response.json()
    return data.task_id || data.id
  },

  async getProgress(taskId, apiKey, apiUrl) {
    const baseUrl = apiUrl || 'https://api.udio.com'

    const response = await fetch(`${baseUrl}/v1/music/status/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Udio API error: ${response.status}`)
    }

    const data = await response.json()
    return mapUdioStatus(data)
  },

  async download(taskId, apiKey, apiUrl) {
    const data = await this.getProgress(taskId, apiKey, apiUrl)
    if (data.audioUrl) {
      return data.audioUrl
    }
    throw new Error('Audio not ready yet')
  },
}

// Provider Registry
export const providers: Record<string, AIProvider> = {
  minimax: miniMaxProvider,
  suno: sunoProvider,
  udio: udioProvider,
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

  if (params.genre.length > 0) {
    parts.push(`Genre: ${params.genre.join(', ')}`)
  }

  if (params.mood) {
    parts.push(`Mood: ${params.mood}`)
  }

  if (params.instruments.length > 0) {
    parts.push(`Instruments: ${params.instruments.join(', ')}`)
  }

  if (params.referenceSinger) {
    parts.push(`Reference Artist: ${params.referenceSinger}`)
  }

  if (params.referenceSong) {
    parts.push(`Reference Song: ${params.referenceSong}`)
  }

  if (params.lyrics) {
    parts.push(`Lyrics:\n${params.lyrics}`)
  }

  return parts.join('\n\n')
}

// Map provider-specific status to unified format
function mapMiniMaxStatus(data: any): GenerationProgress {
  const statusMap: Record<string, GenerationStatus> = {
    pending: 'PENDING',
    processing: 'GENERATING',
    completed: 'COMPLETED',
    failed: 'FAILED',
  }

  return {
    status: statusMap[data.status] || 'PENDING',
    progress: data.progress || 0,
    stage: data.stage,
    audioUrl: data.audio_url || data.url,
    error: data.error,
  }
}

function mapSunoStatus(data: any): GenerationProgress {
  const isComplete = data.status === 'complete'
  const isFailed = data.status === 'failed'

  return {
    status: isComplete ? 'COMPLETED' : isFailed ? 'FAILED' : 'GENERATING',
    progress: isComplete ? 100 : data.progress || 50,
    stage: data.status,
    audioUrl: isComplete ? data.audio_url : undefined,
    error: isFailed ? data.error : undefined,
  }
}

function mapUdioStatus(data: any): GenerationProgress {
  return {
    status: data.status === 'complete' ? 'COMPLETED' : data.status === 'error' ? 'FAILED' : 'GENERATING',
    progress: data.progress || 0,
    stage: data.stage,
    audioUrl: data.audio_url,
    error: data.error,
  }
}
