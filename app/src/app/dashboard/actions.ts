'use server'

import { getCachedRespondentStats, getCachedDashboardAggregates, getCachedRekapSurveys } from '@/lib/data/dashboard'
import { createClient } from '@supabase/supabase-js'

const getServiceSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function getRespondentStatsAction(tahun: number, puskesmasId: string | null) {
  try {
    return await getCachedRespondentStats(tahun, puskesmasId)
  } catch (error) {
    console.error('Failed to fetch respondent stats:', error)
    return []
  }
}

export async function getPuskesmasAggregatesAction(tahun: number, puskesmasId: string | null) {
  try {
    return await getCachedDashboardAggregates(tahun, puskesmasId)
  } catch (error) {
    console.error('Failed to fetch puskesmas aggregates:', error)
    return null
  }
}

export async function getPuskesmasRekapSurveysAction(tahun: number, puskesmasId: string) {
  try {
    return await getCachedRekapSurveys(tahun, puskesmasId)
  } catch (error) {
    console.error('Failed to fetch puskesmas rekap surveys:', error)
    return []
  }
}

export async function getSurveyArtResponsesAction(surveyId: string) {
  try {
    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('survey_art_responses')
      .select('*, family_members(id, nama, nik, hubungan_kk, jenis_kelamin)')
      .eq('survey_id', surveyId)
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to fetch survey art responses:', error)
    return []
  }
}

