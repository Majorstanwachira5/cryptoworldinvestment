import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const JWT_SECRET =
  process.env.JWT_SECRET || "cryptohub_ai_super_secret_jwt_key_2026";

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function signJwt(payload: any): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = base64Url(
    crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${signature}`;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const claims = JSON.parse(fromBase64Url(parts[1]));
    return NextResponse.json({
      authenticated: true,
      token,
      user: {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        role: claims.role,
      },
      expiresAt: claims.exp,
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Built-in administrative authority identities for RBAC matrix
    const adminAccounts: Record<
      string,
      {
        id: string;
        name: string;
        role: "super_admin" | "admin" | "support" | "viewer";
        passwords: string[];
      }
    > = {
      "superadmin@cryptohub.io": {
        id: "usr_admin_super",
        name: "Super Administrator",
        role: "super_admin",
        passwords: ["AdminSecure2026!", "Admin@2026!", "AdminPassword123!"],
      },
      "admin@cryptohub.io": {
        id: "usr_admin_ops",
        name: "Operations Admin",
        role: "admin",
        passwords: ["AdminSecure2026!", "Admin@2026!", "AdminPassword123!"],
      },
      "support@cryptohub.io": {
        id: "usr_admin_sup",
        name: "Tier 2 Support",
        role: "support",
        passwords: ["SupportPass2026!", "Support@2026!", "SupportPassword123!"],
      },
      "viewer@cryptohub.io": {
        id: "usr_admin_view",
        name: "Audit Viewer",
        role: "viewer",
        passwords: ["ViewerPass2026!", "Viewer@2026!", "ViewerPassword123!"],
      },
      "trader@cryptohub.io": {
        id: "usr_admin_trader",
        name: "Alex Sterling",
        role: "admin",
        passwords: ["TraderPass2026!", "Admin@2026!"],
      },
    };

    const targetAccount = adminAccounts[cleanEmail];
    if (!targetAccount || !targetAccount.passwords.includes(password)) {
      return NextResponse.json(
        { success: false, error: "Invalid administrative credentials." },
        { status: 401 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7 * 24 * 3600; // 7 days

    const token = signJwt({
      sub: targetAccount.id,
      email: cleanEmail,
      name: targetAccount.name,
      role: targetAccount.role,
      iss: "cryptohub_admin",
      iat: now,
      exp,
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: targetAccount.id,
        email: cleanEmail,
        name: targetAccount.name,
        role: targetAccount.role,
      },
      expiresAt: exp,
    });

    // Set secure, HttpOnly, SameSite=Lax cookie
    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error during authentication." },
      { status: 500 }
    );
  }
}
