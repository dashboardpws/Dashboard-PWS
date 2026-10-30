import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { KunjunganRumahTemplates } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-templates'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FormField } from '@/components/ui/FormField'
import {
  cariAnggotaKeluarga,
  cariRiwayatKs,
  cariSasaranWarga,
} from '@/lib/api/server-fns'
import { SaranWargaDropdown } from '@/components/survey/SaranWargaDropdown'
import { sanitasiDariRiwayat } from '@/lib/kunjungan-rumah/sasaran/sanitasi-dari-riwayat'
import type { SasaranSuggestion } from '@/lib/kunjungan-rumah/sasaran/warga-row'
import { cn, normalkanNik } from '@/lib/utils'
import type {
  KunjunganRumahAction,
  KunjunganRumahState,
} from '@/lib/kunjungan-rumah/store/kunjungan-rumah-reducer'

const PLACEHOLDER: Partial<Record<string, string>> = {
  alamat: 'cth. Jl. Trajeng gg. II no. 8',
  hpKK: 'cth. 62812xxxx',
  posyandu: 'cth. Melati 1',
  puskesmas: 'cth. Puskesmas Trajeng',
}

/** Panjang ketikan minimum sebelum server mencari suggestion — 3 huruf sudah
 *  cukup unik di 20 ribu baris data import. */
const MIN_KETIK = 3
const DEBOUNCE_MS = 300

interface Props {
  state: KunjunganRumahState
  templates: KunjunganRumahTemplates
  dispatch: React.Dispatch<KunjunganRumahAction>
  onWargaSelected?: (row: SasaranSuggestion) => void
}

export function KeluargaInfoSection({
  state,
  templates,
  dispatch,
  onWargaSelected,
}: Props) {
  const keluargaInfoFields = useMemo(
    () =>
      templates.keluargaInfo
        .filter((f) => f.active)
        .sort((a, b) => a.order - b.order),
    [templates.keluargaInfo],
  )

  // Suggestion warga sasaran. Satu state dipakai bersama oleh input NIK dan
  // nama KK; `sumber` menentukan input mana yang sedang diketik supaya pilihan
  // tidak muncul di tempat yang tidak diklik.
  const [saran, setSaran] = useState<{
    sumber: 'nik' | 'namaKK'
    rows: SasaranSuggestion[]
  } | null>(null)
  const [saranBusy, setSaranBusy] = useState(false)

  // `pilihSaran` async: Sanitasi dibaca setelah dua `await`, jadi `state` dari
  // render itu sudah basi kalau ada dispatch di antaranya. Ref ini menyimpan
  // snapshot terbaru supaya isian kader yang belum tersentuh tidak hilang.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const sumber = saran?.sumber
    const q = (
      sumber === 'nik'
        ? state.info.nik
        : sumber === 'namaKK'
          ? state.info.namaKK
          : ''
    ).trim()
    if (!sumber || q.length < MIN_KETIK) {
      setSaran((s) => (s ? { ...s, rows: [] } : s))
      return
    }
    let hidup = true
    setSaranBusy(true)
    const t = setTimeout(() => {
      void cariSasaranWarga({ data: { q } })
        .then((rows) => {
          if (hidup)
            setSaran((s) => (s && s.sumber === sumber ? { sumber, rows } : s))
        })
        .catch(() => {
          if (hidup)
            setSaran((s) =>
              s && s.sumber === sumber ? { sumber, rows: [] } : s,
            )
        })
        .finally(() => {
          if (hidup) setSaranBusy(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      hidup = false
      clearTimeout(t)
    }
  }, [saran?.sumber, state.info.nik, state.info.namaKK])

  const bukaSaran = (sumber: 'nik' | 'namaKK') =>
    setSaran((s) => (s?.sumber === sumber ? s : { sumber, rows: [] }))
  const tutupSaran = () => setSaran(null)

  // [perbaikan] memilih warga mengisi tiga hal sekaligus: header, seluruh
  //   anggota household-nya, dan isian awal Sanitasi dari riwayat kesehatan
  //   keluarga — expect: A = kepala keluarga dan B, C, D anggotanya, maka pilih
  //   A maupun B, C, D berakhir dengan anggota [A, B, C, D]. `APPLY_SASARAN`
  //   dispatch lebih dulu supaya header terisi tanpa menunggu jaringan; dua
  //   fetch lain jalan paralel karena keduanya cuma membaca dan tidak saling
  //   bergantung. `requestId` mencegah jawaban basi menimpa pilihan baru.
  const requestId = useRef(0)
  // Loader penutup: isian dan anggota datang dari dua query setelah pilihan
  // ditekan, jadi tanpa penanda ini kader bisa menyimpan record dalam keadaan
  // setengah terisi dan mengira itu keadaan final.
  const [mengisiOtomatis, setMengisiOtomatis] = useState(false)
  const pilihSaran = async (row: SasaranSuggestion) => {
    const iniRequest = ++requestId.current
    if (onWargaSelected) onWargaSelected(row)
    else dispatch({ type: 'APPLY_SASARAN', row })
    setSaran(null)

    // Dua fetch jalan bersamaan lalu dipasang bareng: keduanya baca data yang
    // sama dan tidak saling bergantung, jadi tidak perlu di-await satu per satu.
    // Alamat dan `jumlah_art` ikut dikirim — tanpa keduanya pencarian satu nama
    // KK bisa menarik puluhan keluarga yang kebetulan sama namanya (sudah
    // pernah terjadi: 53 baris untuk satu pilihan). `jumlah_art` hanya ada di
    // baris import, jadi `null` untuk warga yang sudah tersimpan.
    setMengisiOtomatis(true)
    const kunci = {
      namaKk: row.namaKk,
      nik: row.nik,
      kelurahan: row.kelurahan,
      kecamatan: row.kecamatan,
      rt: row.rt,
      rw: row.rw,
      jumlahArt: row.jumlahArt ?? null,
    }
    const bolehCari = !!kunci.namaKk.trim() || !!kunci.nik.trim()
    const [hasilAnggota, hasilRiwayat] = await Promise.all([
      bolehCari
        ? cariAnggotaKeluarga({ data: kunci }).catch(() => null)
        : Promise.resolve(null),
      cariRiwayatKs({ data: { rawId: row.rawId, nik: row.nik } }).catch(
        () => null,
      ),
    ])
    // Syarat stale dicek SEBELUM `finally` yang membuka loader: kalau pilihan
    // sudah diganti, loader milik permintaan yang lebih baru yang harus tetap
    // terbuka.
    const stale = requestId.current !== iniRequest
    if (!stale) {
      if (hasilAnggota && hasilAnggota.length > 0)
        dispatch({
          type: 'ISI_ANGGOTA_KELUARGA',
          rows: hasilAnggota,
          templates,
        })

      // Sanitasi dibaca dari snapshot state saat ini, bukan dari `state` render
      // yang sudah ditutup `pilihSaran`: `ISI_ANGGOTA_KELUARGA` di atas bisa
      // sudah mengubah state.
      if (hasilRiwayat) {
        const sanitasi = sanitasiDariRiwayat(
          hasilRiwayat.ada,
          hasilRiwayat.nilai,
          stateRef.current.sanitasi,
        )
        if (sanitasi) dispatch({ type: 'ISI_SANITASI_DARI_RIWAYAT', sanitasi })
      }
    }
    if (!stale) setMengisiOtomatis(false)
  }
  const saranUntuk = (sumber: 'nik' | 'namaKK') =>
    saran?.sumber === sumber ? saran.rows : null

  // [perbaikan] ref input pemicu dropdown, diteruskan ke `SaranWargaDropdown`
  //   sebagai `anchorRef` — expect: klik pada input yang sedang diketik tidak lagi
  //   dibaca "klik luar" oleh penutup dropdown, jadi suggestion tidak hilang.
  const anchorNik = useRef<HTMLInputElement>(null)
  const anchorKK = useRef<HTMLInputElement>(null)
  const anchorOf = (sumber: 'nik' | 'namaKK'): RefObject<HTMLElement | null> =>
    sumber === 'nik' ? anchorNik : anchorKK

  // [perbaikan] klik pada field = terima suggestion teratas, bukan
  //   hanya membuka dropdown — expect: mengetik "3575" atau "syah" lalu klik
  //   field langsung terisi penuh dari Data Sasaran, tanpa melengkapi ketikan
  //   manual. Baris teratas dipakai apa adanya karena server sudah mengurutkan
  //   hasil (cocok persis dulu); syarat "nilai sudah terisi" hanya menjaga agar
  //   klik tidak menimpa ketikan dengan baris yang tidak punya nilai untuk field
  //   ini.
  const nilaiSaran = (row: SasaranSuggestion, sumber: 'nik' | 'namaKK') =>
    (sumber === 'nik' ? normalkanNik(row.nik) : row.namaKk).trim()

  const barisTerisiOtomatis = (
    sumber: 'nik' | 'namaKK',
    rows: SasaranSuggestion[] | null,
  ): SasaranSuggestion | null => {
    if (!rows || rows.length === 0) return null
    return rows.find((r) => nilaiSaran(r, sumber) !== '') ?? null
  }

  const klikSaran = (
    sumber: 'nik' | 'namaKK',
    rows: SasaranSuggestion[] | null,
  ) => {
    const row = barisTerisiOtomatis(sumber, rows)
    if (row) void pilihSaran(row)
    else bukaSaran(sumber)
  }

  return (
    <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
      {mengisiOtomatis ? (
        <div
          className="col-span-full fixed inset-0 z-50 grid place-items-center bg-[var(--color-ink)]/45"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-xl border border-line bg-surface px-5 py-4 shadow-lg">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <span
                aria-hidden
                className="size-3.5 animate-spin rounded-full border-2 border-line border-t-accent"
              />
              Mengisi data keluarga…
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Mencari anggota keluarga dan riwayat kesehatan.
            </p>
          </div>
        </div>
      ) : null}
      {keluargaInfoFields.map((f) => {
        if (f.id === 'nik' || f.id === 'namaKK') {
          const sumber: 'nik' | 'namaKK' = f.id
          const rows = saranUntuk(sumber)
          const invalid = !!state.invalid[f.id]
          const errorId = `${f.id}-error`
          return (
            <FormField
              key={f.id}
              label={sumber === 'nik' ? 'NIK sasaran utama' : f.label}
              required
              invalid={invalid}
              error={
                sumber === 'nik'
                  ? 'Wajib 16 digit dan harus cocok dengan NIK salah satu anggota keluarga.'
                  : 'Wajib diisi.'
              }
              errorId={errorId}
            >
              <div className="relative">
                <Input
                  value={state.info[f.id]}
                  ref={sumber === 'nik' ? anchorNik : anchorKK}
                  onFocus={() => bukaSaran(sumber)}
                  // [perbaikan] klik juga membuka suggestion, bukan cuma fokus —
                  //   expect: field yang sedang diketik langsung menampilkan pilihan
                  //   walaupun inputnya sudah fokus dan dropdown sempat tertutup.
                  //   Kalau ada baris yang melengkapi ketikan, klik langsung menerimanya.
                  onClick={() => klikSaran(sumber, rows)}
                  onChange={(e) => {
                    bukaSaran(sumber)
                    dispatch({
                      type: 'SET_FIELD',
                      key: f.id,
                      value:
                        sumber === 'nik'
                          ? normalkanNik(e.target.value)
                          : e.target.value,
                    })
                  }}
                  inputMode={sumber === 'nik' ? 'numeric' : undefined}
                  maxLength={sumber === 'nik' ? 16 : undefined}
                  placeholder={
                    sumber === 'nik'
                      ? '16 digit NIK'
                      : (PLACEHOLDER[f.id] ?? '')
                  }
                  invalid={invalid}
                  className={cn(rows && rows.length > 0 && 'border-accent')}
                  aria-describedby={invalid ? errorId : undefined}
                />
                {rows ? (
                  <SaranWargaDropdown
                    rows={rows}
                    busy={saranBusy}
                    onPilih={(r) => void pilihSaran(r)}
                    onTutup={tutupSaran}
                    anchorRef={anchorOf(sumber)}
                    tampilkanAlamat
                  />
                ) : null}
              </div>
            </FormField>
          )
        }
        const val = state.info[f.id] ?? ''
        const invalid =
          !!state.invalid[f.id] ||
          (f.id === 'tglPengumpulan'
            ? !!state.invalid.tgl
            : f.id === 'posyandu'
              ? !!state.invalid.posyandu
              : false)
        const errorId = `${f.id}-error`
        return (
          <FormField
            key={f.id}
            label={f.label}
            required={f.required}
            invalid={invalid}
            error={f.required ? 'Wajib diisi.' : undefined}
            hint={f.hint}
            errorId={errorId}
          >
            {f.kind === 'date' ? (
              <Input
                type="date"
                value={val}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_FIELD',
                    key: f.id,
                    value: e.target.value,
                  })
                }
                invalid={invalid}
                aria-describedby={invalid ? errorId : undefined}
              />
            ) : f.kind === 'select' ? (
              <Select
                value={val}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_FIELD',
                    key: f.id,
                    value: e.target.value,
                  })
                }
                aria-describedby={invalid ? errorId : undefined}
              >
                <option value="">— Pilih —</option>
                {(f.options ?? []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            ) : (
              <Input
                value={val}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_FIELD',
                    key: f.id,
                    value: e.target.value,
                  })
                }
                placeholder={PLACEHOLDER[f.id] ?? ''}
                invalid={invalid}
                aria-describedby={invalid ? errorId : undefined}
              />
            )}
          </FormField>
        )
      })}
    </div>
  )
}
