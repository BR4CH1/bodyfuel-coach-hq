import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/reset-lukas')({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          '70598241-6bb7-492b-ba76-95a55deb647e',
          { password: 'Roadtomaster100', email_confirm: true },
        )
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
        return new Response(JSON.stringify({ ok: true }))
      },
    },
  },
})
