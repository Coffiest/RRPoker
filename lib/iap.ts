import { Purchases } from "@revenuecat/purchases-capacitor"
import { Capacitor } from "@capacitor/core"

// iOS App Store product IDs (Standard年額はApp Store非対応・Stripe/Web限定)
const PRODUCT_IDS: Record<string, string> = {
  "standard:monthly": "com.rrpoker.standard.monthly",
  "circle:monthly":   "com.rrpoker.circle.monthly",
  "circle:yearly":    "com.rrpoker.circle.yearly",
}

export async function configureIAP(uid: string) {
  const platform = Capacitor.getPlatform()
  const apiKey = platform === "android"
    ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY
    : process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY
  if (!apiKey) return
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
