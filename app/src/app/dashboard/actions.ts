'use server'

import { getCachedRespondentStats, getCachedDashboardAggregates } from '@/lib/data/dashboard'

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
