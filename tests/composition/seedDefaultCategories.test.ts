import { describe, expect, it } from 'vitest'
import { seedDefaultCategories } from '@/composition/buildContainer'
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories'
import { createInMemoryState } from '../fakes/InMemoryState'
import { InMemoryCategoryRepository } from '../fakes/InMemoryCatalogRepositories'

describe('seedDefaultCategories (silent-failures MEDIA-8)', () => {
  it('completa las categorías por defecto que falten tras una semilla interrumpida', async () => {
    const repo = new InMemoryCategoryRepository(createInMemoryState())
    await repo.save(DEFAULT_CATEGORIES[0]!)

    await seedDefaultCategories(repo)

    const ids = (await repo.list()).map((c) => c.id).sort()
    expect(ids).toEqual(DEFAULT_CATEGORIES.map((c) => c.id).sort())
  })

  it('no pisa una categoría por defecto que la persona renombró', async () => {
    const repo = new InMemoryCategoryRepository(createInMemoryState())
    const renamed = { ...DEFAULT_CATEGORIES[1]!, name: 'Mi nombre' }
    await repo.save(renamed)

    await seedDefaultCategories(repo)

    expect((await repo.list()).find((c) => c.id === renamed.id)?.name).toBe('Mi nombre')
  })
})
