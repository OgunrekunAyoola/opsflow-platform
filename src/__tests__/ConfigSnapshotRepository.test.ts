/**
 * ConfigSnapshotRepository.snapshot (G3) — content-hash dedup + version assignment + the
 * duplicate-key race. The mongoose model is mocked; findOne({contentHash}) resolves the
 * by-hash lookup, findOne({tenantId}).sort() resolves the latest-version lookup.
 */
import { ConfigSnapshotRepository } from '../data/repositories/ConfigSnapshotRepository';

const mockByHashLean = jest.fn();
const mockLatestLean = jest.fn();
const mockCreate = jest.fn();

function makeRepo() {
  const model: any = {
    findOne: (filter: any) =>
      filter.contentHash !== undefined
        ? { lean: () => mockByHashLean() }
        : { sort: () => ({ lean: () => mockLatestLean() }) },
    create: (...a: any[]) => mockCreate(...a),
  };
  return new ConfigSnapshotRepository(model);
}

const TENANT = 'aaaaaaaaaaaaaaaaaaaaaaaa';

describe('ConfigSnapshotRepository.snapshot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('dedups: an identical config reuses the existing snapshot (no create)', async () => {
    mockByHashLean.mockResolvedValue({ _id: 'snap-1', version: 3 });
    const res = await makeRepo().snapshot(TENANT, { qualityThreshold: 70 });
    expect(res).toEqual({ snapshotId: 'snap-1', version: 3 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates version 1 for the first snapshot of a tenant', async () => {
    mockByHashLean.mockResolvedValue(null);
    mockLatestLean.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ _id: 'snap-new' });
    const res = await makeRepo().snapshot(TENANT, { a: 1 });
    expect(res).toEqual({ snapshotId: 'snap-new', version: 1 });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1, contentHash: expect.any(String), config: { a: 1 } }),
    );
  });

  it('assigns version = latest + 1 for a new config', async () => {
    mockByHashLean.mockResolvedValue(null);
    mockLatestLean.mockResolvedValue({ version: 5 });
    mockCreate.mockResolvedValue({ _id: 'snap-6' });
    const res = await makeRepo().snapshot(TENANT, { a: 2 });
    expect(res).toEqual({ snapshotId: 'snap-6', version: 6 });
  });

  it('is race-safe: a duplicate-key create error fetches and reuses the winning row', async () => {
    mockByHashLean.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'snap-race', version: 2 });
    mockLatestLean.mockResolvedValue({ version: 1 });
    mockCreate.mockRejectedValue({ code: 11000 });
    const res = await makeRepo().snapshot(TENANT, { a: 3 });
    expect(res).toEqual({ snapshotId: 'snap-race', version: 2 });
  });

  it('hashes config deterministically regardless of key order (dedup holds)', async () => {
    mockByHashLean.mockResolvedValue(null);
    mockLatestLean.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ _id: 's' });
    await makeRepo().snapshot(TENANT, { a: 1, b: 2 });
    const hash1 = mockCreate.mock.calls[0][0].contentHash;
    jest.clearAllMocks();
    mockByHashLean.mockResolvedValue(null);
    mockLatestLean.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ _id: 's' });
    await makeRepo().snapshot(TENANT, { b: 2, a: 1 });
    expect(mockCreate.mock.calls[0][0].contentHash).toBe(hash1);
  });
});
