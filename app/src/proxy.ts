import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isOfflineMode(): boolean {
  if (process.env.OFFLINE_SNAPSHOT_MODE === 'true') return true
  if (process.env.NEXT_PUBLIC_OFFLINE_SNAPSHOT_MODE === 'true') return true
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return true
  }
  return false
}

function hasValidViewerCookie(request: NextRequest): boolean {
  const cookie = request.cookies.get('phbs_viewer_auth')?.value
  if (!cookie || !cookie.startsWith('verified:')) return false
  const expectedCode = (process.env.VIEWER_ACCESS_CODE || 'PHBS2026').trim()
  const expectedToken = 'verified:' + btoa(expectedCode)
  return cookie === expectedToken
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isOfflineMode()) {
    const isPublicOffline =
      pathname === '/' ||
      pathname.startsWith('/viewer-login') ||
      pathname.startsWith('/api/viewer-auth') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/data') ||
      pathname.includes('.')

    const isAuthed = hasValidViewerCookie(request)

    if (pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = isAuthed ? '/dashboard/reports/analysis' : '/viewer-login'
      url.search = ''
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/viewer-login') && isAuthed) {
      const next = request.nextUrl.searchParams.get('next') || '/dashboard/reports/analysis'
      const url = request.nextUrl.clone()
      url.pathname = next
      url.search = ''
      return NextResponse.redirect(url)
    }

    if (!isAuthed && !isPublicOffline) {
      const url = request.nextUrl.clone()
      url.pathname = '/viewer-login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  // Halaman publik — tidak perlu auth
  const isPublic = pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    // Deteksi apakah request dari /entry → redirect ke login?mode=pwa
    url.pathname = '/login'
    url.searchParams.set('mode', pathname.startsWith('/entry') ? 'pwa' : 'admin')
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Sudah login + akses /login → redirect ke tujuan sesuai role
  if (user && pathname.startsWith('/login')) {
    const mode = request.nextUrl.searchParams.get('mode')
    const next = request.nextUrl.searchParams.get('next')
    const url = request.nextUrl.clone()
    url.pathname = next || (mode === 'pwa' ? '/entry' : '/dashboard')
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
