import { NextResponse } from "next/server";

type VerifyResponse = {
  success?: boolean;
  score?: number;
  action?: string;
};

function shouldBypassRecaptchaInDev() {
  const isProduction = process.env.NODE_ENV === "production";
  const explicitBypassOff = process.env.RECAPTCHA_BYPASS_IN_DEV === "false";
  return !isProduction && !explicitBypassOff;
}

function devBypassResponse(reason: string) {
  return NextResponse.json(
    {
      success: true,
      bypassed: true,
      reason,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

export async function POST(request: Request) {
  const secret = process.env.NEXT_RECAPTCHA_SECRET_KEY;

  if (!secret) {
    if (shouldBypassRecaptchaInDev()) {
      return devBypassResponse("dev-bypass-missing-secret");
    }

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
    if (shouldBypassRecaptchaInDev()) {
      return devBypassResponse("dev-bypass-google-unavailable");
    }

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

  if (!isValid && shouldBypassRecaptchaInDev()) {
    return devBypassResponse("dev-bypass-low-score-or-action");
  }

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
