CREATE OR REPLACE FUNCTION get_phbs_analytics(p_puskesmas_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  WITH filtered_surveys AS (
    SELECT s.*, h.puskesmas_id, h.desa_id
    FROM surveys s
    JOIN households h ON s.household_id = h.id
    WHERE (p_puskesmas_id IS NULL OR h.puskesmas_id = p_puskesmas_id)
  ),
  -- Hitung status Sehat per KK
  survey_status AS (
    SELECT 
      *,
      (
        COALESCE(i1_persalinan_nakes, true) AND 
        COALESCE(i2_asi_eksklusif, true) AND 
        COALESCE(i3_menimbang_balita, true) AND 
        i4_air_bersih AND 
        i5_cuci_tangan AND 
        i6_jamban_sehat AND 
        i7_psn AND 
        i8_makan_sayur_buah AND 
        i9_aktivitas_fisik AND 
        i10_tidak_merokok
      ) as is_sehat
    FROM filtered_surveys
  ),
  -- Agregasi Utama
  summary_stats AS (
    SELECT 
      COUNT(*) as total_surveys,
      COUNT(*) FILTER (WHERE is_sehat = true) as total_sehat,
      COUNT(*) FILTER (WHERE is_sehat = false) as total_tidak_sehat
    FROM survey_status
  ),
  -- Agregasi Radar (10 Indikator)
  radar_stats AS (
    SELECT 
      ROUND((COUNT(*) FILTER (WHERE COALESCE(i1_persalinan_nakes, true) = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i1_pct,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(i2_asi_eksklusif, true) = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i2_pct,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(i3_menimbang_balita, true) = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i3_pct,
      ROUND((COUNT(*) FILTER (WHERE i4_air_bersih = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i4_pct,
      ROUND((COUNT(*) FILTER (WHERE i5_cuci_tangan = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i5_pct,
      ROUND((COUNT(*) FILTER (WHERE i6_jamban_sehat = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i6_pct,
      ROUND((COUNT(*) FILTER (WHERE i7_psn = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i7_pct,
      ROUND((COUNT(*) FILTER (WHERE i8_makan_sayur_buah = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i8_pct,
      ROUND((COUNT(*) FILTER (WHERE i9_aktivitas_fisik = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i9_pct,
      ROUND((COUNT(*) FILTER (WHERE i10_tidak_merokok = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as i10_pct
    FROM survey_status
  ),
  -- Agregasi Pareto (Kegagalan pada KK Tidak Sehat)
  pareto_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE COALESCE(i1_persalinan_nakes, true) = false) as f_i1,
      COUNT(*) FILTER (WHERE COALESCE(i2_asi_eksklusif, true) = false) as f_i2,
      COUNT(*) FILTER (WHERE COALESCE(i3_menimbang_balita, true) = false) as f_i3,
      COUNT(*) FILTER (WHERE i4_air_bersih = false) as f_i4,
      COUNT(*) FILTER (WHERE i5_cuci_tangan = false) as f_i5,
      COUNT(*) FILTER (WHERE i6_jamban_sehat = false) as f_i6,
      COUNT(*) FILTER (WHERE i7_psn = false) as f_i7,
      COUNT(*) FILTER (WHERE i8_makan_sayur_buah = false) as f_i8,
      COUNT(*) FILTER (WHERE i9_aktivitas_fisik = false) as f_i9,
      COUNT(*) FILTER (WHERE i10_tidak_merokok = false) as f_i10
    FROM survey_status
    WHERE is_sehat = false
  ),
  -- Kelompok Rentan (TTD)
  rentan_stats AS (
    SELECT
      ROUND((COUNT(*) FILTER (WHERE i15_ibu_hamil_ttd = true)::numeric / NULLIF(COUNT(*) FILTER (WHERE i14_ibu_hamil = true), 0)) * 100, 1) as bumil_capaian,
      ROUND((COUNT(*) FILTER (WHERE i17_remaja_putri_ttd = true)::numeric / NULLIF(COUNT(*) FILTER (WHERE i16_remaja_putri = true), 0)) * 100, 1) as remaja_capaian
    FROM survey_status
  ),
  -- Germas per Desa
  germas_desa AS (
    SELECT 
      d.desa_kel as name,
      ROUND((COUNT(*) FILTER (WHERE s.i12_kunjungan_posyandu = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as "Posyandu",
      ROUND((COUNT(*) FILTER (WHERE s.i11_cek_kesehatan = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as "CKG"
    FROM survey_status s
    JOIN ref_desa d ON s.desa_id = d.id
    GROUP BY d.id, d.desa_kel
    ORDER BY d.desa_kel
    LIMIT 10
  ),
  -- Matriks Korelasi (Root Cause Analysis)
  correlation_stats AS (
    SELECT
      json_build_array(
        json_build_object('ind1', 'Merokok', 'ind2', 'Sayur/Buah', 'value', COALESCE(ROUND(corr(i10_tidak_merokok::int, i8_makan_sayur_buah::int)::numeric, 2), 0)),
        json_build_object('ind1', 'Merokok', 'ind2', 'Aktivitas', 'value', COALESCE(ROUND(corr(i10_tidak_merokok::int, i9_aktivitas_fisik::int)::numeric, 2), 0)),
        json_build_object('ind1', 'Sayur/Buah', 'ind2', 'Aktivitas', 'value', COALESCE(ROUND(corr(i8_makan_sayur_buah::int, i9_aktivitas_fisik::int)::numeric, 2), 0)),
        json_build_object('ind1', 'CTPS', 'ind2', 'Jamban', 'value', COALESCE(ROUND(corr(i5_cuci_tangan::int, i6_jamban_sehat::int)::numeric, 2), 0)),
        json_build_object('ind1', 'CTPS', 'ind2', 'Air Bersih', 'value', COALESCE(ROUND(corr(i5_cuci_tangan::int, i4_air_bersih::int)::numeric, 2), 0)),
        json_build_object('ind1', 'Jentik', 'ind2', 'Jamban', 'value', COALESCE(ROUND(corr(i7_psn::int, i6_jamban_sehat::int)::numeric, 2), 0))
      ) as matrix
    FROM survey_status
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
      SELECT COALESCE(json_agg(row_to_json(germas_desa)), '[]'::json) FROM germas_desa
    ),
    'correlation_matrix', (SELECT matrix FROM correlation_stats)
  ) INTO result;

  RETURN result;
END;
$$;
