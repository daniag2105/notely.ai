import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import * as fileScanner from '../services/fileScanner'

function assertInside(root: string, target: string): void {
  const rel = path.relative(path.resolve(root), path.resolve(target))
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('File is outside the selected folder.')
  }
}

export function registerFilesIpc(): void {
  ipcMain.handle('files:pickFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('files:scanFolder', async (_e, rootPath: string) => {
    return fileScanner.scanFolder(rootPath)
  })

  ipcMain.handle('files:readFile', async (_e, rootPath: string, filePath: string) => {
    assertInside(rootPath, filePath)
    const buf = await fs.readFile(filePath)
    return buf.toString('base64')
  })
}
