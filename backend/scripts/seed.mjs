/**
 * Seeds a couple of users, wallets and transactions through the running API.
 * Usage: API_URL=http://localhost:3001 node scripts/seed.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3001';

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const aaira = await post('/walletUsers', {
    name: 'Aaira Taimoor',
    phone: '+923323445532',
    email: `aaira+${Date.now()}@example.com`,
  });
  const soban = await post('/walletUsers', {
    name: 'Soban Taimoor',
    phone: '+923323445532',
    email: `Soban+${Date.now()}@example.com`,
  });

  const wallet = await post('/wallets', { userId: aaira.id, currency: 'USD' });
  await post('/wallets', { userId: soban.id, currency: 'PKR' });

  await post(`/wallets/${wallet.id}/credit`, {
    amount: '500.00',
    referenceId: `seed-credit-${Date.now()}`,
    description: 'Initial top-up',
  });
  await post(`/wallets/${wallet.id}/debit`, {
    amount: '120.50',
    referenceId: `seed-debit-${Date.now()}`,
    description: 'Ride payment',
  });

  console.log('Seed complete. Sample wallet id:', wallet.id);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
