#!/usr/bin/env node
/**
 * API E2E smoke: deploy readiness + full order lifecycle + admin/analytics/offers.
 * Requires running API (default http://127.0.0.1:3000/api) and Postgres with migrations.
 *
 * Env: BASE_URL, BOT_TOKEN (for forged initData), ADMIN_TELEGRAM_ID (default 111111111)
 */

import { createHmac, randomBytes } from 'crypto';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:3000/api').replace(/\/$/, '');
const BOT_TOKEN = process.env.BOT_TOKEN ?? '1000000001:LOCAL_DEV_DUMMY_TOKEN_NOT_REAL';
const ADMIN_TG = process.env.ADMIN_TELEGRAM_ID ?? '111111111';
const BIZ = process.env.E2E_BIZ ?? 'eatfit';

const results = [];
let failed = 0;

function forgeInitData(user) {
  const authDate = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('user', JSON.stringify(user));
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

async function req(method, path, { token, body, expect } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (expect !== undefined && res.status !== expect) {
    throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)} (expected ${expect})`);
  }
  return { status: res.status, json, text };
}

async function ok(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failed += 1;
    results.push({ name, pass: false, error: err.message });
    console.error(`  ✘ ${name}: ${err.message}`);
  }
}

function uniqPhone() {
  return `+9989${Date.now().toString().slice(-8)}`;
}

function todayIsoWeekday(tzOffsetHours = 5) {
  const local = new Date(Date.now() + tzOffsetHours * 3_600_000);
  const dow = local.getUTCDay();
  return dow === 0 ? 7 : dow;
}

async function main() {
  console.log(`E2E smoke → ${BASE} (biz=${BIZ})\n`);

  let adminToken;
  let customerToken;
  let customerId;
  let menuItemId;
  let orderId;
  let orderTotal;
  let offerId;

  await ok('GET /health', async () => {
    const { json } = await req('GET', '/health', { expect: 200 });
    if (json?.status !== 'ok') throw new Error(JSON.stringify(json));
  });

  await ok('GET /config?biz=', async () => {
    const { json } = await req('GET', `/config?biz=${BIZ}`, { expect: 200 });
    if (!json?.slug) throw new Error('missing slug');
  });

  await ok('Platform admin telegram auth', async () => {
    const initData = forgeInitData({
      id: Number(ADMIN_TG),
      first_name: 'E2E Admin',
      username: 'e2e_admin',
    });
    const { json } = await req('POST', '/auth/telegram', {
      body: { initData, biz: BIZ },
      expect: 200,
    });
    adminToken = json.accessToken;
    if (!adminToken) throw new Error('no accessToken');
  });

  await ok('GET /platform/metrics (platform admin)', async () => {
    await req('GET', '/platform/metrics', { token: adminToken, expect: 200 });
  });

  await ok('GET /platform/businesses', async () => {
    const { json } = await req('GET', '/platform/businesses', { token: adminToken, expect: 200 });
    if (!Array.isArray(json) || json.length === 0) throw new Error('no businesses');
  });

  await ok('POST /admin/menu — create dish', async () => {
    const suffix = randomBytes(3).toString('hex');
    const { json } = await req('POST', '/admin/menu', {
      token: adminToken,
      expect: 201,
      body: {
        category: 'main',
        nameRu: `E2E блюдо ${suffix}`,
        nameUz: `E2E taom ${suffix}`,
        price: 25000,
        isActive: true,
        weightGrams: 300,
        days: [todayIsoWeekday()],
      },
    });
    menuItemId = json.id;
    if (!menuItemId) throw new Error('no menu item id');
  });

  await ok('GET /menu — public vitrine includes dish', async () => {
    const { json } = await req('GET', '/menu', { expect: 200 });
    const items = Array.isArray(json) ? json : json.items ?? [];
    if (!items.some((i) => i.id === menuItemId)) throw new Error('dish not in public menu');
  });

  await ok('Customer register + login', async () => {
    const phone = uniqPhone();
    const password = 'e2e-pass-1';
    await req('POST', '/auth/register', {
      body: {
        name: 'E2E Customer',
        phone,
        password,
        address: 'Tashkent, test 1',
        biz: BIZ,
      },
      expect: 201,
    });
    const { json } = await req('POST', '/auth/login', {
      body: { phone, password, biz: BIZ },
      expect: 200,
    });
    customerToken = json.accessToken;
    customerId = json.client?.id;
    if (!customerToken || !customerId) throw new Error('register/login failed');
  });

  await ok('Cart add + checkout (cash order)', async () => {
    await req('POST', '/cart/items', {
      token: customerToken,
      body: { menuItemId, quantity: 2, portion: 1 },
      expect: 201,
    });
    const { json: order } = await req('POST', '/orders', {
      token: customerToken,
      body: { paymentMethod: 'on_delivery', comment: 'E2E smoke' },
      expect: 201,
    });
    orderId = order.id;
    orderTotal = order.total;
    if (!orderId) throw new Error('no order id');
  });

  await ok('Order lifecycle pending → done', async () => {
    const steps = ['confirmed', 'cooking', 'ready', 'delivering', 'done'];
    for (const status of steps) {
      const { json } = await req('POST', `/admin/orders/${orderId}/status`, {
        token: adminToken,
        body: { status },
        expect: 201,
      });
      if (json.status !== status) throw new Error(`expected ${status}, got ${json.status}`);
    }
  });

  await ok('Admin deposit + balance order + refund cancel', async () => {
    const depositAmount = 100000;
    await req('POST', '/admin/deposits', {
      token: adminToken,
      body: { clientId: customerId, amount: depositAmount },
      expect: 201,
    });
    await req('POST', '/cart/items', {
      token: customerToken,
      body: { menuItemId, quantity: 1, portion: 1 },
      expect: 201,
    });
    const { json: balOrder } = await req('POST', '/orders', {
      token: customerToken,
      body: { paymentMethod: 'balance' },
      expect: 201,
    });
    await req('POST', `/admin/orders/${balOrder.id}/status`, {
      token: adminToken,
      body: { status: 'cancelled' },
      expect: 201,
    });
  });

  await ok('GET /b/analytics dashboard', async () => {
    await req('GET', '/b/analytics?range=today', { token: adminToken, expect: 200 });
  });

  await ok('Settings GET/PUT (back office)', async () => {
    await req('GET', '/b/settings', { token: adminToken, expect: 200 });
    await req('PUT', '/b/settings', {
      token: adminToken,
      body: { topupTelegram: '@e2e_topup', supportContact: '@e2e_support' },
      expect: 200,
    });
  });

  await ok('Offers create + send to customer', async () => {
    const { json: offer } = await req('POST', '/b/offers', {
      token: adminToken,
      body: {
        composition: [{ kind: 'dish', menuItemId, quantity: 1, portion: 1, modifierIds: [] }],
        descriptionRu: 'E2E offer',
      },
      expect: 201,
    });
    offerId = offer.id;
    await req('POST', `/b/offers/${offerId}/recipients`, {
      token: adminToken,
      body: { clientIds: [customerId] },
      expect: 201,
    });
    await req('POST', `/b/offers/${offerId}/send`, { token: adminToken, expect: 201 });
  });

  await ok('Business checklist', async () => {
    const { json } = await req('GET', '/b/checklist', { token: adminToken, expect: 200 });
    if (typeof json !== 'object') throw new Error('invalid checklist');
  });

  await ok('GET SPA root (non-API)', async () => {
    const root = BASE.replace(/\/api$/, '');
    const res = await fetch(root, { redirect: 'follow' });
    if (res.status !== 200) throw new Error(`SPA root ${res.status}`);
  });

  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
