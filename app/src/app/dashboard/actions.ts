'use server'

import { getCachedRespondentStats } from '@/lib/data/dashboard'

export async function getRespondentStatsAction(tahun: number, puskesmasId: string | null) {
  try {
    return await getCachedRespondentStats(tahun, puskesmasId)
  } catch (error) {
    console.error('Failed to fetch respondent stats:', error)
    return []
  }
}
