import { LineChart } from '@mantine/charts'
import { Box, Center, Loader, Text } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { KegiatanTooltip } from './KegiatanTrendTooltip'
import type { MonthlyKegiatanStat } from '@/hooks/dashboard/use-kegiatan-trend'

interface KegiatanTrendChartProps {
  data: MonthlyKegiatanStat[]
  loading?: boolean
}

export function KegiatanTrendChart({ data, loading }: KegiatanTrendChartProps) {
  const navigate = useNavigate()

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

  if (data.length === 0) {
    return (
      <Center h={280}>
        <Text size="sm" c="dimmed">
          Belum ada data kunjungan rumah untuk 12 bulan terakhir
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

  const maxKegiatan = Math.max(...data.map((d) => d.totalKegiatan), 1)

  return (
    <Box
      h={280}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const width = rect.width
        const index = Math.round((x / width) * (data.length - 1))
        const clampedIndex = Math.max(0, Math.min(data.length - 1, index))
        const entry = data[clampedIndex]
        if (entry) handleClick(entry.month)
      }}
    >
      <LineChart
        h={280}
        data={data}
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
