import { redirect } from 'next/navigation'
import DashboardLayoutWrapper from '@/components/DashboardLayoutWrapper'
import { getServerAppUser } from '@/lib/data/serverAuth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const appUser = await getServerAppUser()
  if (!appUser) redirect('/login?mode=admin')

  return (
    <DashboardLayoutWrapper user={appUser as any}>
      {children}
    </DashboardLayoutWrapper>
  )
}
