import { afterEach, describe, expect, it, vi } from 'vitest'
import { musicProvider } from '@/lib/ai-providers'

describe('musicProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses MiniMax-documented cover fields and omits unsupported request properties', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          task_id: 'task-123',
          status: 1,
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success',
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await musicProvider.generate({
      title: 'Short',
      lyrics: 'hello world',
      genre: ['pop'],
      mood: 'happy',
      instruments: [],
      referenceSinger: 'Artist',
      referenceSong: 'Reference Track',
      referenceAudio: 'https://example.com/reference.mp3',
      model: 'music-cover',
      outputFormat: 'mp3',
    }, 'test-key', 'https://api.minimaxi.com')

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [, requestInit] = fetchMock.mock.calls[0]
    const body = JSON.parse(String(requestInit?.body))

    expect(body).toMatchObject({
      model: 'music-cover',
      output_format: 'url',
      audio_url: 'https://example.com/reference.mp3',
    })
    expect(body.prompt.length).toBeGreaterThanOrEqual(10)
    expect(body.title).toBeUndefined()
    expect(body.reference_singer).toBeUndefined()
    expect(body.reference_song).toBeUndefined()
    expect(body.reference_audio).toBeUndefined()
    expect(body.reference_audio_url).toBeUndefined()
  })

  it('returns a completed audio URL when MiniMax responds synchronously with data.audio', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 2,
          audio: 'https://cdn.minimax.example/song.mp3',
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success',
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await musicProvider.generate({
      title: 'Test Song',
      lyrics: 'lyrics',
      genre: ['pop'],
      mood: 'happy',
      instruments: [],
      outputFormat: 'mp3',
    }, 'test-key', 'https://api.minimaxi.com')

    expect(result).toBe('audio:https://cdn.minimax.example/song.mp3')
  })

  it('maps nested music_generation_info responses with data.audio to a completed song', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 2,
          audio: 'https://cdn.minimax.example/poll-result.mp3',
          video_url: 'https://cdn.minimax.example/poll-result.mp4',
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success',
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await musicProvider.getProgress(
      'task-456',
      'test-key',
      'https://api.minimaxi.com'
    )

    expect(result).toEqual({
      status: 'COMPLETED',
      progress: 100,
      stage: 'completed',
      audioUrl: 'https://cdn.minimax.example/poll-result.mp3',
      videoUrl: 'https://cdn.minimax.example/poll-result.mp4',
      error: undefined,
    })
  })

  it('maps nested music_generation_info responses with status 1 to an in-progress song', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 1,
          task_id: 'task-456',
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success',
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await musicProvider.getProgress(
      'task-456',
      'test-key',
      'https://api.minimaxi.com'
    )

    expect(result).toEqual({
      status: 'GENERATING',
      progress: 50,
      stage: 'processing',
      audioUrl: undefined,
      videoUrl: undefined,
      error: undefined,
    })
  })

  it('returns nested data.audio URLs from the download helper', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 2,
          audio: 'https://cdn.minimax.example/download-result.mp3',
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success',
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await musicProvider.download(
      'task-789',
      'test-key',
      'https://api.minimaxi.com'
    )

    expect(result).toBe('https://cdn.minimax.example/download-result.mp3')
  })

  it('uses audio_url for continuation requests and handles synchronous completions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 2,
          audio: 'https://cdn.minimax.example/continued.mp3',
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success',
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await musicProvider.continue?.({
      originalAudioUrl: 'https://example.com/original.mp3',
      prompt: 'Continue the song naturally',
    }, 'test-key', 'https://api.minimaxi.com')

    const [, requestInit] = fetchMock.mock.calls[0]
    const body = JSON.parse(String(requestInit?.body))

    expect(body.audio_url).toBe('https://example.com/original.mp3')
    expect(body.reference_audio).toBeUndefined()
    expect(result).toBe('audio:https://cdn.minimax.example/continued.mp3')
  })
})
