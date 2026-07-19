import Store from 'electron-store'
import { safeStorage } from 'electron'

export type Provider = 'ollama' | 'anthropic'

interface ConfigSchema {
  notionTokenEnc?: string
  anthropicApiKeyEnc?: string
  provider: Provider
  ollamaModelId: string
  anthropicModelId: string
  ollamaBaseUrl: string
  units: string[]
  unitPageMap: Record<string, string>
  topicPageMap: Record<string, string>
}

const store = new Store<ConfigSchema>({
  name: 'config',
  defaults: {
    provider: 'anthropic',
    ollamaModelId: 'minicpm-v4.5',
    anthropicModelId: 'claude-sonnet-5',
    ollamaBaseUrl: 'http://localhost:11434',
    units: ['ENSC3004'],
    unitPageMap: {},
    topicPageMap: {}
  }
})

// Secrets are never logged or returned in plain form outside this module — callers
// only ever get a decrypted value to use immediately (e.g. for a single outbound
// request) or a boolean "is it set" via getSettingsSummary().
function encrypt(plain: string): string {
  if (!safeStorage.isEncryptionAvailable()) return Buffer.from(plain, 'utf8').toString('base64')
  return safeStorage.encryptString(plain).toString('base64')
}

function decrypt(enc: string): string {
  const buf = Buffer.from(enc, 'base64')
  if (!safeStorage.isEncryptionAvailable()) return buf.toString('utf8')
  return safeStorage.decryptString(buf)
}

export function getNotionToken(): string | null {
  const enc = store.get('notionTokenEnc')
  return enc ? decrypt(enc) : null
}

export function setNotionToken(plain: string): void {
  store.set('notionTokenEnc', encrypt(plain))
}

export function clearNotionToken(): void {
  store.delete('notionTokenEnc')
}

export function getAnthropicKey(): string | null {
  const enc = store.get('anthropicApiKeyEnc')
  return enc ? decrypt(enc) : null
}

export function setAnthropicKey(plain: string): void {
  store.set('anthropicApiKeyEnc', encrypt(plain))
}

export function clearAnthropicKey(): void {
  store.delete('anthropicApiKeyEnc')
}

export function getProvider(): Provider {
  return store.get('provider')
}

export function setProvider(provider: Provider): void {
  store.set('provider', provider)
}

export function getOllamaModelId(): string {
  return store.get('ollamaModelId')
}

export function setOllamaModelId(modelId: string): void {
  store.set('ollamaModelId', modelId)
}

export function getAnthropicModelId(): string {
  return store.get('anthropicModelId')
}

export function setAnthropicModelId(modelId: string): void {
  store.set('anthropicModelId', modelId)
}

export function getOllamaBaseUrl(): string {
  return store.get('ollamaBaseUrl')
}

export function setOllamaBaseUrl(url: string): void {
  store.set('ollamaBaseUrl', url)
}

export function getUnits(): string[] {
  return store.get('units')
}

export function setUnits(units: string[]): void {
  store.set('units', units)
}

export function getUnitPageMap(): Record<string, string> {
  return store.get('unitPageMap')
}

export function mapUnitPage(unit: string, pageId: string): void {
  const map = store.get('unitPageMap')
  map[unit] = pageId
  store.set('unitPageMap', map)
}

export function getTopicPageMap(): Record<string, string> {
  return store.get('topicPageMap')
}

export function mapTopicPage(unit: string, topic: string, pageId: string): void {
  const map = store.get('topicPageMap')
  map[`${unit}::${topic}`] = pageId
  store.set('topicPageMap', map)
}

// Deliberately returns only booleans for secret fields — never the decrypted value —
// since this is what gets sent over IPC to the renderer.
export function getSettingsSummary(): {
  notionTokenSet: boolean
  anthropicKeySet: boolean
  provider: Provider
  ollamaModelId: string
  anthropicModelId: string
  ollamaBaseUrl: string
} {
  return {
    notionTokenSet: !!store.get('notionTokenEnc'),
    anthropicKeySet: !!store.get('anthropicApiKeyEnc'),
    provider: store.get('provider'),
    ollamaModelId: store.get('ollamaModelId'),
    anthropicModelId: store.get('anthropicModelId'),
    ollamaBaseUrl: store.get('ollamaBaseUrl')
  }
}
