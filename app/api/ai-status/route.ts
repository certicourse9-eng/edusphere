import { NextRequest, NextResponse } from 'next/server';
import { getPoolStatus, getRecentUsage, toggleAccount } from '@/lib/ai/pool';

export async function GET() {
  return NextResponse.json({ accounts: getPoolStatus(), recentUsage: getRecentUsage(50) });
}

interface ToggleBody {
  accountId?: string;
  enabled?: boolean;
}

export async function POST(req: NextRequest) {
  let body: ToggleBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.accountId !== 'string' || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Request body must include "accountId" (string) and "enabled" (boolean)' }, { status: 400 });
  }
  toggleAccount(body.accountId, body.enabled);
  return NextResponse.json({ accounts: getPoolStatus() });
}
