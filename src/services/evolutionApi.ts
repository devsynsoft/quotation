import { supabase } from '../lib/supabase';

interface WhatsAppConfig {
  instance_name: string;
  evolution_api_key: string;
  evolution_api_url: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  user_id: string;
  sequence: number;
}

interface SendWhatsAppMessageParams {
  areaCode: string;
  phone: string;
  message: string;
  userId?: string;
  imageUrl?: string;
  documentUrl?: string;
  useTemplates?: boolean;
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

async function getMessageTemplates(): Promise<MessageTemplate[]> {
  try {
    const { data: templates, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('sequence', { ascending: true });

    if (error) {
      console.error('Erro ao buscar templates:', error);
      return [];
    }

    return templates || [];
  } catch (error) {
    console.error('Erro ao buscar templates:', error);
    return [];
  }
}

export async function sendWhatsAppMessage({
  areaCode,
  phone,
  message,
  userId,
  imageUrl,
  documentUrl,
  useTemplates = false
}: SendWhatsAppMessageParams): Promise<{ error?: Error }> {
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

    if (useTemplates) {
      // Busca os templates e envia cada um em sequência
      const templates = await getMessageTemplates();
      
      for (const template of templates) {
        // Extrai os valores das variáveis da mensagem original
        const variables: { [key: string]: string } = {};
        
        // Extrai vehicle_brand, vehicle_model, vehicle_year, vehicle_chassis
        const vehicleRegex = /{(vehicle_[^}]+)}([^{]+)/g;
        let match;
        while ((match = vehicleRegex.exec(message)) !== null) {
          const [, key, value] = match;
          variables[key] = value.trim();
        }

        // Extrai parts_list - todo o texto entre {parts_list} e o próximo {
        const partsMatch = message.match(/{parts_list}([^{]+)/);
        if (partsMatch) {
          variables['parts_list'] = partsMatch[1].trim();
        }

        // Extrai quotation_link - todo o texto entre {quotation_link} e o próximo {
        const linkMatch = message.match(/{quotation_link}([^{]+)/);
        if (linkMatch) {
          variables['quotation_link'] = linkMatch[1].trim();
        }

        // Substitui as variáveis no template
        let processedMessage = template.content;
        Object.entries(variables).forEach(([key, value]) => {
          processedMessage = processedMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        });

        // Envia o template processado
        const textResponse = await fetch(`${baseUrl}/message/sendText/${config.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.evolution_api_key
          },
          body: JSON.stringify({
            number: fullPhone,
            text: processedMessage
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

        // Aguarda um pequeno intervalo entre as mensagens
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      // Envia a mensagem normalmente
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
    }

    // Se houver imagem, envia depois das mensagens de texto
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

    // Se houver documento PDF, envia depois das mensagens de texto e imagem
    if (documentUrl) {
      console.log('Tentando enviar documento PDF:', {
        phone: fullPhone
      });

      // Se o documentUrl estiver no formato data URI (data:application/pdf;base64,XXXXX),
      // extrair apenas a parte base64
      let documentData = documentUrl;
      if (documentUrl.startsWith('data:application/pdf;base64,')) {
        documentData = documentUrl.replace('data:application/pdf;base64,', '');
        console.log('Documento convertido para formato base64');
      }

      const documentResponse = await fetch(`${baseUrl}/message/sendMedia/${config.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.evolution_api_key
        },
        body: JSON.stringify({
          number: fullPhone,
          media: documentData,
          mediatype: 'document',
          fileName: 'ordem_de_compra.pdf',
          caption: 'Ordem de Compra - PDF'
        })
      });

      const responseDocumentData = await documentResponse.json().catch(() => null);
      console.log('Resposta do envio do documento:', responseDocumentData);

      if (!documentResponse.ok) {
        console.error('Erro ao enviar documento:', {
          status: documentResponse.status,
          statusText: documentResponse.statusText,
          data: responseDocumentData
        });
        throw new Error(`Erro ao enviar documento: ${documentResponse.statusText}`);
      }
    }

    return {};
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return { error: error as Error };
  }
}

export async function sendBulkWhatsAppMessages(
  messages: { areaCode: string; phone: string; message: string; imageUrl?: string; documentUrl?: string }[],
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
