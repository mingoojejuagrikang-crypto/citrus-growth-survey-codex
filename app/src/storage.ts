import { openDB } from 'idb'

import type { PersistedAppState, SurveyRecord } from './types'

const DB_NAME = 'citrus-growth-survey'
const DB_VERSION = 1
const META_STORE = 'meta'
const RECORDS_STORE = 'records'
const APP_STATE_KEY = 'app-state'

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE)
      }

      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        db.createObjectStore(RECORDS_STORE, { keyPath: 'id' })
      }
    },
  })
}

export async function loadPersistedState(): Promise<{
  appState: PersistedAppState | null
  records: SurveyRecord[]
}> {
  const db = await getDb()
  const [appState, records] = await Promise.all([
    db.get(META_STORE, APP_STATE_KEY) as Promise<PersistedAppState | undefined>,
    db.getAll(RECORDS_STORE) as Promise<SurveyRecord[]>,
  ])

  return {
    appState: appState ?? null,
    records: records.sort((a, b) => b.audit.updatedAt.localeCompare(a.audit.updatedAt)),
  }
}

export async function persistAppState(state: PersistedAppState) {
  const db = await getDb()
  await db.put(META_STORE, state, APP_STATE_KEY)
}

export async function upsertRecord(record: SurveyRecord) {
  const db = await getDb()
  await db.put(RECORDS_STORE, record)
}
