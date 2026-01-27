import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };

  const missing: string[] = [];
  if (!config.apiKey) missing.push("apiKey");
  if (!config.authDomain) missing.push("authDomain");
  if (!config.projectId) missing.push("projectId");
  if (!config.storageBucket) missing.push("storageBucket");
  if (!config.messagingSenderId) missing.push("messagingSenderId");
  if (!config.appId) missing.push("appId");

  return NextResponse.json(
    {
      ok: missing.length === 0,
      missing,
      config,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
