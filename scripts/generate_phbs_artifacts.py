"""
ETL & Generator Laporan PHBS Kabupaten Malang 2026
Membaca raw JSON backup Supabase (E:\\phbs26\\supabase-backup-2026-09-28)
dan menghasilkan:
  1. Rekap_PHBS_KabMalang_2026.xlsx (5 sheet terformat siap paparan)
  2. app/public/data/phbs-snapshot-2026.json (snapshot ringan untuk Dashboard Next.js)
"""

import json
import math
from collections import defaultdict
from pathlib import Path
import xlsxwriter

ROOT_DIR = Path(r"E:\phbs26")
BACKUP_DIR = ROOT_DIR / "supabase-backup-2026-09-28"
EXCEL_OUT = ROOT_DIR / "Rekap_PHBS_KabMalang_2026.xlsx"
SNAPSHOT_OUT = ROOT_DIR / "app" / "public" / "data" / "phbs-snapshot-2026.json"
AGE_SNAPSHOT_OUT = ROOT_DIR / "app" / "public" / "data" / "phbs-age-snapshot-2026.json"

AGE_GROUPS = [
    ("balita", "Balita (0-4 th)", 0, 4),
    ("anak", "Anak (5-11 th)", 5, 11),
    ("remaja", "Remaja (12-17 th)", 12, 17),
    ("dewasa", "Dewasa Muda (18-44 th)", 18, 44),
    ("pralansia", "Pra-Lansia (45-59 th)", 45, 59),
    ("lansia", "Lansia (60+ th)", 60, 120),
]

INDICATORS = [
    ("i1", "i1_persalinan_nakes", "1. Persalinan Nakes", True),
    ("i2", "i2_asi_eksklusif", "2. ASI Eksklusif", True),
    ("i3", "i3_menimbang_balita", "3. Menimbang Balita", True),
    ("i4", "i4_air_bersih", "4. Air Bersih", False),
    ("i5", "i5_cuci_tangan", "5. Cuci Tangan Sabun", False),
    ("i6", "i6_jamban_sehat", "6. Jamban Sehat", False),
    ("i7", "i7_psn", "7. Bebas Jentik (PSN)", False),
    ("i8", "i8_makan_sayur_buah", "8. Makan Sayur & Buah", False),
    ("i9", "i9_aktivitas_fisik", "9. Aktivitas Fisik", False),
    ("i10", "i10_tidak_merokok", "10. Tidak Merokok", False),
]

RADAR_LABELS = {
    "i1": "Persalinan Nakes",
    "i2": "ASI Eksklusif",
    "i3": "Timbang Balita",
    "i4": "Air Bersih",
    "i5": "Cuci Tangan",
    "i6": "Jamban Sehat",
    "i7": "Bebas Jentik",
    "i8": "Sayur Buah",
    "i9": "Aktivitas Fisik",
    "i10": "Tidak Merokok",
}

PARETO_LABELS = {
    "i1": "Persalinan Nakes",
    "i2": "ASI Eksklusif",
    "i3": "Timbang Balita",
    "i4": "Air Bersih",
    "i5": "Cuci Tangan",
    "i6": "Jamban Sehat",
    "i7": "Bebas Jentik",
    "i8": "Kurang Sayur Buah",
    "i9": "Jarang Olahraga",
    "i10": "Anggota Merokok",
}

CORR_PAIRS = [
    ("Merokok", "Sayur/Buah", "i10_tidak_merokok", "i8_makan_sayur_buah"),
    ("Merokok", "Aktivitas", "i10_tidak_merokok", "i9_aktivitas_fisik"),
    ("Sayur/Buah", "Aktivitas", "i8_makan_sayur_buah", "i9_aktivitas_fisik"),
    ("CTPS", "Jamban", "i5_cuci_tangan", "i6_jamban_sehat"),
    ("CTPS", "Air Bersih", "i5_cuci_tangan", "i4_air_bersih"),
    ("Jentik", "Jamban", "i7_psn", "i6_jamban_sehat"),
]


def load_json(name: str):
    path = BACKUP_DIR / name
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def new_bucket():
    b = {
        "total_kk": 0,
        "sasaran_kk": 0,
        "total_disurvei": 0,
        "total_sehat": 0,
        "total_tidak_sehat": 0,
        "i11_num": 0,
        "i12_num": 0,
        "i14_num": 0,
        "i15_num": 0,
        "i16_num": 0,
        "i17_num": 0,
    }
    for code, _, _, _ in INDICATORS:
        b[f"{code}_num"] = 0
        b[f"{code}_den"] = 0
        b[f"{code}_radar_num"] = 0
        b[f"{code}_fail"] = 0
    return b


def new_corr_accum():
    # For each pair: n, sx, sy, sxy (x and y are binary 0/1)
    return [[0, 0, 0, 0] for _ in CORR_PAIRS]


def update_corr_accum(acc, s):
    for idx, (_, _, k1, k2) in enumerate(CORR_PAIRS):
        v1 = s.get(k1)
        v2 = s.get(k2)
        if v1 is None or v2 is None:
            continue
        x = 1 if v1 else 0
        y = 1 if v2 else 0
        a = acc[idx]
        a[0] += 1
        a[1] += x
        a[2] += y
        a[3] += x * y


def finalize_corr(acc):
    matrix = []
    for idx, (l1, l2, _, _) in enumerate(CORR_PAIRS):
        n, sx, sy, sxy = acc[idx]
        val = 0.0
        if n >= 2:
            num = n * sxy - sx * sy
            den_sq = (n * sx - sx * sx) * (n * sy - sy * sy)
            if den_sq > 0:
                val = round(num / math.sqrt(den_sq), 2)
        matrix.append({"ind1": l1, "ind2": l2, "value": val})
    return matrix


def pct(num: int, den: int, decimals: int = 1) -> float:
    if not den:
        return 0.0
    return round((num / den) * 100.0, decimals)


def accumulate_survey(bucket, s):
    bucket["total_disurvei"] += 1
    is_sehat = s.get("is_rt_sehat")
    if is_sehat is True:
        bucket["total_sehat"] += 1
    elif is_sehat is False:
        bucket["total_tidak_sehat"] += 1

    for code, field, _, is_cond in INDICATORS:
        val = s.get(field)
        if val is True:
            bucket[f"{code}_num"] += 1
        if val is not None:
            bucket[f"{code}_den"] += 1

        # RPC get_phbs_analytics uses COALESCE(i1..i3, true) for radar & pareto
        eff = True if (is_cond and val is None) else bool(val)
        if eff:
            bucket[f"{code}_radar_num"] += 1
        elif is_sehat is False:
            bucket[f"{code}_fail"] += 1

    if s.get("i11_cek_kesehatan") is True:
        bucket["i11_num"] += 1
    if s.get("i12_kunjungan_posyandu") is True:
        bucket["i12_num"] += 1
    if s.get("i14_ibu_hamil") is True:
        bucket["i14_num"] += 1
    if s.get("i15_ibu_hamil_ttd") is True:
        bucket["i15_num"] += 1
    if s.get("i16_remaja_putri") is True:
        bucket["i16_num"] += 1
    if s.get("i17_remaja_putri_ttd") is True:
        bucket["i17_num"] += 1


def build_analytics(bucket, corr_acc, germas_desa_list):
    total = bucket["total_disurvei"]
    radar_data = [
        {
            "subject": RADAR_LABELS[code],
            "A": pct(bucket[f"{code}_radar_num"], total, 1),
            "applicablePct": pct(bucket[f"{code}_num"], bucket[f"{code}_den"], 1),
            "fullMark": 100,
        }
        for code, _, _, _ in INDICATORS
    ]
    pareto_data = [
        {
            "name": PARETO_LABELS[code],
            "failure": bucket[f"{code}_fail"],
        }
        for code, _, _, _ in INDICATORS
    ]
    return {
        "total_surveys": total,
        "total_sehat": bucket["total_sehat"],
        "total_tidak_sehat": bucket["total_tidak_sehat"],
        "iks_phbs": pct(bucket["total_sehat"], total, 1),
        "radar_data": radar_data,
        "pareto_data": pareto_data,
        "rentan_data": {
            "bumilTarget": 90,
            "bumilCapaian": pct(bucket["i15_num"], bucket["i14_num"], 1),
            "remajaTarget": 90,
            "remajaCapaian": pct(bucket["i17_num"], bucket["i16_num"], 1),
        },
        "germas_data": germas_desa_list,
        "correlation_matrix": finalize_corr(corr_acc),
    }


def new_age_bucket():
    return {
        "total": 0,
        "male": 0,
        "female": 0,
        "rt_sehat": 0,
        "i1_num": 0, "i1_den": 0,
        "i2_num": 0, "i2_den": 0,
        "i3_num": 0, "i3_den": 0,
        "i5_num": 0, "i5_den": 0,
        "i8_num": 0, "i8_den": 0,
        "i9_num": 0, "i9_den": 0,
        "i10_num": 0, "i10_den": 0,
        "i10_m_num": 0, "i10_m_den": 0,
        "ckg_num": 0, "ckg_den": 0,
        "pos_num": 0, "pos_den": 0,
        "bumil_num": 0, "bumil_ttd_num": 0,
        "rematri_ttd_num": 0, "rematri_ttd_den": 0,
    }


def new_age_group_map():
    return {key: new_age_bucket() for key, _, _, _ in AGE_GROUPS}


def classify_age_key(tgl_lahir: str):
    if not tgl_lahir or len(tgl_lahir) < 4:
        return None
    try:
        yr = int(tgl_lahir[:4])
        # Reference date: 2026-09-28
        mo = int(tgl_lahir[5:7]) if len(tgl_lahir) >= 7 else 1
        dy = int(tgl_lahir[8:10]) if len(tgl_lahir) >= 10 else 1
        age = 2026 - yr - (1 if (mo, dy) > (9, 28) else 0)
        if age < 0 or age > 120:
            return None
        for key, _, lo, hi in AGE_GROUPS:
            if lo <= age <= hi:
                return key
    except Exception:
        return None
    return None


def accumulate_art(b, art, gender: str, is_rt_sehat):
    b["total"] += 1
    if gender == "L":
        b["male"] += 1
    elif gender == "P":
        b["female"] += 1
    if is_rt_sehat is True:
        b["rt_sehat"] += 1

    for src, dst in [
        ("i1_persalinan_nakes", "i1"),
        ("i2_asi_eksklusif", "i2"),
        ("i3_menimbang_balita", "i3"),
        ("i5_cuci_tangan", "i5"),
        ("i8_makan_sayur_buah", "i8"),
        ("i9_aktivitas_fisik", "i9"),
        ("i10_tidak_merokok", "i10"),
        ("g_cek_kesehatan", "ckg"),
        ("g_posyandu_hadir", "pos"),
        ("g_remaja_putri_ttd", "rematri_ttd"),
    ]:
        val = art.get(src)
        if val is not None:
            b[f"{dst}_den"] += 1
            if val is True:
                b[f"{dst}_num"] += 1

    if gender == "L" and art.get("i10_tidak_merokok") is not None:
        b["i10_m_den"] += 1
        if art.get("i10_tidak_merokok") is True:
            b["i10_m_num"] += 1

    if art.get("g_ibu_hamil") is True:
        b["bumil_num"] += 1
        if art.get("g_ibu_hamil_ttd") is True:
            b["bumil_ttd_num"] += 1


def export_excel(
    global_b,
    pkm_rows,
    desa_rows,
    analytics_global,
    monthly_rows,
    sasaran_total,
    age_global,
    age_by_pkm,
):
    wb = xlsxwriter.Workbook(str(EXCEL_OUT))

    # Formats
    f_title = wb.add_format({"bold": True, "font_size": 14, "font_color": "#065F46"})
    f_sub = wb.add_format({"italic": True, "font_size": 10, "font_color": "#4B5563"})
    f_hdr = wb.add_format({
        "bold": True, "bg_color": "#065F46", "font_color": "#FFFFFF",
        "border": 1, "align": "center", "valign": "vcenter", "text_wrap": True, "font_size": 10
    })
    f_hdr_sub = wb.add_format({
        "bold": True, "bg_color": "#047857", "font_color": "#FFFFFF",
        "border": 1, "align": "center", "valign": "vcenter", "text_wrap": True, "font_size": 9
    })
    f_text = wb.add_format({"border": 1, "valign": "vcenter", "font_size": 10})
    f_int = wb.add_format({"border": 1, "num_format": "#,##0", "valign": "vcenter", "font_size": 10})
    f_pct = wb.add_format({"border": 1, "num_format": "0.0\"%\"", "valign": "vcenter", "font_size": 10})
    f_bold_text = wb.add_format({"bold": True, "border": 1, "bg_color": "#ECFDF5", "valign": "vcenter", "font_size": 10})
    f_bold_int = wb.add_format({"bold": True, "border": 1, "bg_color": "#ECFDF5", "num_format": "#,##0", "valign": "vcenter", "font_size": 10})
    f_bold_pct = wb.add_format({"bold": True, "border": 1, "bg_color": "#ECFDF5", "num_format": "0.0\"%\"", "valign": "vcenter", "font_size": 10})

    # ---------------------------------------------------------
    # SHEET 1: Ringkasan_Kabupaten
    # ---------------------------------------------------------
    ws1 = wb.add_worksheet("Ringkasan_Kabupaten")
    ws1.write("A1", "REKAPITULASI CAPAIAN PHBS & GERMAS KABUPATEN MALANG TAHUN 2026", f_title)
    ws1.write("A2", "Sumber: Backup Database SIM-PHBS (28 September 2026) | Metodologi: Applicable Denominator (Patch 027)", f_sub)

    ws1.write("A4", "Metrik Utama Kabupaten", f_hdr)
    ws1.write("B4", "Nilai", f_hdr)
    summary_pairs = [
        ("Total Puskesmas", len(pkm_rows), f_int),
        ("Total Desa / Kelurahan", len(desa_rows), f_int),
        ("Total Sasaran KK (2026)", sasaran_total, f_int),
        ("Total KK Terdata (Households)", global_b["total_kk"], f_int),
        ("Total KK Disurvei", global_b["total_disurvei"], f_int),
        ("Cakupan Survei vs Sasaran (%)", pct(global_b["total_disurvei"], sasaran_total, 1), f_pct),
        ("Rumah Tangga Sehat", global_b["total_sehat"], f_int),
        ("Rumah Tangga Tidak Sehat", global_b["total_tidak_sehat"], f_int),
        ("Indeks Keluarga Sehat (IKS-PHBS %)", pct(global_b["total_sehat"], global_b["total_disurvei"], 1), f_pct),
    ]
    for idx, (label, val, fmt) in enumerate(summary_pairs, start=5):
        ws1.write(f"A{idx}", label, f_text)
        ws1.write(f"B{idx}", val, fmt)

    ws1.write("A16", "Capaian 10 Indikator PHBS & Indikator Tambahan", f_hdr)
    ws1.write("B16", "Memenuhi (N)", f_hdr)
    ws1.write("C16", "Berlaku (D)", f_hdr)
    ws1.write("D16", "Capaian (%)", f_hdr)
    ws1.write("E16", "Catatan Denominator", f_hdr)

    row_i = 17
    for code, _, label, is_cond in INDICATORS:
        num = global_b[f"{code}_num"]
        den = global_b[f"{code}_den"]
        ws1.write(f"A{row_i}", label, f_text)
        ws1.write(f"B{row_i}", num, f_int)
        ws1.write(f"C{row_i}", den, f_int)
        ws1.write(f"D{row_i}", pct(num, den, 1), f_pct)
        ws1.write(f"E{row_i}", "Hanya KK dengan sasaran (IS NOT NULL)" if is_cond else "Seluruh KK disurvei", f_text)
        row_i += 1

    extra_rows = [
        ("GERMAS: Cek Kesehatan Gratis (CKG)", global_b["i11_num"], global_b["total_disurvei"], "Seluruh KK disurvei"),
        ("GERMAS: Kunjungan Posyandu", global_b["i12_num"], global_b["total_disurvei"], "Seluruh KK disurvei"),
        ("Rentan: Konsumsi TTD Ibu Hamil", global_b["i15_num"], global_b["i14_num"], "KK dengan Ibu Hamil (i14=true)"),
        ("Rentan: Konsumsi TTD Remaja Putri", global_b["i17_num"], global_b["i16_num"], "KK dengan Remaja Putri (i16=true)"),
    ]
    for label, num, den, note in extra_rows:
        ws1.write(f"A{row_i}", label, f_text)
        ws1.write(f"B{row_i}", num, f_int)
        ws1.write(f"C{row_i}", den, f_int)
        ws1.write(f"D{row_i}", pct(num, den, 1), f_pct)
        ws1.write(f"E{row_i}", note, f_text)
        row_i += 1

    ws1.set_column("A:A", 38)
    ws1.set_column("B:D", 16)
    ws1.set_column("E:E", 36)

    # ---------------------------------------------------------
    # HELPER for Puskesmas & Desa tables
    # ---------------------------------------------------------
    def write_rekap_sheet(ws, title, is_desa=False, rows=None):
        ws.write(0, 0, title, f_title)
        ws.write(1, 0, "Format: N = Memenuhi, D = Berlaku (Applicable), % = (N / D) x 100", f_sub)

        base_cols = (
            ["No", "Puskesmas", "Desa / Kelurahan", "Sasaran KK", "KK Terdata", "KK Disurvei", "Cakupan (%)", "RT Sehat", "RT Tidak Sehat", "IKS-PHBS (%)"]
            if is_desa
            else ["No", "Puskesmas", "Kecamatan", "Sasaran KK", "KK Terdata", "KK Disurvei", "Cakupan (%)", "RT Sehat", "RT Tidak Sehat", "IKS-PHBS (%)"]
        )

        # Row 3 & 4 headers
        for c_idx, col_name in enumerate(base_cols):
            ws.merge_range(3, c_idx, 4, c_idx, col_name, f_hdr)

        col = len(base_cols)
        for _, _, label, _ in INDICATORS:
            ws.merge_range(3, col, 3, col + 2, label, f_hdr)
            ws.write(4, col, "N", f_hdr_sub)
            ws.write(4, col + 1, "D", f_hdr_sub)
            ws.write(4, col + 2, "%", f_hdr_sub)
            col += 3

        extra_headers = [
            ("Posyandu (%)", "i12_num", "total_disurvei"),
            ("CKG (%)", "i11_num", "total_disurvei"),
            ("TTD Bumil (%)", "i15_num", "i14_num"),
            ("TTD Rematri (%)", "i17_num", "i16_num"),
        ]
        for h_label, _, _ in extra_headers:
            ws.merge_range(3, col, 4, col, h_label, f_hdr)
            col += 1

        ws.set_row(3, 24)
        ws.set_row(4, 20)
        ws.freeze_panes(5, 3 if is_desa else 2)

        r_idx = 5
        for i, item in enumerate(rows, start=1):
            b = item["bucket"]
            ws.write(r_idx, 0, i, f_int)
            if is_desa:
                ws.write(r_idx, 1, item["puskesmas_nama"], f_text)
                ws.write(r_idx, 2, item["desa_nama"], f_text)
            else:
                ws.write(r_idx, 1, item["puskesmas_nama"], f_text)
                ws.write(r_idx, 2, item["kecamatan"], f_text)

            ws.write(r_idx, 3, item["sasaran_kk"], f_int)
            ws.write(r_idx, 4, b["total_kk"], f_int)
            ws.write(r_idx, 5, b["total_disurvei"], f_int)
            ws.write(r_idx, 6, pct(b["total_disurvei"], item["sasaran_kk"], 1), f_pct)
            ws.write(r_idx, 7, b["total_sehat"], f_int)
            ws.write(r_idx, 8, b["total_tidak_sehat"], f_int)
            ws.write(r_idx, 9, pct(b["total_sehat"], b["total_disurvei"], 1), f_pct)

            c = 10
            for code, _, _, _ in INDICATORS:
                n = b[f"{code}_num"]
                d = b[f"{code}_den"]
                ws.write(r_idx, c, n, f_int)
                ws.write(r_idx, c + 1, d, f_int)
                ws.write(r_idx, c + 2, pct(n, d, 1), f_pct)
                c += 3

            for _, num_k, den_k in extra_headers:
                ws.write(r_idx, c, pct(b[num_k], b[den_k], 1), f_pct)
                c += 1
            r_idx += 1

        # Total row
        ws.write(r_idx, 0, "", f_bold_text)
        ws.write(r_idx, 1, "TOTAL KABUPATEN", f_bold_text)
        ws.write(r_idx, 2, "", f_bold_text)
        ws.write(r_idx, 3, sasaran_total, f_bold_int)
        ws.write(r_idx, 4, global_b["total_kk"], f_bold_int)
        ws.write(r_idx, 5, global_b["total_disurvei"], f_bold_int)
        ws.write(r_idx, 6, pct(global_b["total_disurvei"], sasaran_total, 1), f_bold_pct)
        ws.write(r_idx, 7, global_b["total_sehat"], f_bold_int)
        ws.write(r_idx, 8, global_b["total_tidak_sehat"], f_bold_int)
        ws.write(r_idx, 9, pct(global_b["total_sehat"], global_b["total_disurvei"], 1), f_bold_pct)
        c = 10
        for code, _, _, _ in INDICATORS:
            n = global_b[f"{code}_num"]
            d = global_b[f"{code}_den"]
            ws.write(r_idx, c, n, f_bold_int)
            ws.write(r_idx, c + 1, d, f_bold_int)
            ws.write(r_idx, c + 2, pct(n, d, 1), f_bold_pct)
            c += 3
        for _, num_k, den_k in extra_headers:
            ws.write(r_idx, c, pct(global_b[num_k], global_b[den_k], 1), f_bold_pct)
            c += 1

        ws.set_column(0, 0, 5)
        ws.set_column(1, 2, 22)
        ws.set_column(3, col - 1, 11)
        ws.conditional_format(5, 9, r_idx - 1, 9, {
            "type": "3_color_scale",
            "min_color": "#FCA5A5",
            "mid_color": "#FDE68A",
            "max_color": "#6EE7B7",
        })

    ws2 = wb.add_worksheet("Rekap_Puskesmas")
    write_rekap_sheet(ws2, "REKAPITULASI 10 INDIKATOR PHBS PER PUSKESMAS (39 PUSKESMAS)", is_desa=False, rows=pkm_rows)

    ws3 = wb.add_worksheet("Rekap_Desa")
    write_rekap_sheet(ws3, "REKAPITULASI 10 INDIKATOR PHBS PER DESA/KELURAHAN (391 DESA)", is_desa=True, rows=desa_rows)

    # ---------------------------------------------------------
    # SHEET 4: Pareto_&_Korelasi
    # ---------------------------------------------------------
    ws4 = wb.add_worksheet("Pareto_&_Korelasi")
    ws4.write("A1", "ANALISIS PARETO KEGAGALAN INDIKATOR (PADA KK TIDAK SEHAT) & MATRIKS KORELASI", f_title)
    ws4.write("A3", "Indikator Penyebab Kegagalan", f_hdr)
    ws4.write("B3", "Jumlah Kegagalan (KK)", f_hdr)
    ws4.write("C3", "Kontribusi (%)", f_hdr)
    ws4.write("D3", "Kumulatif (%)", f_hdr)

    pareto_sorted = sorted(analytics_global["pareto_data"], key=lambda x: x["failure"], reverse=True)
    total_fail = sum(x["failure"] for x in pareto_sorted) or 1
    cum = 0.0
    for idx, p in enumerate(pareto_sorted, start=4):
        share = (p["failure"] / total_fail) * 100.0
        cum += share
        ws4.write(f"A{idx}", p["name"], f_text)
        ws4.write(f"B{idx}", p["failure"], f_int)
        ws4.write(f"C{idx}", round(share, 1), f_pct)
        ws4.write(f"D{idx}", round(min(cum, 100.0), 1), f_pct)

    ws4.write("F3", "Indikator 1", f_hdr)
    ws4.write("G3", "Indikator 2", f_hdr)
    ws4.write("H3", "Korelasi Pearson (r)", f_hdr)
    for idx, c in enumerate(analytics_global["correlation_matrix"], start=4):
        ws4.write(f"F{idx}", c["ind1"], f_text)
        ws4.write(f"G{idx}", c["ind2"], f_text)
        ws4.write(f"H{idx}", c["value"], wb.add_format({"border": 1, "num_format": "0.00"}))

    ws4.set_column("A:A", 26)
    ws4.set_column("B:D", 20)
    ws4.set_column("F:H", 18)

    # ---------------------------------------------------------
    # SHEET 5: Tren_Bulanan
    # ---------------------------------------------------------
    ws5 = wb.add_worksheet("Tren_Bulanan")
    ws5.write("A1", "TREN BULANAN CAPAIAN SURVEI & IKS-PHBS TAHUN 2026", f_title)
    headers5 = ["Bulan", "Total Disurvei", "RT Sehat", "RT Tidak Sehat", "IKS-PHBS (%)"]
    for c_idx, h in enumerate(headers5):
        ws5.write(2, c_idx, h, f_hdr)
    for r_idx, m in enumerate(monthly_rows, start=3):
        ws5.write(r_idx, 0, m["bulan"], f_text)
        ws5.write(r_idx, 1, m["total_disurvei"], f_int)
        ws5.write(r_idx, 2, m["total_sehat"], f_int)
        ws5.write(r_idx, 3, m["total_tidak_sehat"], f_int)
        ws5.write(r_idx, 4, m["iks_phbs"], f_pct)
    ws5.set_column("A:E", 18)

    # ---------------------------------------------------------
    # SHEET 6: Rekap_Usia
    # ---------------------------------------------------------
    ws6 = wb.add_worksheet("Rekap_Usia")
    ws6.write("A1", "ANALISIS PHBS & GERMAS BERDASARKAN KATEGORI USIA (INDIVIDU / ART)", f_title)
    ws6.write("A2", "Sumber: survey_art_responses + family_members (tgl_lahir terhadap 2026-09-28)", f_sub)

    hdr6 = [
        "Wilayah", "Kelompok Usia", "Total ART", "Laki-laki", "Perempuan",
        "Tinggal di RT Sehat (%)", "CTPS (%)", "Sayur & Buah (%)", "Aktivitas Fisik (%)",
        "Tidak Merokok (%)", "Cek Kesehatan (CKG %)", "Posyandu (%)"
    ]
    for c_idx, h in enumerate(hdr6):
        ws6.write(3, c_idx, h, f_hdr)

    r6 = 4
    for key, label, _, _ in AGE_GROUPS:
        b = age_global[key]
        ws6.write(r6, 0, "KABUPATEN MALANG", f_bold_text)
        ws6.write(r6, 1, label, f_bold_text)
        ws6.write(r6, 2, b["total"], f_bold_int)
        ws6.write(r6, 3, b["male"], f_bold_int)
        ws6.write(r6, 4, b["female"], f_bold_int)
        ws6.write(r6, 5, pct(b["rt_sehat"], b["total"], 1), f_bold_pct)
        ws6.write(r6, 6, pct(b["i5_num"], b["i5_den"], 1), f_bold_pct)
        ws6.write(r6, 7, pct(b["i8_num"], b["i8_den"], 1), f_bold_pct)
        ws6.write(r6, 8, pct(b["i9_num"], b["i9_den"], 1), f_bold_pct)
        ws6.write(r6, 9, pct(b["i10_num"], b["i10_den"], 1), f_bold_pct)
        ws6.write(r6, 10, pct(b["ckg_num"], b["ckg_den"], 1), f_bold_pct)
        ws6.write(r6, 11, pct(b["pos_num"], b["pos_den"], 1), f_bold_pct)
        r6 += 1

    for p_item in pkm_rows:
        pid = p_item["puskesmas_id"]
        p_age = age_by_pkm.get(pid, {})
        for key, label, _, _ in AGE_GROUPS:
            b = p_age.get(key)
            if not b:
                continue
            ws6.write(r6, 0, p_item["puskesmas_nama"], f_text)
            ws6.write(r6, 1, label, f_text)
            ws6.write(r6, 2, b["total"], f_int)
            ws6.write(r6, 3, b["male"], f_int)
            ws6.write(r6, 4, b["female"], f_int)
            ws6.write(r6, 5, pct(b["rt_sehat"], b["total"], 1), f_pct)
            ws6.write(r6, 6, pct(b["i5_num"], b["i5_den"], 1), f_pct)
            ws6.write(r6, 7, pct(b["i8_num"], b["i8_den"], 1), f_pct)
            ws6.write(r6, 8, pct(b["i9_num"], b["i9_den"], 1), f_pct)
            ws6.write(r6, 9, pct(b["i10_num"], b["i10_den"], 1), f_pct)
            ws6.write(r6, 10, pct(b["ckg_num"], b["ckg_den"], 1), f_pct)
            ws6.write(r6, 11, pct(b["pos_num"], b["pos_den"], 1), f_pct)
            r6 += 1

    ws6.set_column(0, 1, 24)
    ws6.set_column(2, 11, 16)
    ws6.freeze_panes(4, 2)

    wb.close()


def main():
    print("[1/5] Loading reference tables...")
    ref_puskesmas = load_json("ref_puskesmas.json")
    ref_desa = load_json("ref_desa.json")
    sasaran_kk = load_json("sasaran_kk.json")
    kader_phbs = load_json("kader_phbs.json")

    pkm_map = {p["id"]: p for p in ref_puskesmas}
    desa_map = {d["id"]: d for d in ref_desa}
    kader_map = {k["id"]: k for k in kader_phbs}

    sasaran_by_desa = defaultdict(int)
    sasaran_by_pkm = defaultdict(int)
    for s in sasaran_kk:
        if s.get("tahun") == 2026:
            qty = int(s.get("jumlah_kk") or 0)
            sasaran_by_desa[s["desa_id"]] += qty
            sasaran_by_pkm[s["puskesmas_id"]] += qty

    print("[2/5] Loading households.json...")
    households = load_json("households.json")
    hh_loc = {}
    global_b = new_bucket()
    pkm_buckets = {p["id"]: new_bucket() for p in ref_puskesmas}
    desa_buckets = {d["id"]: new_bucket() for d in ref_desa}

    for h in households:
        hid = h["id"]
        pid = h.get("puskesmas_id")
        did = h.get("desa_id")
        hh_loc[hid] = (pid, did)
        global_b["total_kk"] += 1
        if pid in pkm_buckets:
            pkm_buckets[pid]["total_kk"] += 1
        if did in desa_buckets:
            desa_buckets[did]["total_kk"] += 1

    del households  # free memory

    print("[3/5] Loading & aggregating surveys.json...")
    surveys = load_json("surveys.json")
    global_corr = new_corr_accum()
    pkm_corrs = {p["id"]: new_corr_accum() for p in ref_puskesmas}
    kader_counts = defaultdict(int)
    monthly_buckets = defaultdict(lambda: {"total_disurvei": 0, "total_sehat": 0, "total_tidak_sehat": 0})

    survey_meta = {}
    for s in surveys:
        hid = s.get("household_id")
        pid, did = hh_loc.get(hid, (None, None))
        survey_meta[s["id"]] = (pid, did, s.get("is_rt_sehat"))
        accumulate_survey(global_b, s)
        update_corr_accum(global_corr, s)

        if pid in pkm_buckets:
            accumulate_survey(pkm_buckets[pid], s)
            update_corr_accum(pkm_corrs[pid], s)
        if did in desa_buckets:
            accumulate_survey(desa_buckets[did], s)

        kid = s.get("kader_id")
        if kid:
            kader_counts[kid] += 1

        sdate = s.get("survey_date") or ""
        if len(sdate) >= 7:
            ym = sdate[:7]
            mb = monthly_buckets[ym]
            mb["total_disurvei"] += 1
            if s.get("is_rt_sehat") is True:
                mb["total_sehat"] += 1
            elif s.get("is_rt_sehat") is False:
                mb["total_tidak_sehat"] += 1

    del surveys  # free memory

    print("[3b/5] Loading family_members.json & survey_art_responses.json for Age Analytics...")
    family_members = load_json("family_members.json")
    fm_meta = {}
    for m in family_members:
        akey = classify_age_key(m.get("tgl_lahir"))
        if akey:
            fm_meta[m["id"]] = (akey, m.get("jenis_kelamin") or "")
    del family_members

    art_responses = load_json("survey_art_responses.json")
    age_global = new_age_group_map()
    age_by_pkm = {p["id"]: new_age_group_map() for p in ref_puskesmas}
    age_by_desa = {d["id"]: new_age_group_map() for d in ref_desa}

    classified_art = 0
    for art in art_responses:
        fm_info = fm_meta.get(art.get("family_member_id"))
        if not fm_info:
            continue
        akey, gender = fm_info
        s_info = survey_meta.get(art.get("survey_id"))
        if not s_info:
            continue
        pid, did, is_rt_sehat = s_info
        classified_art += 1
        accumulate_art(age_global[akey], art, gender, is_rt_sehat)
        if pid in age_by_pkm:
            accumulate_art(age_by_pkm[pid][akey], art, gender, is_rt_sehat)
        if did in age_by_desa:
            accumulate_art(age_by_desa[did][akey], art, gender, is_rt_sehat)

    del art_responses, fm_meta, survey_meta
    print(f"  Classified {classified_art} ART responses by age.")

    print("[4/5] Building snapshot & Excel structures...")
    # Filter out DINKES for Puskesmas list (matching dashboard.ts)
    active_pkms = sorted(
        [p for p in ref_puskesmas if p.get("nama") and "dinkes" not in p["nama"].lower()],
        key=lambda x: x["nama"],
    )

    pkm_rows = []
    by_puskesmas_json = []
    for p in active_pkms:
        pid = p["id"]
        b = pkm_buckets[pid]
        sas_qty = sasaran_by_pkm[pid]
        pkm_rows.append({
            "puskesmas_id": pid,
            "puskesmas_nama": p["nama"],
            "kecamatan": p.get("kecamatan") or p["nama"],
            "sasaran_kk": sas_qty,
            "bucket": b,
        })
        entry = {
            "puskesmas_id": pid,
            "puskesmas_nama": p["nama"],
            "total_kk": b["total_kk"],
            "sasaran_kk": sas_qty,
            "total_disurvei": b["total_disurvei"],
            "total_sehat": b["total_sehat"],
            "total_tidak_sehat": b["total_tidak_sehat"],
            "i11_num": b["i11_num"],
            "i12_num": b["i12_num"],
            "i14_num": b["i14_num"],
            "i15_num": b["i15_num"],
            "i16_num": b["i16_num"],
            "i17_num": b["i17_num"],
        }
        for code, _, _, _ in INDICATORS:
            entry[f"{code}_num"] = b[f"{code}_num"]
            entry[f"{code}_den"] = b[f"{code}_den"]
            entry[f"{code}_radar_num"] = b[f"{code}_radar_num"]
            entry[f"{code}_fail"] = b[f"{code}_fail"]
        by_puskesmas_json.append(entry)

    sorted_desa = sorted(
        ref_desa,
        key=lambda d: (pkm_map.get(d["puskesmas_id"], {}).get("nama", ""), d.get("desa_kel", "")),
    )
    desa_rows = []
    by_desa_json = []
    for d in sorted_desa:
        did = d["id"]
        pid = d["puskesmas_id"]
        b = desa_buckets[did]
        sas_qty = sasaran_by_desa[did]
        pkm_nama = pkm_map.get(pid, {}).get("nama", d.get("puskesmas", ""))
        desa_rows.append({
            "desa_id": did,
            "desa_nama": d["desa_kel"],
            "puskesmas_id": pid,
            "puskesmas_nama": pkm_nama,
            "sasaran_kk": sas_qty,
            "bucket": b,
        })
        entry = {
            "desa_id": did,
            "desa_nama": d["desa_kel"],
            "puskesmas_id": pid,
            "puskesmas_nama": pkm_nama,
            "total_kk": b["total_kk"],
            "sasaran_kk": sas_qty,
            "total_disurvei": b["total_disurvei"],
            "total_sehat": b["total_sehat"],
            "total_tidak_sehat": b["total_tidak_sehat"],
            "i11_num": b["i11_num"],
            "i12_num": b["i12_num"],
            "i14_num": b["i14_num"],
            "i15_num": b["i15_num"],
            "i16_num": b["i16_num"],
            "i17_num": b["i17_num"],
        }
        for code, _, _, _ in INDICATORS:
            entry[f"{code}_num"] = b[f"{code}_num"]
            entry[f"{code}_den"] = b[f"{code}_den"]
        by_desa_json.append(entry)

    # Top kader
    top_kader_all = []
    for kid, cnt in sorted(kader_counts.items(), key=lambda kv: kv[1], reverse=True)[:100]:
        k = kader_map.get(kid)
        if not k:
            continue
        pid = k.get("puskesmas_id")
        top_kader_all.append({
            "id": kid,
            "nama_kader": k.get("nama_kader", "Kader"),
            "puskesmas_id": pid,
            "puskesmas_nama": pkm_map.get(pid, {}).get("nama", ""),
            "total_survei": cnt,
        })

    # Germas per desa for analytics
    germas_by_pkm = defaultdict(list)
    for d in by_desa_json:
        tot_d = d["total_disurvei"]
        if tot_d > 0:
            germas_by_pkm[d["puskesmas_id"]].append({
                "name": d["desa_nama"],
                "Posyandu": pct(d["i12_num"], tot_d, 1),
                "CKG": pct(d["i11_num"], tot_d, 1),
            })

    analytics_global = build_analytics(
        global_b,
        global_corr,
        [
            {"name": p["puskesmas_nama"], "Posyandu": pct(p["i12_num"], p["total_disurvei"], 1), "CKG": pct(p["i11_num"], p["total_disurvei"], 1)}
            for p in by_puskesmas_json[:15]
        ],
    )

    analytics_by_pkm = {}
    for p in active_pkms:
        pid = p["id"]
        analytics_by_pkm[pid] = build_analytics(
            pkm_buckets[pid],
            pkm_corrs[pid],
            germas_by_pkm[pid][:15],
        )

    monthly_rows = [
        {
            "bulan": ym,
            "total_disurvei": mb["total_disurvei"],
            "total_sehat": mb["total_sehat"],
            "total_tidak_sehat": mb["total_tidak_sehat"],
            "iks_phbs": pct(mb["total_sehat"], mb["total_disurvei"], 1),
        }
        for ym, mb in sorted(monthly_buckets.items())
    ]

    global_json = {
        "total_kk": global_b["total_kk"],
        "sasaran_kk": sum(sasaran_by_desa.values()),
        "total_disurvei": global_b["total_disurvei"],
        "total_sehat": global_b["total_sehat"],
        "total_tidak_sehat": global_b["total_tidak_sehat"],
        "i11_num": global_b["i11_num"],
        "i12_num": global_b["i12_num"],
        "i14_num": global_b["i14_num"],
        "i15_num": global_b["i15_num"],
        "i16_num": global_b["i16_num"],
        "i17_num": global_b["i17_num"],
    }
    for code, _, _, _ in INDICATORS:
        global_json[f"{code}_num"] = global_b[f"{code}_num"]
        global_json[f"{code}_den"] = global_b[f"{code}_den"]

    SNAPSHOT_OUT.parent.mkdir(parents=True, exist_ok=True)
    snapshot_payload = {
        "tahun": 2026,
        "backup_date": "2026-09-28T07:57:46.099Z",
        "ref_puskesmas": ref_puskesmas,
        "ref_desa": ref_desa,
        "sasaran_kk": sasaran_kk,
        "global": global_json,
        "by_puskesmas": by_puskesmas_json,
        "by_desa": by_desa_json,
        "top_kader": top_kader_all,
        "analytics_global": analytics_global,
        "analytics_by_puskesmas": analytics_by_pkm,
        "monthly_trend": monthly_rows,
    }
    with open(SNAPSHOT_OUT, "w", encoding="utf-8") as f:
        json.dump(snapshot_payload, f, ensure_ascii=False)

    print("[5/5] Writing Age Snapshot & Excel workbook...")
    age_snapshot_payload = {
        "tahun": 2026,
        "classified_art": classified_art,
        "age_groups": [
            {"key": key, "label": label, "min": lo, "max": hi}
            for key, label, lo, hi in AGE_GROUPS
        ],
        "global": age_global,
        "by_puskesmas": {
            p["id"]: age_by_pkm[p["id"]]
            for p in active_pkms
        },
        "by_desa": {
            d["id"]: age_by_desa[d["id"]]
            for d in sorted_desa
        },
    }
    with open(AGE_SNAPSHOT_OUT, "w", encoding="utf-8") as f:
        json.dump(age_snapshot_payload, f, ensure_ascii=False)

    export_excel(
        global_b,
        pkm_rows,
        desa_rows,
        analytics_global,
        monthly_rows,
        sum(sasaran_by_desa.values()),
        age_global,
        age_by_pkm,
    )

    print("DONE!")
    print(f"  Excel       : {EXCEL_OUT} ({EXCEL_OUT.stat().st_size / 1024:.1f} KB)")
    print(f"  Snapshot    : {SNAPSHOT_OUT} ({SNAPSHOT_OUT.stat().st_size / 1024:.1f} KB)")
    print(f"  Age Snapshot: {AGE_SNAPSHOT_OUT} ({AGE_SNAPSHOT_OUT.stat().st_size / 1024:.1f} KB)")
    print(f"  Summary : {global_b['total_disurvei']} survei, {global_b['total_sehat']} sehat ({pct(global_b['total_sehat'], global_b['total_disurvei'], 1)}%), {len(pkm_rows)} Puskesmas, {len(desa_rows)} Desa")


if __name__ == "__main__":
    main()
