/**
 * ProductCatalogRepository.findBySku (conversion capability) — find the ACTIVE product holding a
 * variant with an exact SKU. The mongoose model is mocked (findOne → lean → exec).
 */
import { ProductCatalogRepository } from '../data/repositories/ProductCatalogRepository';

const mockExec = jest.fn();
let lastFilter: any;

function makeRepo() {
  const model: any = {
    findOne: (filter: any) => {
      lastFilter = filter;
      return { lean: () => ({ exec: () => mockExec() }) };
    },
  };
  return new ProductCatalogRepository(model);
}

const TENANT = 'aaaaaaaaaaaaaaaaaaaaaaaa';

describe('ProductCatalogRepository.findBySku', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries active products by exact variant SKU and returns the match', async () => {
    const product = {
      name: 'Samsung Galaxy A15',
      status: 'active',
      variants: [{ sku: 'PH-001', price: 185000 }],
    };
    mockExec.mockResolvedValue(product);

    const out = await makeRepo().findBySku(TENANT, 'PH-001');

    expect(out).toBe(product);
    expect(lastFilter.status).toBe('active');
    expect(lastFilter['variants.sku']).toBe('PH-001');
  });

  it('returns null when no active product has that SKU', async () => {
    mockExec.mockResolvedValue(null);
    expect(await makeRepo().findBySku(TENANT, 'NOPE')).toBeNull();
  });
});
