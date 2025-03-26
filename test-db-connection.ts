import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kmcbhwubzvegiximdolp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttY2Jod3VienZlZ2l4aW1kb2xwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyNjEyMTksImV4cCI6MjA1MTgzNzIxOX0.2isOE82OTvRWshsYUdC83HC6ikx2raLAr8ZpIQlpLm0'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  try {
    const { data, error } = await supabase.from('suppliers').select('*').limit(1)
    
    if (error) {
      console.error('Erro na conexão:', error.message)
      return
    }
    
    console.log('Conexão estabelecida com sucesso!')
    console.log('Número de registros retornados:', data.length)
  } catch (err) {
    console.error('Erro ao tentar conectar:', err)
  }
}

testConnection()
