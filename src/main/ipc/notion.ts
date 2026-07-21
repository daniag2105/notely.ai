import { ipcMain } from 'electron'
import * as store from '../services/store'
import * as notion from '../services/notion'
import * as backend from '../services/backend'
import { connectNotion, disconnectNotion } from '../services/notionOauth'
import { markdownToBlocks } from '../services/markdownToBlocks'

function requireToken(): string {
  const token = store.getNotionToken()
  if (!token) throw new Error('No Notion integration token set. Open Settings and add one.')
  return token
}

export function registerNotionIpc(): void {
  ipcMain.handle('notion:isConfigured', () => !!store.getNotionToken())

  ipcMain.handle('notion:connect', () => connectNotion())

  ipcMain.handle('notion:disconnect', async () => {
    disconnectNotion()
    await backend.clearNotion()
    return { ok: true }
  })

  // Mirrors the signed-in account's Notion connection from the backend into the local cache.
  ipcMain.handle('notion:sync', () => backend.syncNotion())

  ipcMain.handle('notion:testConnection', async () => {
    const token = store.getNotionToken()
    if (!token) return { ok: false, error: 'No token set' }
    return notion.testConnection(token)
  })

  ipcMain.handle('notion:searchTopLevelPages', async (_e, query: string) => {
    return notion.searchPages(requireToken(), query)
  })

  ipcMain.handle('notion:listChildPages', async (_e, parentPageId: string) => {
    return notion.listToggleHeadings(requireToken(), parentPageId)
  })

  ipcMain.handle('notion:resolveUnitPage', async (_e, unit: string) => {
    const map = store.getUnitPageMap()
    const id = map[unit]
    if (!id) return null
    return { id, title: unit }
  })

  ipcMain.handle('notion:mapUnitPage', async (_e, unit: string, pageId: string) => {
    store.mapUnitPage(unit, pageId)
  })

  ipcMain.handle(
    'notion:resolveTopicPage',
    async (_e, unitPageId: string, unit: string, topic: string) => {
      const topicMap = store.getTopicPageMap()
      const mappedId = topicMap[`${unit}::${topic}`]
      if (mappedId) return { id: mappedId, title: topic }

      const token = requireToken()
      const children = await notion.listToggleHeadings(token, unitPageId)
      const exact = children.find(
        (c) => c.title.trim().toLowerCase() === topic.trim().toLowerCase()
      )
      if (exact) {
        store.mapTopicPage(unit, topic, exact.id)
        return exact
      }
      return null
    }
  )

  ipcMain.handle('notion:createTopicPage', async (_e, unitPageId: string, topic: string) => {
    return notion.createTopicHeading(requireToken(), unitPageId, topic)
  })

  ipcMain.handle('notion:mapTopicPage', async (_e, unit: string, topic: string, pageId: string) => {
    store.mapTopicPage(unit, topic, pageId)
  })

  ipcMain.handle(
    'notion:createNotesPage',
    async (
      _e,
      unitPageId: string,
      title: string,
      markdown: string,
      figures: Array<{ id: string; dataB64: string; mediaType: string }> = []
    ) => {
      const token = requireToken()

      // Upload each referenced figure first (sequentially — keeps well under Notion's rate
      // limits) and map figure id -> Notion file_upload id. A failed upload just drops that one
      // figure; the notes still publish.
      const figureIdMap: Record<string, string> = {}
      for (const fig of figures) {
        try {
          const filename = `figure-${fig.id.replace(/\./g, '-')}.png`
          figureIdMap[fig.id] = await notion.uploadFileToNotion(token, {
            dataB64: fig.dataB64,
            mediaType: fig.mediaType,
            filename
          })
        } catch (err) {
          console.warn(`Skipping figure ${fig.id}: ${(err as Error).message}`)
        }
      }

      const blocks = markdownToBlocks(markdown, figureIdMap)
      return notion.createNotesPage(token, unitPageId, title, blocks)
    }
  )
}
