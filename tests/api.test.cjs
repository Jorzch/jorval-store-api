const assert = require('node:assert/strict');
const { test } = require('node:test');
process.env.JWT_SECRET ||= 'test-secret';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://unused:unused@localhost:5432/unused';
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
const { PrismaModule } = require('../src/infrastructure/modules/prisma');
const { Cart } = require('../src/domain/entities/cart.entity');
const { CartItem } = require('../src/domain/entities/cart-item.entity');
const { User } = require('../src/domain/entities/user.entity');
const { OrderFactory } = require('../src/infrastructure/factories/order.factory');
const { CartService } = require('../src/application/components/cart/cart.service');

function item(quantity = 2) {
  return new CartItem({ id: 'item', quantity, Product: { toSafeObject: { id: 'product', slug: 'demo', price: 10, stock: 5 } } });
}

test('entities serialize safe cart and order data without exposing passwords', () => {
  const user = new User({ id: 'user', name: 'Demo', email: 'demo@example.com', password: 'private-hash', role: 'USER' });
  const cart = new Cart({ id: 'cart', User: user, CartItems: [item()] });
  const result = JSON.parse(JSON.stringify(cart));
  assert.equal(result.CartItems[0].quantity, 2);
  assert.equal(result.CartItems[0].Product.slug, 'demo');
  assert.equal(JSON.parse(JSON.stringify(user)).password, undefined);
  const order = OrderFactory.createFromMinimalInputs(cart.toSafeObject.CartItems);
  const restored = OrderFactory.createFromDb({ id: 'order', details: JSON.stringify(order.toSafeObject.details) });
  assert.equal(restored.toSafeObject.details.products[0].quantity, 2);
  assert.equal(restored.toSafeObject.details.total, 20);
});

test('login and signup use a relative one-day cookie lifetime even after server uptime', async (t) => {
  const { AuthService } = require('../src/application/components/auth/auth.service');
  const { login, signup } = require('../src/application/components/auth/auth.controller');
  for (const name of ['login', 'signup']) {
    t.mock.method(AuthService.prototype, name, async () => ({ user: { id: 'user' }, token: 'token' }));
  }
  // Controllers were imported before advancing the clock beyond the old fixed expiry.
  const future = Date.now() + 3 * 24 * 60 * 60 * 1000;
  t.mock.method(Date, 'now', () => future);
  for (const handler of [login, signup]) {
    let options;
    const res = {
      cookie(name, value, opts) { assert.equal(name, 'jwt'); options = opts; },
      status() { return this; }, json() {},
    };
    await handler({ body: { email: 'demo@example.com', name: 'Demo', password: 'password123' } }, res);
    assert.equal(options.maxAge, 86400000);
    assert.equal(options.expires, undefined);
    assert.equal(options.httpOnly, true);
  }
});

test('every cart write finishes before success and propagates database errors', async () => {
  for (const [operation, existing, quantity, write] of [
    ['addProduct', null, 1, 'createCartItem'],
    ['addProduct', item(), 1, 'updateCartItem'],
    ['removeProduct', item(), 1, 'updateCartItem'],
    ['removeProduct', item(), 2, 'deleteCartItem'],
  ]) {
    const service = new CartService();
    service.getByUserEmail = async () => ({});
    service.productService = { getBySlug: async () => ({ toSafeObject: { stock: 5 } }) };
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    service.cartRepository = {
      getCartItemByProduct: async () => existing,
      [write]: async () => { await pending; throw new Error('database write failed'); },
    };
    let settled = false;
    const result = service[operation]('demo@example.com', 'demo', quantity);
    const rejected = assert.rejects(result, /database write failed/);
    result.then(() => { settled = true; }, () => { settled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false, `${write} must be awaited`);
    release();
    await rejected;
  }
});

test('HTTP cart and checkout behavior against PostgreSQL', { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  // Explicit opt-in: fixtures are created and removed only in this database.
  const db = PrismaModule.getInstance();
  const express = require('express');
  const { expressLoader } = require('../src/infrastructure/loaders/express');
  const app = express();
  await expressLoader(app);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const prefix = `regression-${Date.now()}-${process.pid}`;
  const userIds = [];
  let category;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await db.cartItem.deleteMany({ where: { Cart: { userId: { in: userIds } } } });
    await db.order.deleteMany({ where: { userId: { in: userIds } } });
    await db.cart.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    if (category) {
      await db.product.deleteMany({ where: { categoryId: category.id } });
      await db.category.delete({ where: { id: category.id } });
    }
    await db.$disconnect();
  });
  async function request(path, cookie, body) {
    const res = await fetch(base + path, { method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0], headers: res.headers };
  }
  async function account(suffix) {
    const result = await request('/auth/signup', null, { name: 'Test User', email: `${prefix}-${suffix}@example.com`, password: 'password123' });
    assert.equal(result.status, 201);
    userIds.push(result.body.data.user.id);
    assert.match(result.headers.get('set-cookie'), /Max-Age=86400/);
    return { id: result.body.data.user.id, cookie: result.cookie };
  }
  const a = await account('a');
  const b = await account('b');
  category = await db.category.create({ data: { name: prefix } });
  async function product(suffix, stock = 5) {
    return db.product.create({ data: { slug: `${prefix}-${suffix}`, title: suffix, description: 'Test product', price: 10, stock, images: ['https://example.com/test.png'], categoryId: category.id } });
  }
  const p = await product('normal');
  await t.test('add, increment, decrement, and delete are immediately visible', async () => {
    for (const [path, quantity, expected] of [['add', 2, 2], ['add', 1, 3], ['remove', 1, 2], ['remove', 2, 0]]) {
      const result = await request(`/cart/${path}`, a.cookie, { productSlug: p.slug, quantity });
      assert.equal(result.status, 200);
      const cart = await request('/cart', a.cookie);
      assert.equal(cart.body.data.CartItems.length, expected ? 1 : 0);
      if (expected) assert.equal(cart.body.data.CartItems[0].quantity, expected);
    }
  });
  await t.test('empty checkout is rejected', async () => {
    assert.equal((await request('/cart/checkout', a.cookie, {})).status, 400);
    assert.equal(await db.order.count({ where: { userId: a.id } }), 0);
  });
  await t.test('checkout returns a readable order, clears cart, and reduces stock once', async () => {
    await request('/cart/add', a.cookie, { productSlug: p.slug, quantity: 2 });
    const result = await request('/cart/checkout', a.cookie, {});
    assert.equal(result.status, 200);
    assert.equal(result.body.data.details.products[0].Product.slug, p.slug);
    assert.equal(result.body.data.details.total, 20);
    assert.equal((await request('/cart', a.cookie)).body.data.CartItems.length, 0);
    assert.equal((await db.product.findUnique({ where: { id: p.id } })).stock, 3);
    const orders = await request('/orders', a.cookie);
    assert.equal(orders.body.data[0].details.products[0].quantity, 2);
    const stored = await db.order.findUnique({ where: { id: result.body.data.id } });
    assert.equal(JSON.parse(stored.details).products[0].quantity, 2);
  });
  await t.test('insufficient stock rolls back all stock changes and preserves the cart', async () => {
    const first = await product('rollback-first');
    const second = await product('rollback-second');
    for (const product of [first, second]) await request('/cart/add', a.cookie, { productSlug: product.slug, quantity: 2 });
    await db.product.update({ where: { id: second.id }, data: { stock: 0 } });
    const before = await db.order.count({ where: { userId: a.id } });
    assert.equal((await request('/cart/checkout', a.cookie, {})).status, 400);
    assert.equal((await db.product.findUnique({ where: { id: first.id } })).stock, 5);
    assert.equal((await request('/cart', a.cookie)).body.data.CartItems.length, 2);
    assert.equal(await db.order.count({ where: { userId: a.id } }), before);
    await db.cartItem.deleteMany({ where: { Cart: { userId: a.id } } });
  });
  await t.test('concurrent checkout of one cart creates only one order', async () => {
    const p = await product('same-cart', 2);
    await request('/cart/add', a.cookie, { productSlug: p.slug, quantity: 1 });
    const before = await db.order.count({ where: { userId: a.id } });
    const results = await Promise.all([request('/cart/checkout', a.cookie, {}), request('/cart/checkout', a.cookie, {})]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    assert.equal(await db.order.count({ where: { userId: a.id } }), before + 1);
    assert.equal((await db.product.findUnique({ where: { id: p.id } })).stock, 1);
  });
  await t.test('two buyers cannot both buy the final unit', async () => {
    const p = await product('last-unit', 1);
    for (const user of [a, b]) assert.equal((await request('/cart/add', user.cookie, { productSlug: p.slug, quantity: 1 })).status, 200);
    const results = await Promise.all([request('/cart/checkout', a.cookie, {}), request('/cart/checkout', b.cookie, {})]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    assert.equal((await db.product.findUnique({ where: { id: p.id } })).stock, 0);
    assert.equal(await db.cartItem.count({ where: { productId: p.id } }), 1);
  });
});
