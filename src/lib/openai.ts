const DEFAULT_BASE_URL = import.meta.env.VITE_OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const DEFAULT_MODEL = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4.1-mini'

export type ExtractChordParams = {
  imageDataUrl: string
  apiKey: string
  model?: string
  baseUrl?: string
}

function parseJsonArray(text: string): string[] {
  const trimmed = text.trim()
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.map(String)
    }
  } catch {
    // no-op
  }

  const start = trimmed.indexOf('[')
  const end = trimmed.lastIndexOf(']')
  if (start >= 0 && end > start) {
    const maybe = trimmed.slice(start, end + 1)
    const parsed = JSON.parse(maybe)
    if (Array.isArray(parsed)) {
      return parsed.map(String)
    }
  }

  throw new Error('JSON配列を解析できませんでした')
}

export async function extractChordsWithLLM({
  imageDataUrl,
  apiKey,
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL
}: ExtractChordParams): Promise<string[]> {
  const endpoint = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`

  const body = {
    model,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Extract all chord symbols visible in this image. Return ONLY a JSON array. Example: ["C", "Am", "D", "Em", "G"]'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract chord symbols from the screenshot. Preserve progression order if visible.'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl
            }
          }
        ]
      }
    ]
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`LLM抽出エラー: ${res.status} ${detail}`)
  }

  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('LLMレスポンス形式が不正です')
  }

  return parseJsonArray(content)
}
