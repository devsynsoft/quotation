import { supabase } from '../lib/supabase';

interface WhatsAppConfig {
  instance_name: string;
  evolution_api_key: string;
  evolution_api_url: string;
}

export async function getWhatsAppConfig(userId: string): Promise<WhatsAppConfig | null> {
  try {
    const { data: configs, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('instance_name, evolution_api_key, evolution_api_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (configError) {
      console.error('Erro ao buscar configuração do WhatsApp:', configError);
      return null;
    }

    if (!configs) {
      console.error('Nenhuma configuração do WhatsApp encontrada');
      return null;
    }

    if (!configs.instance_name || !configs.evolution_api_key || !configs.evolution_api_url) {
      console.error('Configuração do WhatsApp incompleta');
      return null;
    }

    return configs;
  } catch (error) {
    console.error('Erro ao buscar configuração do WhatsApp:', error);
    return null;
  }
}

export async function sendWhatsAppMessage({
  areaCode,
  phone,
  message,
  userId
}: {
  areaCode: string;
  phone: string;
  message: string;
  userId?: string;
}): Promise<{ error?: Error }> {
  try {
    const config = await getWhatsAppConfig(userId || (await supabase.auth.getUser()).data.user?.id || '');
    if (!config) {
      throw new Error('Configuração do WhatsApp não encontrada');
    }

    // Remove caracteres não numéricos do telefone e área
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanArea = areaCode.replace(/\D/g, '');
    
    // Monta o número completo: 55 + DDD + número
    const fullPhone = `55${cleanArea}${cleanPhone}`;

    // Verifica se o número tem pelo menos 12 dígitos (55 + DDD + número)
    if (fullPhone.length < 12) {
      throw new Error(`Número de telefone inválido: (${cleanArea}) ${cleanPhone}. O número deve conter DDI (55), DDD e o número.`);
    }

    // Normaliza a URL base removendo barras duplicadas
    const baseUrl = config.evolution_api_url.replace(/\/+$/, '');
    const url = `${baseUrl}/message/sendText/${config.instance_name}`;

    const payload = {
      number: fullPhone,
      text: message
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolution_api_key
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => response.text());
      console.error('Resposta da API:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`Erro ao enviar mensagem: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Mensagem enviada com sucesso:', data);
    return {};
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return { error: error as Error };
  }
}

export async function sendBulkWhatsAppMessages(
  messages: { areaCode: string; phone: string; message: string }[],
  userId: string
): Promise<{ success: boolean; errors: Error[] }> {
  const errors: Error[] = [];
  
  for (const msg of messages) {
    const { error } = await sendWhatsAppMessage({
      ...msg,
      userId
    });
    
    if (error) {
      errors.push(error);
    }
  }

  return {
    success: errors.length === 0,
    errors
  };
}

export async function checkEvolutionConnection(
  instanceName: string,
  apiKey: string,
  baseUrl: string
): Promise<{ instance?: { state: string }; qrcode?: string; error?: string }> {
  try {
    // Normaliza a URL base removendo barras duplicadas
    const normalizedUrl = baseUrl.trim().replace(/\/+$/, '');
    const url = `${normalizedUrl}/instance/connectionState/${instanceName}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'apikey': apiKey.trim()
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Evolution API error:', error);
    return {
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}
