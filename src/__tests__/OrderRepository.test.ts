/**
 * OrderRepository.createOrder (CONVERSION_CAPABILITY_DESIGN) — capture a NEW order. The mongoose
 * model is mocked; BaseRepository.create calls model.create({...}) then doc.toObject(). The key
 * invariants: always `pending` (UNPAID — never confirms payment, ADR-068), carries items+total,
 * and generates an ORD- orderId unless one is supplied (idempotency key).
 */
import { OrderRepository, generateOrderId } from '../data/repositories/OrderRepository';

const mockCreate = jest.fn();

function makeRepo() {
  const model: any = { create: (...a: any[]) => mockCreate(...a) };
  return new OrderRepository(model);
}

const TENANT = 'aaaaaaaaaaaaaaaaaaaaaaaa';

describe('OrderRepository.createOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a pending (unpaid) order with items + total + a generated orderId', async () => {
    mockCreate.mockImplementation(async (d: any) => ({ toObject: () => d }));
    const items = [{ sku: 'PH-001', name: 'Samsung Galaxy A15', quantity: 2, unitPrice: 185000 }];

    const out: any = await makeRepo().createOrder(TENANT, {
      customerEmail: 'c@example.com',
      total: 370000,
      items,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.status).toBe('pending');
    expect(arg.paidAt).toBeUndefined(); // never paid at creation (ADR-068 — webhook only)
    expect(arg.paymentReference).toBeUndefined();
    expect(arg.customerEmail).toBe('c@example.com');
    expect(arg.total).toBe(370000);
    expect(arg.items).toEqual(items);
    expect(String(arg.orderId)).toMatch(/^ORD-/);
    expect(out.status).toBe('pending');
  });

  it('honours a supplied orderId (idempotency key) and defaults items to []', async () => {
    mockCreate.mockImplementation(async (d: any) => ({ toObject: () => d }));
    await makeRepo().createOrder(TENANT, { customerEmail: 'c@example.com', total: 1, orderId: 'ORD-FIXED' });
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.orderId).toBe('ORD-FIXED');
    expect(arg.items).toEqual([]);
  });
});

describe('generateOrderId', () => {
  it('is ORD-prefixed and distinct across calls', () => {
    const a = generateOrderId();
    const b = generateOrderId();
    expect(a).toMatch(/^ORD-/);
    expect(a).not.toBe(b);
  });
});
