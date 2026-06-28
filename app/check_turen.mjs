import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fqkobmcymxfexmrmdwkr.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxa29ibWN5bXhmZXhtcm1kd2tyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzY2MDMxNCwiZXhwIjoyMDkzMjM2MzE0fQ.hCLl_IqsrvfqI4HDIoPBPj5s0NMVN66ymWS4L1wzlGU'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkUser() {
  console.log('Fetching users...')
  const { data, error } = await supabase.auth.admin.listUsers()
  
  if (error) {
    console.error('Error fetching users:', error)
    return
  }

  const user = data.users.find(u => u.email === 'pkmturen@dinkes.go.id')
  
  if (!user) {
    console.log('User pkmturen@dinkes.go.id NOT FOUND in auth.users!')
    return
  }

  console.log('User Found:')
  console.log(`- ID: ${user.id}`)
  console.log(`- Email: ${user.email}`)
  console.log(`- Last Sign In: ${user.last_sign_in_at}`)
  console.log(`- Created At: ${user.created_at}`)
  console.log(`- Is Banned?: ${user.banned_until ? 'Yes, until ' + user.banned_until : 'No'}`)
  
  // Check the app_users table
  const { data: appUser, error: appUserError } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(nama)')
    .eq('id', user.id)
    .single()
    
  if (appUserError) {
    console.log('Error fetching app_users:', appUserError.message)
  } else {
    console.log('App User Details:', appUser)
  }
}

checkUser()
