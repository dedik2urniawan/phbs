import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fqkobmcymxfexmrmdwkr.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxa29ibWN5bXhmZXhtcm1kd2tyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzY2MDMxNCwiZXhwIjoyMDkzMjM2MzE0fQ.hCLl_IqsrvfqI4HDIoPBPj5s0NMVN66ymWS4L1wzlGU'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function resetPassword() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    '76d9b3ec-f750-4280-a4d5-e9949ce0abb5',
    { password: 'Password123!' }
  )

  if (error) {
    console.error('Error resetting password:', error)
  } else {
    console.log('Password reset successfully for pkmturen@dinkes.go.id')
  }
}

resetPassword()
