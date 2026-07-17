/* eslint-disable @typescript-eslint/no-explicit-any */
import { chunkBlocks } from './markdownToBlocks'

// A version that supports creating toggleable headings (is_toggleable) is required — older
// versions don't support the property. Confirmed valid via the API's own validation error
// (it lists accepted values): 2021-05-11, 2021-05-13, 2021-08-16, 2022-02-22, 2022-06-28,
// 2025-09-03, 2026-03-11. Using the latest.
const NOTION_VERSION = '2026-03-11'
const BASE = 'https://api.notion.com/v1'

export interface NotionPageRef {
  id: string
  title: string
  icon?: string
}

async function notionFetch(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<any> {
  const doFetch = async (): Promise<Response> =>
    fetch(`${BASE}${path}`, {
      method: init.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: init.body ? JSON.stringify(init.body) : undefined
    })

  let resp = await doFetch()
  if (resp.status === 429) {
    const retryAfter = Number(resp.headers.get('Retry-After') || '1')
    await new Promise((r) => setTimeout(r, Math.max(1, retryAfter) * 1000))
    resp = await doFetch()
  }
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    const message = data?.message || `Notion API ${resp.status}`
    throw new Error(message)
  }
  return resp.json()
}

function extractTitle(page: any): string {
  const props = page.properties || {}
  for (const key of Object.keys(props)) {
    const prop = props[key]
    if (prop?.type === 'title') {
      return (prop.title || []).map((t: any) => t.plain_text).join('') || 'Untitled'
    }
  }
  return 'Untitled'
}

function extractIcon(page: any): string | undefined {
  if (page.icon?.type === 'emoji') return page.icon.emoji
  return undefined
}

export async function testConnection(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await notionFetch(token, '/users/me')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function searchPages(token: string, query: string): Promise<NotionPageRef[]> {
  const data = await notionFetch(token, '/search', {
    method: 'POST',
    body: {
      query,
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 15
    }
  })
  return (data.results || []).map((p: any) => ({
    id: p.id,
    title: extractTitle(p),
    icon: extractIcon(p)
  }))
}

const HEADING_TYPES = ['heading_1', 'heading_2', 'heading_3']

// Topics live as toggleable headings directly inside the Unit page (not separate child
// pages) — this lists the existing ones so we can match/reuse them by title.
export async function listToggleHeadings(token: string, unitPageId: string): Promise<NotionPageRef[]> {
  const data = await notionFetch(token, `/blocks/${unitPageId}/children?page_size=100`)
  return (data.results || [])
    .filter((b: any) => HEADING_TYPES.includes(b.type) && b[b.type]?.is_toggleable)
    .map((b: any) => ({
      id: b.id,
      title: (b[b.type].rich_text || []).map((t: any) => t.plain_text).join('') || 'Untitled'
    }))
}

export async function createTopicHeading(
  token: string,
  unitPageId: string,
  title: string
): Promise<NotionPageRef> {
  const data = await notionFetch(token, `/blocks/${unitPageId}/children`, {
    method: 'PATCH',
    body: {
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ text: { content: title } }], is_toggleable: true }
        }
      ]
    }
  })
  const created = data.results?.[0]
  return { id: created.id, title }
}

async function appendBlocksBatched(token: string, blockId: string, blocks: unknown[]): Promise<void> {
  for (const chunk of chunkBlocks(blocks as any[])) {
    await notionFetch(token, `/blocks/${blockId}/children`, {
      method: 'PATCH',
      body: { children: chunk }
    })
  }
}

// Notion's Pages API only accepts page_id/database_id/data_source_id/workspace as a new
// page's parent — a block_id (e.g. a toggle heading) is rejected outright (confirmed against
// the live API, not just docs). So the notes page is created as a sibling of the toggle
// heading, both children of the Unit page — dragging the notes page into the toggle heading
// (if wanted) is a manual step in Notion, not automated here.
export async function createNotesPage(
  token: string,
  unitPageId: string,
  title: string,
  blocks: unknown[]
): Promise<{ id: string; url: string }> {
  const chunks = chunkBlocks(blocks as any[])
  const first = chunks[0] || []
  const data = await notionFetch(token, '/pages', {
    method: 'POST',
    body: {
      parent: { page_id: unitPageId },
      properties: { title: { title: [{ text: { content: title } }] } },
      children: first
    }
  })
  if (blocks.length > first.length) {
    await appendBlocksBatched(token, data.id, (blocks as any[]).slice(first.length))
  }
  return { id: data.id, url: data.url }
}
