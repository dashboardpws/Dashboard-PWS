import { useMemo, useState } from 'react'
import { LineChart } from '@mantine/charts'
import { Box, Center, Loader, Text } from '@mantine/core'
import { KunjunganRumahTrendTooltip } from './KunjunganRumahTrendTooltip'
import type { MonthlyKunjunganRumahStat } from '@/lib/kunjungan-rumah/dashboard'
import { KunjunganDrilldownDrawer } from './KunjunganDrilldownDrawer'

interface KunjunganRumahTrendChartProps {
  data: MonthlyKunjunganRumahStat[]
  loading?: boolean
}

function fillLast12Months(
  rawData: MonthlyKunjunganRumahStat[],
): MonthlyKunjunganRumahStat[] {
  const mapData = new Map(rawData.map((item) => [item.month, item]))
  const result: MonthlyKunjunganRumahStat[] = []

  const now = new Date()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)

    const year = d.getFullYear()
    const monthNum = String(d.getMonth() + 1).padStart(2, '0')
    const monthKey = `${year}-${monthNum}`

    const label = d.toLocaleDateString('id-ID', {
      month: 'short',
      year: '2-digit',
    })

    const existing = mapData.get(monthKey)

    if (existing) {
      result.push({
        ...existing,
        byPosyandu: existing.byPosyandu,
        label: existing.label || label,
      })
    } else {
      // Bulan tanpa record tetap ditampilkan agar rentang chart konsisten.
      result.push({
        month: monthKey,
        label,
        totalKunjungan: 0,
        byPosyandu: [],
      })
    }
  }

  return result
}

export function KunjunganRumahTrendChart({
  data = [],
  loading,
}: KunjunganRumahTrendChartProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

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

  const handleClick = (month: string) => setSelectedMonth(month)

  const maxKunjungan = Math.max(...chartData.map((d) => d.totalKunjungan), 1)

  return (
    <>
      <Box
        h={280}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          const width = rect.width
          const index = Math.round((x / width) * (chartData.length - 1))
          const clampedIndex = Math.max(
            0,
            Math.min(chartData.length - 1, index),
          )
          const entry = chartData[clampedIndex]
          if (entry) handleClick(entry.month)
        }}
      >
        <LineChart
          h={280}
          data={chartData}
          dataKey="label"
          yAxisProps={{
            domain: [0, Math.max(maxKunjungan + 1, 5)],
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
              name: 'totalKunjungan',
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
              <KunjunganRumahTrendTooltip
                active={props.active}
                payload={props.payload}
                label={
                  typeof props.label === 'string' ? props.label : undefined
                }
                onOpenDetails={handleClick}
              />
            ),
          }}
          gridAxis="x"
        />
      </Box>
      {selectedMonth ? (
        <KunjunganDrilldownDrawer
          month={selectedMonth}
          onClose={() => setSelectedMonth(null)}
        />
      ) : null}
    </>
  )
}
