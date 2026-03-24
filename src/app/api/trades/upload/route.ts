import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('screenshot') as File;
    const tradeId = formData.get('tradeId') as string;

    if (!file || !tradeId) {
      return NextResponse.json({ error: 'File and tradeId required' }, { status: 400 });
    }

    const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'Only image files allowed (png, jpg, jpeg, webp, gif)' }, { status: 400 });
    }

    const fileName = `${tradeId}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'trade-screenshots');
    const filePath = path.join(uploadDir, fileName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const screenshotUrl = `/uploads/trade-screenshots/${fileName}`;

    await prisma.trade.update({
      where: { id: tradeId },
      data: { screenshotUrl },
    });

    return NextResponse.json({ success: true, screenshotUrl });
  } catch (error) {
    console.error('Screenshot upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
