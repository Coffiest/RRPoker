import { Purchases } from "@revenuecat/purchases-capacitor"
import { Capacitor } from "@capacitor/core"

// Mirrors APPLE_PRODUCT_MAP / ANDROID_PRODUCT_MAP in app/api/iap/revenuecat-webhook/route.ts
// Same identifier strings are reused for both stores' product/subscription IDs
// (Google Play allows this dotted format too) so this map and the webhook's
// product->plan lookup don't need a second, parallel set of IDs.
const PRODUCT_IDS: Record<string, string> = {
  "standard:monthly": "com.rrpoker.app.standard.monthly",
  "standard:yearly": "com.rrpoker.app.standard.yearly",
  "circle:monthly": "com.rrpoker.app.circle.monthly",
  "circle:yearly": "com.rrpoker.app.circle.yearly",
}

export async function configureIAP(uid: string) {
  const platform = Capacitor.getPlatform()
  const apiKey = platform === "android"
    ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY!
    : process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY!

  await Purchases.configure({ apiKey, appUserID: uid })
}

export async function purchaseStorePlan(plan: "standard" | "circle", interval: "monthly" | "yearly", circleCode?: string) {
  const productId = PRODUCT_IDS[`${plan}:${interval}`]
  if (!productId) throw new Error("無効なプランです")

  if (circleCode) await Purchases.setAttributes({ circle_code: circleCode })

  const { current } = await Purchases.getOfferings()
  const pkg = current?.availablePackages.find(p => p.product.identifier === productId)
  if (!pkg) throw new Error("商品が見つかりません")

  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
  return customerInfo
}
