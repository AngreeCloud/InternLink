import { NextResponse } from "next/server";

type VerifyResponse = {
  success?: boolean;
  score?: number;
  action?: string;
};

export async function POST(request: Request) {
  const secret = process.env.NEXT_RECAPTCHA_SECRET_KEY;

  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        reason: "missing-secret",
      },
      { status: 500 }
    );
  }

  let token = "";
  let expectedAction = "";

  try {
    const body = (await request.json()) as { token?: string; action?: string };
    token = String(body.token || "").trim();
    expectedAction = String(body.action || "").trim();
  } catch {
    return NextResponse.json(
      {
        success: false,
        reason: "invalid-body",
      },
      { status: 400 }
    );
  }

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        reason: "missing-token",
      },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    secret,
    response: token,
  });

  const verifyResponse = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!verifyResponse.ok) {
    return NextResponse.json(
      {
        success: false,
        reason: "google-unavailable",
      },
      { status: 502 }
    );
  }

  const verification = (await verifyResponse.json()) as VerifyResponse;
  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || "0.5");
  const hasValidScore = typeof verification.score === "number" && verification.score >= minScore;
  const hasValidAction = expectedAction ? verification.action === expectedAction : true;
  const isValid = Boolean(verification.success && hasValidScore && hasValidAction);

  return NextResponse.json(
    {
      success: isValid,
      score: verification.score ?? null,
      action: verification.action ?? null,
      minScore,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
