import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Buscar configuração do WhatsApp
    const { data: companyUser } = await supabaseClient
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!companyUser?.company_id) {
      throw new Error('Company not found')
    }

    const { data: whatsappConfig } = await supabaseClient
      .from('whatsapp_configs')
      .select('*')
      .eq('company_id', companyUser.company_id)
      .single()

    if (!whatsappConfig) {
      throw new Error('WhatsApp config not found')
    }

    // Extrair parâmetros da URL
    const url = new URL(req.url)
    const path = url.pathname.replace('/evolution-api', '')

    // Fazer requisição para a Evolution API
    const evolutionUrl = `${whatsappConfig.evolution_api_url.replace(/\/+$/, '')}${path}`
    const evolutionResponse = await fetch(evolutionUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': whatsappConfig.evolution_api_key
      },
      body: req.method !== 'GET' ? await req.text() : undefined
    })

    const data = await evolutionResponse.json()

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
