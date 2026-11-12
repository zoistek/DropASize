// Public SDK key, Test Store only. Never use this configuration in a store release.
export const TEST_API_KEY = 'test_IZdJBShihmchVXdudDqmfZEfkdh';
export function createTestBilling(Purchases, { allowTestStore = false } = {}) {
  let configured = false, user = null, queue = Promise.resolve();
  async function run(message) {
    // Never configure the Test Store in a release APK: the native SDK terminates it.
    if (!allowTestStore) throw new Error('Payment testing is disabled in this release APK. You can continue using the app.');
    const { userId, action } = message;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId || '')) throw new Error('Sign in before using subscriptions.');
    if (!['status', 'purchase', 'restore'].includes(action)) throw new Error('Unknown subscription action.');
    if (!configured) { Purchases.configure({ apiKey: TEST_API_KEY, appUserID: userId }); configured = true; user = userId; }
    else if (user !== userId) { await Purchases.logIn(userId); user = userId; }
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current && offerings.current.monthly;
    let info;
    if (action === 'purchase') {
      if (!pkg) throw new Error('No monthly package found. Check the current default offering in RevenueCat.');
      info = (await Purchases.purchasePackage(pkg)).customerInfo;
    } else info = action === 'restore' ? await Purchases.restorePurchases() : await Purchases.getCustomerInfo();
    const active = info.entitlements.active.premium;
    return { userId, testMode: true, premium: !!active, expiresAt: active && active.expirationDate || null, price: pkg && pkg.product.priceString || null, available: !!pkg };
  }
  return message => {
    const pending = queue.then(() => run(message));
    queue = pending.catch(() => {});
    return pending;
  };
}
