import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AppShell } from '@/components/layout'
import { FormBuilderSection } from '@/components/kelola/FormBuilderSection'
import { DetailHeader } from '@/components/shared'
import { requireAuth } from '@/lib/auth/auth'

export const Route = createFileRoute('/kelola/form-builder/$formId')({
  beforeLoad: requireAuth,
  component: FormBuilderPage,
})

function FormBuilderPage() {
  const { formId } = Route.useParams()
  const navigate = useNavigate()
  const id = Number(formId)

  return (
    <AppShell>
      <DetailHeader
        breadcrumb={[
          { label: 'Kelola', href: '/kelola' },
          { label: 'Form Builder', href: '/kelola' },
          { label: 'Editor Form' },
        ]}
        onBack={() => navigate({ to: '/kelola' })}
        title="Form Builder"
        meta={
          <span>
            Atur pertanyaan dan bagian form.{' '}
            <Link
              to="/kelola"
              className="font-semibold text-accent hover:underline"
            >
              Kembali ke Kelola
            </Link>
          </span>
        }
      />
      {Number.isInteger(id) && id > 0 ? (
        <FormBuilderSection mode="editor" selectedFormId={id} />
      ) : (
        <p className="mt-4 text-sm text-destructive">ID form tidak valid.</p>
      )}
    </AppShell>
  )
}
