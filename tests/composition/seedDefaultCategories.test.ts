import { describe, expect, it, vi } from 'vitest'
import { seedDefaultCategories } from '@/composition/buildContainer'
import { DEFAULT_CATEGORIES } from '@/domain/category/defaultCategories'
import { createInMemoryState } from '../fakes/InMemoryState'
import { InMemoryCategoryRepository } from '../fakes/InMemoryCatalogRepositories'

describe('seedDefaultCategories (silent-failures MEDIA-8)', () => {
  it('con el catálogo vacío guarda todas las categorías por defecto en una sola operación atómica', async () => {
    const repo = new InMemoryCategoryRepository(createInMemoryState())
    const saveMany = vi.spyOn(repo, 'saveMany')
    const save = vi.spyOn(repo, 'save')

    await seedDefaultCategories(repo)

    expect(saveMany).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
    expect((await repo.list()).map((c) => c.id).sort()).toEqual(DEFAULT_CATEGORIES.map((c) => c.id).sort())
  })

  it('no vuelve a crear categorías por defecto que la persona borró', async () => {
    const repo = new InMemoryCategoryRepository(createInMemoryState())
    await repo.save(DEFAULT_CATEGORIES[0]!)

    await seedDefaultCategories(repo)

    expect(await repo.list()).toHaveLength(1)
  })
})
