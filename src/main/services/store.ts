import Store from 'electron-store'
import { safeStorage } from 'electron'

interface ConfigSchema {
  notionTokenEnc?: string
  modelId: string
  ollamaBaseUrl: string
  units: string[]
  unitPageMap: Record<string, string>
  topicPageMap: Record<string, string>
}

const store = new Store<ConfigSchema>({
  name: 'config',
  defaults: {
    modelId: 'minicpm-v4.5',
    ollamaBaseUrl: 'http://localhost:11434',
    units: ['ENSC3004'],
    unitPageMap: {},
    topicPageMap: {}
  }
})

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

export function getModelId(): string {
  return store.get('modelId')
}

export function setModelId(modelId: string): void {
  store.set('modelId', modelId)
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

export function getSettingsSummary(): {
  notionTokenSet: boolean
  modelId: string
  ollamaBaseUrl: string
} {
  return {
    notionTokenSet: !!store.get('notionTokenEnc'),
    modelId: store.get('modelId'),
    ollamaBaseUrl: store.get('ollamaBaseUrl')
  }
}
