import { useMemo } from 'react'
import { LineChart } from '@mantine/charts'
import { Box, Center, Loader, Text } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { KegiatanTooltip } from './KegiatanTrendTooltip'
import type { MonthlyKegiatanStat } from '@/hooks/dashboard/use-kegiatan-trend'

interface KegiatanTrendChartProps {
  data: MonthlyKegiatanStat[]
  loading?: boolean
}

function fillLast12Months(rawData: MonthlyKegiatanStat[]): MonthlyKegiatanStat[] {
  const mapData = new Map(rawData.map((item) => [item.month, item]))
  const result: MonthlyKegiatanStat[] = []

  const now = new Date()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    
    const year = d.getFullYear()
    const monthNum = String(d.getMonth() + 1).padStart(2, '0')
    const monthKey = `${year}-${monthNum}`

    const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })

    const existing = mapData.get(monthKey)

    if (existing) {
      result.push({
        ...existing,
        byJenis: existing.byJenis,
        label: existing.label || label,
      })
    } else {
      // Lengkapi seluruh properti wajib dari tipe MonthlyKegiatanStat
      result.push({
        month: monthKey,
        label,
        totalKegiatan: 0,
        totalHadir: 0,
        totalPeserta: 0,
        pctHadir: 0,
        byJenis: [],
      })
    }
  }

  return result
}

export function KegiatanTrendChart({ data = [], loading }: KegiatanTrendChartProps) {
  const navigate = useNavigate()

  const chartData = useMemo(() => fillLast12Months(data), [data])

  if (loading) {
    return (
      <Center h={280}>
        <Loader size="sm" type="dots" />
        <Text size="sm" c="dimmed" ml="xs">
          Memuat tren kunjungan rumah…
        </Text>
      </Center>
    )
  }

  const handleClick = (month: string) => {
    navigate({
      to: '/laporan',
      search: { period: month, section: 'kunjungan' },
    })
  }

  const maxKegiatan = Math.max(...chartData.map((d) => d.totalKegiatan), 1)

  return (
    <Box
      h={280}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const width = rect.width
        const index = Math.round((x / width) * (chartData.length - 1))
        const clampedIndex = Math.max(0, Math.min(chartData.length - 1, index))
        const entry = chartData[clampedIndex]
        if (entry) handleClick(entry.month)
      }}
    >
      <LineChart
        h={280}
        data={chartData}
        dataKey="label"
        yAxisProps={{
          domain: [0, Math.max(maxKegiatan + 1, 5)],
          allowDecimals: false,
          tickFormatter: (v) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`,
          tick: { fill: 'var(--color-ink-2)', fontSize: 12 },
        }}
        xAxisProps={{
          tick: { fill: 'var(--color-ink-2)', fontSize: 12 },
        }}
        series={[
          {
            name: 'totalKegiatan',
            label: 'Total Kunjungan',
            color: 'var(--color-accent)',
          },
        ]}
        curveType="monotone"
        strokeWidth={2.5}
        withDots
        dotProps={{
          r: 4,
          fill: 'var(--color-accent)',
          stroke: 'var(--color-surface)',
          strokeWidth: 2,
        }}
        activeDotProps={{
          r: 6,
          fill: 'var(--color-accent)',
          stroke: 'var(--color-surface)',
          strokeWidth: 2,
        }}
        tooltipProps={{
          content: (props) => (
            <KegiatanTooltip
              active={props.active}
              payload={props.payload}
              label={typeof props.label === 'string' ? props.label : undefined}
            />
          ),
        }}
        gridAxis="x"
      />
    </Box>
  )
}