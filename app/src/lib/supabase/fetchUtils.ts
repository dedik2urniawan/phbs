// Utility to fetch all rows bypassing Supabase's 1000 rows limit
export async function fetchAll<T>(query: any): Promise<T[]> {
  let allData: T[] = []
  let from = 0
  const limit = 1000
  let hasMore = true

  while (hasMore) {
    // .range is inclusive, so from 0 to 999 fetches 1000 rows
    const { data, error } = await query.range(from, from + limit - 1)
    
    if (error) {
      console.error("Error in fetchAll:", error)
      throw error
    }
    
    if (data && data.length > 0) {
      allData = allData.concat(data)
      from += limit
    }
    
    // If the data returned is less than the limit, we've reached the end
    if (!data || data.length < limit) {
      hasMore = false
    }
  }

  return allData
}
