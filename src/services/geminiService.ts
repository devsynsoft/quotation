import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Configuração do Gemini
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const MODEL_NAME = 'gemini-1.5-pro'; // Atualizado para Gemini 1.5 Pro

// Inicializar o cliente Gemini
const genAI = new GoogleGenerativeAI(API_KEY);

// Configuração de segurança para o modelo
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

/**
 * Converte um arquivo PDF para um formato que pode ser enviado para o Gemini
 * @param file Arquivo PDF a ser processado
 * @returns Objeto contendo o arquivo em formato compatível com Gemini
 */
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  
  const base64EncodedData = await base64EncodedDataPromise;
  
  return {
    inlineData: {
      data: base64EncodedData.split(',')[1],
      mimeType: file.type,
    },
  };
};

/**
 * Extrai informações de veículo de um arquivo PDF usando o Gemini
 * @param pdfFile Arquivo PDF contendo informações do veículo
 * @returns Objeto com as informações extraídas do veículo
 */
export const extractVehicleInfoFromPDF = async (pdfFile: File) => {
  try {
    // Verificar se a API Key foi configurada
    if (!API_KEY) {
      console.error('API Key do Gemini não configurada');
      throw new Error('API Key do Gemini não configurada. Configure a variável de ambiente VITE_GEMINI_API_KEY.');
    }
    
    console.log('Iniciando processamento com Gemini. API Key configurada:', API_KEY ? 'Sim' : 'Não');

    // Converter o arquivo para o formato aceito pelo Gemini
    const filePart = await fileToGenerativePart(pdfFile);
    console.log('Arquivo convertido para formato compatível com Gemini');
    
    // Obter o modelo
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
    });
    console.log('Modelo Gemini inicializado:', MODEL_NAME);

    // Prompt específico para extração de informações de veículos
    const prompt = `
      Analise este documento PDF e extraia as seguintes informações sobre o veículo:
      - Marca (brand)
      - Modelo (model)
      - Ano (year)
      - Placa (plate)
      - Chassi/Chassis (chassis)
      
      Retorne APENAS um objeto JSON com esses campos, sem explicações adicionais.
      Se alguma informação não for encontrada, deixe o campo correspondente como string vazia.
      Formato esperado:
      {
        "brand": "MARCA_DO_VEICULO",
        "model": "MODELO_DO_VEICULO",
        "year": "ANO_DO_VEICULO",
        "plate": "PLACA_DO_VEICULO",
        "chassis": "CHASSI_DO_VEICULO"
      }
    `;
    
    console.log('Enviando solicitação para o Gemini com o prompt:', prompt);

    // Gerar conteúdo
    try {
      const result = await model.generateContent([prompt, filePart]);
      const response = await result.response;
      const text = response.text();
      
      console.log('Resposta recebida do Gemini:', text);
      
      // Extrair o JSON da resposta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Não foi possível extrair JSON da resposta do Gemini');
        throw new Error('Não foi possível extrair informações do veículo do PDF.');
      }
      
      // Parsear o JSON
      try {
        const vehicleInfo = JSON.parse(jsonMatch[0]);
        console.log('Informações extraídas com sucesso:', vehicleInfo);
        
        return {
          success: true,
          data: vehicleInfo,
        };
      } catch (jsonError) {
        console.error('Erro ao parsear JSON da resposta do Gemini:', jsonError, 'Texto original:', jsonMatch[0]);
        throw new Error('Erro ao processar a resposta do Gemini: formato inválido');
      }
    } catch (apiError: any) {
      console.error('Erro na chamada à API do Gemini:', apiError);
      throw new Error(`Erro na API do Gemini: ${apiError.message || 'Erro desconhecido'}`);
    }
  } catch (error: any) {
    console.error('Erro ao extrair informações do veículo com Gemini:', error);
    return {
      success: false,
      error: error.message || 'Erro ao processar o PDF com Gemini',
    };
  }
};
