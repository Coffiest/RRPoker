import Stripe from "stripe"
import { lazy } from "@/lib/lazy"

export const stripe = lazy<Stripe>(() => {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  return new Stripe(key)
})
