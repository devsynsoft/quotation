import { supabase } from '../lib/supabase';

export interface WhatsAppConfig {
  evolution_api_url: string;
  evolution_api_key: string;
  instance_name: string;
}

async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  try {
    // Buscar usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Buscar empresa do usuário
    const { data: companyUser, error: companyError } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (companyError || !companyUser?.company_id) {
      console.error('Erro ao buscar empresa:', companyError);
      return null;
    }

    // Buscar configuração do WhatsApp
    const { data: configs, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('company_id', companyUser.company_id);

    if (configError) {
      console.error('Erro ao buscar configuração:', configError);
      return null;
    }

    // Se não houver configuração, retorna null
    if (!configs || configs.length === 0) {
      return null;
    }

    // Retorna a primeira configuração
    return configs[0];
  } catch (error) {
    console.error('Erro ao buscar configuração do WhatsApp:', error);
    return null;
  }
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    const config = await getWhatsAppConfig();
    if (!config) {
      throw new Error('Configuração do WhatsApp não encontrada');
    }

    const baseUrl = config.evolution_api_url.replace(/\/+$/, '');
    const url = `${baseUrl}/message/sendText/${config.instance_name}`;
    
    console.log('Enviando mensagem:', {
      url,
      to,
      message
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolution_api_key
      },
      body: JSON.stringify({
        number: to,
        text: message
      })
    });

    console.log('Resposta:', {
      status: response.status,
      statusText: response.statusText
    });

    const text = await response.text();
    console.log('Resposta texto:', text);

    if (!response.ok) {
      throw new Error(`Erro ao enviar mensagem: ${text}`);
    }

    const data = JSON.parse(text);
    console.log('Resposta JSON:', data);

    return true;
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    throw err;
  }
}

export async function checkWhatsAppConnection(): Promise<boolean> {
  try {
    const config = await getWhatsAppConfig();
    if (!config) {
      throw new Error('Configuração do WhatsApp não encontrada');
    }

    const baseUrl = config.evolution_api_url.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/instance/connectionState/${config.instance_name}`, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolution_api_key
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao verificar conexão');
    }

    const data = await response.json();
    return data.state === 'open';
  } catch (error) {
    console.error('Erro ao verificar conexão:', error);
    return false;
  }
}

export async function generateQRCode(): Promise<string | null> {
  try {
    const config = await getWhatsAppConfig();
    if (!config) {
      throw new Error('Configuração do WhatsApp não encontrada');
    }

    const baseUrl = config.evolution_api_url.replace(/\/+$/, '');

    // Primeiro, criar instância se não existir
    const createResponse = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolution_api_key
      },
      body: JSON.stringify({
        instanceName: config.instance_name
      })
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new Error(`Erro ao criar instância: ${text}`);
    }

    // Depois, gerar QR Code
    const qrResponse = await fetch(`${baseUrl}/instance/qrcode/${config.instance_name}`, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolution_api_key
      }
    });

    if (!qrResponse.ok) {
      const text = await qrResponse.text();
      throw new Error(`Erro ao gerar QR Code: ${text}`);
    }

    const data = await qrResponse.json();
    return data.qrcode || null;
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
    return null;
  }
}
