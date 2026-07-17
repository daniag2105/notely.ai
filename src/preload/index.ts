import { contextBridge, ipcRenderer } from 'electron'

const api = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setNotionToken: (token: string) => ipcRenderer.invoke('settings:setNotionToken', token),
    clearNotionToken: () => ipcRenderer.invoke('settings:clearNotionToken'),
    getUnits: () => ipcRenderer.invoke('settings:getUnits'),
    setUnits: (units: string[]) => ipcRenderer.invoke('settings:setUnits', units)
  },
  llm: {
    checkConnection: () => ipcRenderer.invoke('llm:checkConnection')
  },
  notes: {
    generate: (payload: unknown, onProgress: (fullText: string) => void) => {
      const requestId = Math.random().toString(36).slice(2)
      const listener = (
        _e: Electron.IpcRendererEvent,
        msg: { requestId: string; text: string }
      ): void => {
        if (msg.requestId === requestId) onProgress(msg.text)
      }
      ipcRenderer.on('notes:generate:progress', listener)
      return ipcRenderer
        .invoke('notes:generate', { ...(payload as object), requestId })
        .finally(() => ipcRenderer.removeListener('notes:generate:progress', listener))
    }
  },
  notion: {
    isConfigured: () => ipcRenderer.invoke('notion:isConfigured'),
    testConnection: () => ipcRenderer.invoke('notion:testConnection'),
    searchTopLevelPages: (query: string) => ipcRenderer.invoke('notion:searchTopLevelPages', query),
    listChildPages: (parentPageId: string) => ipcRenderer.invoke('notion:listChildPages', parentPageId),
    resolveUnitPage: (unit: string) => ipcRenderer.invoke('notion:resolveUnitPage', unit),
    mapUnitPage: (unit: string, pageId: string) => ipcRenderer.invoke('notion:mapUnitPage', unit, pageId),
    resolveTopicPage: (unitPageId: string, unit: string, topic: string) =>
      ipcRenderer.invoke('notion:resolveTopicPage', unitPageId, unit, topic),
    createTopicPage: (unitPageId: string, topic: string) =>
      ipcRenderer.invoke('notion:createTopicPage', unitPageId, topic),
    mapTopicPage: (unit: string, topic: string, pageId: string) =>
      ipcRenderer.invoke('notion:mapTopicPage', unit, topic, pageId),
    createNotesPage: (unitPageId: string, title: string, markdown: string) =>
      ipcRenderer.invoke('notion:createNotesPage', unitPageId, title, markdown)
  }
}

export type NotelyApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
