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
  userId,
  imageUrl
}: {
  areaCode: string;
  phone: string;
  message: string;
  userId?: string;
  imageUrl?: string;
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

    // Primeiro envia a mensagem de texto
    const textResponse = await fetch(`${baseUrl}/message/sendText/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolution_api_key
      },
      body: JSON.stringify({
        number: fullPhone,
        text: message
      })
    });

    if (!textResponse.ok) {
      const errorData = await textResponse.json().catch(() => textResponse.text());
      console.error('Resposta da API (texto):', {
        status: textResponse.status,
        statusText: textResponse.statusText,
        error: errorData
      });
      throw new Error(`Erro ao enviar mensagem: ${textResponse.statusText}`);
    }

    // Se houver imagem, envia depois da mensagem
    if (imageUrl) {
      console.log('Tentando enviar imagem:', {
        url: imageUrl,
        phone: fullPhone
      });

      const mediaResponse = await fetch(`${baseUrl}/message/sendMedia/${config.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.evolution_api_key
        },
        body: JSON.stringify({
          number: fullPhone,
          media: imageUrl,
          mediatype: 'image',
          caption: 'Foto do veículo'
        })
      });

      const mediaData = await mediaResponse.json().catch(() => null);
      console.log('Resposta do envio da mídia:', mediaData);

      if (!mediaResponse.ok) {
        console.error('Erro ao enviar imagem:', {
          status: mediaResponse.status,
          statusText: mediaResponse.statusText,
          data: mediaData
        });
        throw new Error(`Erro ao enviar imagem: ${mediaResponse.statusText}`);
      }
    }

    return {};
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return { error: error as Error };
  }
}

export async function sendBulkWhatsAppMessages(
  messages: { areaCode: string; phone: string; message: string; imageUrl?: string }[],
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
