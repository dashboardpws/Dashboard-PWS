import { useEffect } from 'react'
import { useLocation, Link } from '@tanstack/react-router'
import { notifications } from '@mantine/notifications'
import { Badge } from '@mantine/core'
import { useNotifikasi } from '@/hooks/notifikasi/use-notifikasi'
import {
  bacaDitampilkan,
  pilihKandidatToast,
  tandaiDitampilkan,
  DURASI_TOAST,
} from '@/lib/notifikasi/toast-dedup'
import {
  SEVERITY_META,
  WARNING_TYPE_ICON,
  WARNING_TYPE_LABEL,
} from '@/components/dashboard/severity'
import { warningTarget } from '@/lib/dashboard/warning'
import { labelSingkat } from '@/lib/notifikasi/ringkasan'

/**
 * Toast notifikasi berbasis Mantine Notifications.
 * Cukup dipasang sekali di Topbar/Layout untuk memicu pendaftaran notifikasi.
 */
export function NotifikasiToast() {
  const location = useLocation()
  const { warnings, loading, error } = useNotifikasi()

  useEffect(() => {
    if (loading || error) return
    if (location.pathname.startsWith('/notifikasi')) return

    const kandidat = pilihKandidatToast(warnings, bacaDitampilkan())
    if (kandidat.length === 0) return

    tandaiDitampilkan(kandidat.map((w) => w.id))

    kandidat.forEach((item) => {
      const target = warningTarget(item)
      const Ikon = WARNING_TYPE_ICON[item.type]

      notifications.show({
        id: item.id,
        autoClose: DURASI_TOAST,
        withCloseButton: true,
        icon: <Ikon size={16} />,
        className: '!bg-surface-2 !mb-3',
        color:
          item.severity === 'critical'
            ? 'red'
            : item.severity === 'attention'
              ? 'yellow'
              : 'blue',
        title: (
          <div className="mb-1 flex items-center gap-1.5">
            <Badge
              size="xs"
              variant="light"
              color={SEVERITY_META[item.severity].color}
            >
              {SEVERITY_META[item.severity].label}
            </Badge>
            <span className="text-[10px] font-medium uppercase text-muted">
              {WARNING_TYPE_LABEL[item.type]}
            </span>
            {item.region ? (
              <Badge size="xs" variant="outline" color="gray">
                {item.region}
              </Badge>
            ) : null}
          </div>
        ),
        message: (
          <div>
            <Link
              to={target.to}
              search={target.search as never}
              hash={target.hash}
              onClick={() => notifications.hide(item.id)}
              aria-label={labelSingkat(item)}
              className="block text-sm font-semibold text-ink hover:underline"
            >
              {item.title}
            </Link>
            {item.description ? (
              <p className="mt-0.5 text-xs text-muted">{item.description}</p>
            ) : null}
          </div>
        ),
      })
    })
  }, [loading, error, warnings, location.pathname])

  return null
}
