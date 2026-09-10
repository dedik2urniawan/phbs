import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      tahun, 
      wilayah, 
      cakupanPersen, 
      totalKK, 
      targetSasaranKK, 
      iks, 
      sehatKK, 
      bottleneckIndikator, 
      bottleneckFailure, 
      radarData,
      rentanData 
    } = body

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_API_KEY belum dikonfigurasi di server environment.'
      }, { status: 500 })
    }

    const systemInstruction = `Anda adalah PHBS Strategic Health Policy Advisor dari Dinas Kesehatan Kabupaten Malang.
Tugas Anda adalah menyusun Laporan Ringkas & Rekomendasi Eksekutif Berbasis AI untuk Pimpinan Dinas Kesehatan dan Kepala Puskesmas berdasarkan data survei PHBS (Perilaku Hidup Bersih dan Sehat) tahun ${tahun}.

Analisis harus tajam, solutif, berbasis data nyata yang diberikan, serta menggunakan bahasa birokrasi pemerintahan kesehatan yang tegas, objektif, dan aplikatif.
Format output WAJIB dalam bentuk Markdown rapi dengan poin-poin terstruktur:
1. **Ringkasan Eksekutif (Executive Summary)**: Gambaran menyeluruh 2-3 kalimat mengenai pencapaian IKS dan cakupan wilayah.
2. **Temuan Kritis & Bottleneck Utama**: 2-3 poin sorotan utama (khususnya masalah rokok, jamban/air bersih, atau ASI eksklusif sesuai data).
3. **Rekomendasi Kebijakan Spesifik**: 3 langkah taktis intervensi kesehatan lingkungan & promotif-preventif.
4. **Strategi Pencegahan Hulu Stunting**: Rekomendasi spesifik kelompok rentan (Bumil & Remaja Putri TTD).`

    const userPrompt = `
Berikut ringkasan data capaian survei PHBS:
- **Tahun Evaluasi**: ${tahun}
- **Wilayah**: ${wilayah || 'Kabupaten Malang (Seluruh Puskesmas)'}
- **Cakupan Survei**: ${cakupanPersen}% (${totalKK?.toLocaleString('id-ID')} KK dari target ${targetSasaranKK?.toLocaleString('id-ID')} KK)
- **Indeks Keluarga Sehat (IKS)**: ${iks}% (${sehatKK?.toLocaleString('id-ID')} KK memenuhi kriteria Rumah Sehat)
- **Bottleneck Kegagalan Tertinggi**: ${bottleneckIndikator || 'Tidak Merokok'} (${bottleneckFailure || 0}% gagal pada keluarga tidak sehat)
- **Capaian Indikator Utama**:
${(radarData || []).map((r: any) => `  * ${r.subject}: ${r.A}%`).join('\n')}
- **Kelompok Rentan Hulu Stunting**:
  * Ibu Hamil Konsumsi TTD: ${rentanData?.bumilCapaian || 0}% (Target: ${rentanData?.bumilTarget || 90}%)
  * Remaja Putri Konsumsi TTD: ${rentanData?.remajaCapaian || 0}% (Target: ${rentanData?.remajaTarget || 90}%)

Susunlah narasi rekomendasi kebijakan eksekutif resmi untuk pimpinan!`

    const aiModel = 'gemini-3.6-flash'
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.85,
          maxOutputTokens: 1200,
        }
      })
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || 'Gagal menghubungi layanan Google Gemini AI.'
      console.error('[AI Dissemination] Gemini API Error:', errMsg)
      return NextResponse.json({
        success: false,
        error: errMsg
      }, { status: 502 })
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak ada teks yang dihasilkan AI.'
    return NextResponse.json({
      success: true,
      analysis: aiText
    })

  } catch (error: any) {
    console.error('[AI Dissemination] Error handler:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Terjadi kesalahan sistem internal.'
    }, { status: 500 })
  }
}
