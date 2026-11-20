import { describe, expect, it } from 'vitest'
import { openDatabase } from '@/infrastructure/indexeddb/openDatabase'
import { IdbCategoryRepository } from '@/infrastructure/indexeddb/IdbCatalogRepositories'
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories'

describe('IdbCategoryRepository.saveMany', () => {
  it('guarda todas las categorías en una transacción', async () => {
    const db = await openDatabase(`cat-savemany-${Math.random()}`)
    const repo = new IdbCategoryRepository(db)
    await repo.saveMany(DEFAULT_CATEGORIES)
    expect(await repo.list()).toHaveLength(DEFAULT_CATEGORIES.length)
    db.close()
  })
})
