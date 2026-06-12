import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/create-lukas')({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: 'Lukas.flockert@icloud.com',
          password: 'Roadtomaster100',
          email_confirm: true,
          user_metadata: {
            display_name: 'Lukas Flockert',
            role: 'client',
          },
        })
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
        return new Response(JSON.stringify({ id: data.user?.id, email: data.user?.email }))
      },
    },
  },
})
