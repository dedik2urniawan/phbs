-- =========================================================
-- PATCH 027: FAST DASHBOARD & ANALYTICS AGGREGATES
-- Optimasi Skala Penuh (230k+ Survei & 247k+ KK)
-- Menyediakan RPC Agregasi Instan (< 100ms) untuk Superadmin & Admin Puskesmas
-- =========================================================

BEGIN;

-- 1. Index Optimasi untuk Agregasi Cepat
CREATE INDEX IF NOT EXISTS idx_surveys_tahun_is_rt_sehat ON public.surveys (tahun, is_rt_sehat);
CREATE INDEX IF NOT EXISTS idx_surveys_hh_tahun ON public.surveys (household_id, tahun);
CREATE INDEX IF NOT EXISTS idx_households_pkm_desa ON public.households (puskesmas_id, desa_id);

-- 2. RPC: get_dashboard_aggregates
CREATE OR REPLACE FUNCTION public.get_dashboard_aggregates(
    p_tahun int DEFAULT 2026,
    p_puskesmas_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    WITH base_surveys AS (
        SELECT 
            s.id,
            s.is_rt_sehat,
            s.skor_phbs,
            s.denominator_phbs,
            s.i1_persalinan_nakes,
            s.i2_asi_eksklusif,
            s.i3_menimbang_balita,
            s.i4_air_bersih,
            s.i5_cuci_tangan,
            s.i6_jamban_sehat,
            s.i7_psn,
            s.i8_makan_sayur_buah,
            s.i9_aktivitas_fisik,
            s.i10_tidak_merokok,
            s.i11_cek_kesehatan,
            s.i12_kunjungan_posyandu,
            s.i14_ibu_hamil,
            s.i15_ibu_hamil_ttd,
            s.i16_remaja_putri,
            s.i17_remaja_putri_ttd,
            s.kader_id,
            h.puskesmas_id,
            h.desa_id
        FROM public.surveys s
        JOIN public.households h ON s.household_id = h.id
        WHERE (p_tahun IS NULL OR s.tahun = p_tahun)
          AND (p_puskesmas_id IS NULL OR h.puskesmas_id = p_puskesmas_id)
    ),
    base_hh AS (
        SELECT 
            h.id,
            h.puskesmas_id,
            h.desa_id
        FROM public.households h
        WHERE (p_puskesmas_id IS NULL OR h.puskesmas_id = p_puskesmas_id)
    ),
    pkm_agg AS (
        SELECT 
            p.id as puskesmas_id,
            p.nama as puskesmas_nama,
            (SELECT COUNT(*) FROM base_hh bh WHERE bh.puskesmas_id = p.id) as total_kk,
            COUNT(bs.id) as total_disurvei,
            COUNT(bs.id) FILTER (WHERE bs.is_rt_sehat = true) as total_sehat,
            COUNT(bs.id) FILTER (WHERE bs.is_rt_sehat = false) as total_tidak_sehat,
            COUNT(bs.id) FILTER (WHERE bs.i1_persalinan_nakes = true) as i1_num,
            COUNT(bs.id) FILTER (WHERE bs.i1_persalinan_nakes IS NOT NULL) as i1_den,
            COUNT(bs.id) FILTER (WHERE bs.i2_asi_eksklusif = true) as i2_num,
            COUNT(bs.id) FILTER (WHERE bs.i2_asi_eksklusif IS NOT NULL) as i2_den,
            COUNT(bs.id) FILTER (WHERE bs.i3_menimbang_balita = true) as i3_num,
            COUNT(bs.id) FILTER (WHERE bs.i3_menimbang_balita IS NOT NULL) as i3_den,
            COUNT(bs.id) FILTER (WHERE bs.i4_air_bersih = true) as i4_num,
            COUNT(bs.id) FILTER (WHERE bs.i4_air_bersih IS NOT NULL) as i4_den,
            COUNT(bs.id) FILTER (WHERE bs.i5_cuci_tangan = true) as i5_num,
            COUNT(bs.id) FILTER (WHERE bs.i5_cuci_tangan IS NOT NULL) as i5_den,
            COUNT(bs.id) FILTER (WHERE bs.i6_jamban_sehat = true) as i6_num,
            COUNT(bs.id) FILTER (WHERE bs.i6_jamban_sehat IS NOT NULL) as i6_den,
            COUNT(bs.id) FILTER (WHERE bs.i7_psn = true) as i7_num,
            COUNT(bs.id) FILTER (WHERE bs.i7_psn IS NOT NULL) as i7_den,
            COUNT(bs.id) FILTER (WHERE bs.i8_makan_sayur_buah = true) as i8_num,
            COUNT(bs.id) FILTER (WHERE bs.i8_makan_sayur_buah IS NOT NULL) as i8_den,
            COUNT(bs.id) FILTER (WHERE bs.i9_aktivitas_fisik = true) as i9_num,
            COUNT(bs.id) FILTER (WHERE bs.i9_aktivitas_fisik IS NOT NULL) as i9_den,
            COUNT(bs.id) FILTER (WHERE bs.i10_tidak_merokok = true) as i10_num,
            COUNT(bs.id) FILTER (WHERE bs.i10_tidak_merokok IS NOT NULL) as i10_den,
            COUNT(bs.id) FILTER (WHERE bs.i11_cek_kesehatan = true) as i11_num,
            COUNT(bs.id) FILTER (WHERE bs.i12_kunjungan_posyandu = true) as i12_num,
            COUNT(bs.id) FILTER (WHERE bs.i14_ibu_hamil = true) as i14_num,
            COUNT(bs.id) FILTER (WHERE bs.i15_ibu_hamil_ttd = true) as i15_num,
            COUNT(bs.id) FILTER (WHERE bs.i16_remaja_putri = true) as i16_num,
            COUNT(bs.id) FILTER (WHERE bs.i17_remaja_putri_ttd = true) as i17_num
        FROM public.ref_puskesmas p
        LEFT JOIN base_surveys bs ON bs.puskesmas_id = p.id
        WHERE (p_puskesmas_id IS NULL OR p.id = p_puskesmas_id)
        GROUP BY p.id, p.nama
    ),
    desa_agg AS (
        SELECT 
            d.id as desa_id,
            d.desa_kel as desa_nama,
            d.puskesmas_id,
            (SELECT COUNT(*) FROM base_hh bh WHERE bh.desa_id = d.id) as total_kk,
            COUNT(bs.id) as total_disurvei,
            COUNT(bs.id) FILTER (WHERE bs.is_rt_sehat = true) as total_sehat,
            COUNT(bs.id) FILTER (WHERE bs.is_rt_sehat = false) as total_tidak_sehat,
            COUNT(bs.id) FILTER (WHERE bs.i1_persalinan_nakes = true) as i1_num,
            COUNT(bs.id) FILTER (WHERE bs.i1_persalinan_nakes IS NOT NULL) as i1_den,
            COUNT(bs.id) FILTER (WHERE bs.i2_asi_eksklusif = true) as i2_num,
            COUNT(bs.id) FILTER (WHERE bs.i2_asi_eksklusif IS NOT NULL) as i2_den,
            COUNT(bs.id) FILTER (WHERE bs.i3_menimbang_balita = true) as i3_num,
            COUNT(bs.id) FILTER (WHERE bs.i3_menimbang_balita IS NOT NULL) as i3_den,
            COUNT(bs.id) FILTER (WHERE bs.i4_air_bersih = true) as i4_num,
            COUNT(bs.id) FILTER (WHERE bs.i4_air_bersih IS NOT NULL) as i4_den,
            COUNT(bs.id) FILTER (WHERE bs.i5_cuci_tangan = true) as i5_num,
            COUNT(bs.id) FILTER (WHERE bs.i5_cuci_tangan IS NOT NULL) as i5_den,
            COUNT(bs.id) FILTER (WHERE bs.i6_jamban_sehat = true) as i6_num,
            COUNT(bs.id) FILTER (WHERE bs.i6_jamban_sehat IS NOT NULL) as i6_den,
            COUNT(bs.id) FILTER (WHERE bs.i7_psn = true) as i7_num,
            COUNT(bs.id) FILTER (WHERE bs.i7_psn IS NOT NULL) as i7_den,
            COUNT(bs.id) FILTER (WHERE bs.i8_makan_sayur_buah = true) as i8_num,
            COUNT(bs.id) FILTER (WHERE bs.i8_makan_sayur_buah IS NOT NULL) as i8_den,
            COUNT(bs.id) FILTER (WHERE bs.i9_aktivitas_fisik = true) as i9_num,
            COUNT(bs.id) FILTER (WHERE bs.i9_aktivitas_fisik IS NOT NULL) as i9_den,
            COUNT(bs.id) FILTER (WHERE bs.i10_tidak_merokok = true) as i10_num,
            COUNT(bs.id) FILTER (WHERE bs.i10_tidak_merokok IS NOT NULL) as i10_den,
            COUNT(bs.id) FILTER (WHERE bs.i11_cek_kesehatan = true) as i11_num,
            COUNT(bs.id) FILTER (WHERE bs.i12_kunjungan_posyandu = true) as i12_num,
            COUNT(bs.id) FILTER (WHERE bs.i14_ibu_hamil = true) as i14_num,
            COUNT(bs.id) FILTER (WHERE bs.i15_ibu_hamil_ttd = true) as i15_num,
            COUNT(bs.id) FILTER (WHERE bs.i16_remaja_putri = true) as i16_num,
            COUNT(bs.id) FILTER (WHERE bs.i17_remaja_putri_ttd = true) as i17_num
        FROM public.ref_desa d
        LEFT JOIN base_surveys bs ON bs.desa_id = d.id
        WHERE (p_puskesmas_id IS NULL OR d.puskesmas_id = p_puskesmas_id)
        GROUP BY d.id, d.desa_kel, d.puskesmas_id
    ),
    global_agg AS (
        SELECT 
            (SELECT COUNT(*) FROM base_hh) as total_kk,
            COUNT(*) as total_disurvei,
            COUNT(*) FILTER (WHERE is_rt_sehat = true) as total_sehat,
            COUNT(*) FILTER (WHERE is_rt_sehat = false) as total_tidak_sehat,
            COUNT(*) FILTER (WHERE i1_persalinan_nakes = true) as i1_num,
            COUNT(*) FILTER (WHERE i1_persalinan_nakes IS NOT NULL) as i1_den,
            COUNT(*) FILTER (WHERE i2_asi_eksklusif = true) as i2_num,
            COUNT(*) FILTER (WHERE i2_asi_eksklusif IS NOT NULL) as i2_den,
            COUNT(*) FILTER (WHERE i3_menimbang_balita = true) as i3_num,
            COUNT(*) FILTER (WHERE i3_menimbang_balita IS NOT NULL) as i3_den,
            COUNT(*) FILTER (WHERE i4_air_bersih = true) as i4_num,
            COUNT(*) FILTER (WHERE i4_air_bersih IS NOT NULL) as i4_den,
            COUNT(*) FILTER (WHERE i5_cuci_tangan = true) as i5_num,
            COUNT(*) FILTER (WHERE i5_cuci_tangan IS NOT NULL) as i5_den,
            COUNT(*) FILTER (WHERE i6_jamban_sehat = true) as i6_num,
            COUNT(*) FILTER (WHERE i6_jamban_sehat IS NOT NULL) as i6_den,
            COUNT(*) FILTER (WHERE i7_psn = true) as i7_num,
            COUNT(*) FILTER (WHERE i7_psn IS NOT NULL) as i7_den,
            COUNT(*) FILTER (WHERE i8_makan_sayur_buah = true) as i8_num,
            COUNT(*) FILTER (WHERE i8_makan_sayur_buah IS NOT NULL) as i8_den,
            COUNT(*) FILTER (WHERE i9_aktivitas_fisik = true) as i9_num,
            COUNT(*) FILTER (WHERE i9_aktivitas_fisik IS NOT NULL) as i9_den,
            COUNT(*) FILTER (WHERE i10_tidak_merokok = true) as i10_num,
            COUNT(*) FILTER (WHERE i10_tidak_merokok IS NOT NULL) as i10_den,
            COUNT(*) FILTER (WHERE i11_cek_kesehatan = true) as i11_num,
            COUNT(*) FILTER (WHERE i12_kunjungan_posyandu = true) as i12_num,
            COUNT(*) FILTER (WHERE i14_ibu_hamil = true) as i14_num,
            COUNT(*) FILTER (WHERE i15_ibu_hamil_ttd = true) as i15_num,
            COUNT(*) FILTER (WHERE i16_remaja_putri = true) as i16_num,
            COUNT(*) FILTER (WHERE i17_remaja_putri_ttd = true) as i17_num
        FROM base_surveys
    ),
    top_kader AS (
        SELECT 
            k.id,
            k.nama_kader,
            k.puskesmas_id,
            p.nama as puskesmas_nama,
            COUNT(bs.id) as total_survei
        FROM base_surveys bs
        JOIN public.kader_phbs k ON bs.kader_id = k.id
        LEFT JOIN public.ref_puskesmas p ON k.puskesmas_id = p.id
        GROUP BY k.id, k.nama_kader, k.puskesmas_id, p.nama
        ORDER BY total_survei DESC
        LIMIT 20
    )
    SELECT json_build_object(
        'tahun', p_tahun,
        'puskesmas_id_filter', p_puskesmas_id,
        'global', (SELECT row_to_json(g) FROM global_agg g),
        'by_puskesmas', (SELECT json_agg(row_to_json(p)) FROM pkm_agg p),
        'by_desa', (SELECT json_agg(row_to_json(d)) FROM desa_agg d),
        'top_kader', (SELECT json_agg(row_to_json(tk)) FROM top_kader tk)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 3. RPC: get_phbs_analytics (Refactored)
CREATE OR REPLACE FUNCTION public.get_phbs_analytics(
    p_puskesmas_id uuid DEFAULT NULL,
    p_tahun int DEFAULT 2026
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    WITH filtered_surveys AS (
        SELECT 
            s.id,
            s.is_rt_sehat,
            COALESCE(s.i1_persalinan_nakes, true) as i1_val,
            COALESCE(s.i2_asi_eksklusif, true) as i2_val,
            COALESCE(s.i3_menimbang_balita, true) as i3_val,
            s.i4_air_bersih,
            s.i5_cuci_tangan,
            s.i6_jamban_sehat,
            s.i7_psn,
            s.i8_makan_sayur_buah,
            s.i9_aktivitas_fisik,
            s.i10_tidak_merokok,
            s.i11_cek_kesehatan,
            s.i12_kunjungan_posyandu,
            s.i14_ibu_hamil,
            s.i15_ibu_hamil_ttd,
            s.i16_remaja_putri,
            s.i17_remaja_putri_ttd,
            h.puskesmas_id,
            h.desa_id,
            d.desa_kel
        FROM public.surveys s
        JOIN public.households h ON s.household_id = h.id
        LEFT JOIN public.ref_desa d ON h.desa_id = d.id
        WHERE (p_tahun IS NULL OR s.tahun = p_tahun)
          AND (p_puskesmas_id IS NULL OR h.puskesmas_id = p_puskesmas_id)
    ),
    summary_stats AS (
        SELECT 
            COUNT(*) as total_surveys,
            COUNT(*) FILTER (WHERE is_rt_sehat = true) as total_sehat,
            COUNT(*) FILTER (WHERE is_rt_sehat = false) as total_tidak_sehat
        FROM filtered_surveys
    ),
    radar_stats AS (
        SELECT 
            ROUND((COUNT(*) FILTER (WHERE i1_val = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i1_pct,
            ROUND((COUNT(*) FILTER (WHERE i2_val = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i2_pct,
            ROUND((COUNT(*) FILTER (WHERE i3_val = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i3_pct,
            ROUND((COUNT(*) FILTER (WHERE i4_air_bersih = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i4_pct,
            ROUND((COUNT(*) FILTER (WHERE i5_cuci_tangan = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i5_pct,
            ROUND((COUNT(*) FILTER (WHERE i6_jamban_sehat = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i6_pct,
            ROUND((COUNT(*) FILTER (WHERE i7_psn = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i7_pct,
            ROUND((COUNT(*) FILTER (WHERE i8_makan_sayur_buah = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i8_pct,
            ROUND((COUNT(*) FILTER (WHERE i9_aktivitas_fisik = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i9_pct,
            ROUND((COUNT(*) FILTER (WHERE i10_tidak_merokok = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i10_pct
        FROM filtered_surveys
    ),
    pareto_stats AS (
        SELECT 
            COUNT(*) FILTER (WHERE i1_val = false) as f_i1,
            COUNT(*) FILTER (WHERE i2_val = false) as f_i2,
            COUNT(*) FILTER (WHERE i3_val = false) as f_i3,
            COUNT(*) FILTER (WHERE i4_air_bersih = false) as f_i4,
            COUNT(*) FILTER (WHERE i5_cuci_tangan = false) as f_i5,
            COUNT(*) FILTER (WHERE i6_jamban_sehat = false) as f_i6,
            COUNT(*) FILTER (WHERE i7_psn = false) as f_i7,
            COUNT(*) FILTER (WHERE i8_makan_sayur_buah = false) as f_i8,
            COUNT(*) FILTER (WHERE i9_aktivitas_fisik = false) as f_i9,
            COUNT(*) FILTER (WHERE i10_tidak_merokok = false) as f_i10
        FROM filtered_surveys
        WHERE is_rt_sehat = false
    ),
    rentan_stats AS (
        SELECT
            ROUND((COUNT(*) FILTER (WHERE i15_ibu_hamil_ttd = true)::numeric / NULLIF(COUNT(*) FILTER (WHERE i14_ibu_hamil = true), 0)) * 100, 1) as bumil_capaian,
            ROUND((COUNT(*) FILTER (WHERE i17_remaja_putri_ttd = true)::numeric / NULLIF(COUNT(*) FILTER (WHERE i16_remaja_putri = true), 0)) * 100, 1) as remaja_capaian
        FROM filtered_surveys
    ),
    germas_wilayah AS (
        SELECT 
            COALESCE(desa_kel, 'Wilayah') as name,
            ROUND((COUNT(*) FILTER (WHERE i12_kunjungan_posyandu = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as "Posyandu",
            ROUND((COUNT(*) FILTER (WHERE i11_cek_kesehatan = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as "CKG"
        FROM filtered_surveys
        GROUP BY desa_id, desa_kel
        ORDER BY desa_kel
        LIMIT 15
    ),
    correlation_stats AS (
        SELECT
            json_build_array(
                json_build_object('ind1', 'Merokok', 'ind2', 'Sayur/Buah', 'value', COALESCE(ROUND(corr(CASE WHEN i10_tidak_merokok THEN 1 ELSE 0 END, CASE WHEN i8_makan_sayur_buah THEN 1 ELSE 0 END)::numeric, 2), 0)),
                json_build_object('ind1', 'Merokok', 'ind2', 'Aktivitas', 'value', COALESCE(ROUND(corr(CASE WHEN i10_tidak_merokok THEN 1 ELSE 0 END, CASE WHEN i9_aktivitas_fisik THEN 1 ELSE 0 END)::numeric, 2), 0)),
                json_build_object('ind1', 'Sayur/Buah', 'ind2', 'Aktivitas', 'value', COALESCE(ROUND(corr(CASE WHEN i8_makan_sayur_buah THEN 1 ELSE 0 END, CASE WHEN i9_aktivitas_fisik THEN 1 ELSE 0 END)::numeric, 2), 0)),
                json_build_object('ind1', 'CTPS', 'ind2', 'Jamban', 'value', COALESCE(ROUND(corr(CASE WHEN i5_cuci_tangan THEN 1 ELSE 0 END, CASE WHEN i6_jamban_sehat THEN 1 ELSE 0 END)::numeric, 2), 0)),
                json_build_object('ind1', 'CTPS', 'ind2', 'Air Bersih', 'value', COALESCE(ROUND(corr(CASE WHEN i5_cuci_tangan THEN 1 ELSE 0 END, CASE WHEN i4_air_bersih THEN 1 ELSE 0 END)::numeric, 2), 0)),
                json_build_object('ind1', 'Jentik', 'ind2', 'Jamban', 'value', COALESCE(ROUND(corr(CASE WHEN i7_psn THEN 1 ELSE 0 END, CASE WHEN i6_jamban_sehat THEN 1 ELSE 0 END)::numeric, 2), 0))
            ) as matrix
        FROM filtered_surveys
    )

    SELECT json_build_object(
        'total_surveys', (SELECT total_surveys FROM summary_stats),
        'total_sehat', (SELECT total_sehat FROM summary_stats),
        'total_tidak_sehat', (SELECT total_tidak_sehat FROM summary_stats),
        'iks_phbs', ROUND(((SELECT total_sehat FROM summary_stats)::numeric / NULLIF((SELECT total_surveys FROM summary_stats), 0)) * 100, 1),
        'radar_data', (
            SELECT json_build_array(
                json_build_object('subject', 'Persalinan Nakes', 'A', COALESCE(i1_pct, 0), 'fullMark', 100),
                json_build_object('subject', 'ASI Eksklusif', 'A', COALESCE(i2_pct, 0), 'fullMark', 100),
                json_build_object('subject', 'Timbang Balita', 'A', COALESCE(i3_pct, 0), 'fullMark', 100),
                json_build_object('subject', 'Air Bersih', 'A', COALESCE(i4_pct, 0), 'fullMark', 100),
                json_build_object('subject', 'Cuci Tangan', 'A', COALESCE(i5_pct, 0), 'fullMark', 100),
                json_build_object('subject', 'Jamban Sehat', 'A', COALESCE(i6_pct, 0), 'fullMark', 100),
                json_build_object('subject', 'Bebas Jentik', 'A', COALESCE(i7_pct, 0), 'fullMark', 100),
                json_build_object('subject', 'Sayur Buah', 'A', COALESCE(i8_pct, 0), 'fullMark', 100),
                json_build_object('subject', 'Aktivitas Fisik', 'A', COALESCE(i9_pct, 0), 'fullMark', 100),
                json_build_object('subject', 'Tidak Merokok', 'A', COALESCE(i10_pct, 0), 'fullMark', 100)
            ) FROM radar_stats
        ),
        'pareto_data', (
            SELECT json_build_array(
                json_build_object('name', 'Persalinan Nakes', 'failure', f_i1),
                json_build_object('name', 'ASI Eksklusif', 'failure', f_i2),
                json_build_object('name', 'Timbang Balita', 'failure', f_i3),
                json_build_object('name', 'Air Bersih', 'failure', f_i4),
                json_build_object('name', 'Cuci Tangan', 'failure', f_i5),
                json_build_object('name', 'Jamban Sehat', 'failure', f_i6),
                json_build_object('name', 'Bebas Jentik', 'failure', f_i7),
                json_build_object('name', 'Kurang Sayur Buah', 'failure', f_i8),
                json_build_object('name', 'Jarang Olahraga', 'failure', f_i9),
                json_build_object('name', 'Anggota Merokok', 'failure', f_i10)
            ) FROM pareto_stats
        ),
        'rentan_data', (
            SELECT json_build_object(
                'bumilTarget', 90,
                'bumilCapaian', COALESCE(bumil_capaian, 0),
                'remajaTarget', 90,
                'remajaCapaian', COALESCE(remaja_capaian, 0)
            ) FROM rentan_stats
        ),
        'germas_data', (
            SELECT COALESCE(json_agg(row_to_json(gw)), '[]'::json) FROM germas_wilayah gw
        ),
        'correlation_matrix', (SELECT matrix FROM correlation_stats)
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_aggregates(int, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_phbs_analytics(uuid, int) TO authenticated, service_role;

COMMIT;