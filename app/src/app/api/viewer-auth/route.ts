import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'phbs_viewer_auth'

function getExpectedCode(): string {
  return (process.env.VIEWER_ACCESS_CODE || 'PHBS2026').trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const code = String(body?.code || '').trim()

    if (!code || code !== getExpectedCode()) {
      return NextResponse.json(
        { ok: false, message: 'Kode akses tidak valid. Silakan periksa kembali.' },
        { status: 401 }
      )
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, 'verified:' + Buffer.from(code).toString('base64'), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    })
    return res
  } catch {
    return NextResponse.json({ ok: false, message: 'Permintaan tidak valid' }, { status: 400 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
