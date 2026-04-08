/**
 * GET  /api/signals/settings  — fetch current source enable/disable state
 * PATCH /api/signals/settings  — update one or both source toggles
 *
 * Body (PATCH):
 * { "ccc_engine_enabled": true, "webhook_enabled": false }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

async function getOrCreateSettings() {
  const existing = await prisma.signalSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.signalSettings.create({
    data: { id: 1, ccc_engine_enabled: true, webhook_enabled: true },
  });
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();
    return NextResponse.json({
      ccc_engine_enabled: settings.ccc_engine_enabled,
      webhook_enabled:    settings.webhook_enabled,
    });
  } catch (err) {
    console.error('[SignalSettings] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      ccc_engine_enabled?: boolean;
      webhook_enabled?: boolean;
    };

    const data: { ccc_engine_enabled?: boolean; webhook_enabled?: boolean } = {};
    if (typeof body.ccc_engine_enabled === 'boolean') data.ccc_engine_enabled = body.ccc_engine_enabled;
    if (typeof body.webhook_enabled    === 'boolean') data.webhook_enabled    = body.webhook_enabled;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'Provide ccc_engine_enabled and/or webhook_enabled (boolean)' },
        { status: 400 }
      );
    }

    // Upsert — safe even if the table row doesn't exist yet
    const updated = await prisma.signalSettings.upsert({
      where:  { id: 1 },
      update: data,
      create: { id: 1, ccc_engine_enabled: true, webhook_enabled: true, ...data },
    });

    console.log(
      `[SignalSettings] Updated: ccc_engine=${updated.ccc_engine_enabled} webhook=${updated.webhook_enabled}`
    );

    return NextResponse.json({
      ccc_engine_enabled: updated.ccc_engine_enabled,
      webhook_enabled:    updated.webhook_enabled,
    });
  } catch (err) {
    console.error('[SignalSettings] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
