import { describe, expect, it } from 'vitest';
import {
  extentWithZero,
  labelIndices,
  minMaxIndices,
  niceStep,
  niceTicks,
  scaleLinear,
} from '@/ui/components/charts/chartScale';
import { categoryColorVar, categoryPaletteSlot } from '@/ui/components/categoryColor';

describe('chartScale', () => {
  it('picks round steps', () => {
    expect(niceStep(100, 4)).toBe(25);
    expect(niceStep(97, 5)).toBe(20);
    expect(niceStep(0, 4)).toBe(1);
  });

  it('always includes zero in the extent', () => {
    expect(extentWithZero([5, 12])).toEqual([0, 12]);
    expect(extentWithZero([-3, 8])).toEqual([-3, 8]);
    expect(extentWithZero([])).toEqual([0, 0]);
  });

  it('builds nice ticks that cover the domain', () => {
    expect(niceTicks([0, 97])).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks([-30, 70])).toEqual([-50, -25, 0, 25, 50, 75]);
    expect(niceTicks([0, 0])).toEqual([0, 1]);
    expect(niceTicks([5, 5])).toEqual([0, 5]);
  });

  it('maps linearly and handles a degenerate domain', () => {
    const y = scaleLinear([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(scaleLinear([3, 3], [0, 10])(3)).toBe(5);
  });

  it('thins x labels but keeps the last one', () => {
    expect(labelIndices(4, 6)).toEqual([0, 1, 2, 3]);
    expect(labelIndices(24, 6)).toEqual([0, 4, 8, 12, 16, 23]);
    expect(labelIndices(0, 6)).toEqual([]);
  });

  it('finds min and max positions', () => {
    expect(minMaxIndices([3, 9, -1, 9])).toEqual({ min: 2, max: 1 });
    expect(minMaxIndices([])).toBeNull();
  });
});

describe('categoryColor', () => {
  it('maps domain colour tokens onto the 8-tone palette', () => {
    expect(categoryPaletteSlot('cat-3')).toBe(3);
    expect(categoryPaletteSlot('chart-9')).toBe(1);
    expect(categoryPaletteSlot('income-2')).toBe(3);
    expect(categoryPaletteSlot('neutral')).toBeNull();
    expect(categoryColorVar('transfer')).toBe('var(--color-cat-other)');
    expect(categoryColorVar('chart-2')).toBe('var(--color-cat-2)');
  });
});
