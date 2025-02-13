import { supabase } from '../lib/supabase';

// Cache de abreviações para evitar consultas desnecessárias ao banco
let abbreviationsCache: { abbreviation: string; full_text: string }[] | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Carrega abreviações do banco ou do cache
export const loadAbbreviations = async () => {
  // Se o cache existe e ainda é válido, retorna ele
  const now = Date.now();
  if (abbreviationsCache && (now - lastCacheUpdate) < CACHE_TTL) {
    return abbreviationsCache;
  }

  // Caso contrário, carrega do banco
  const { data, error } = await supabase
    .from('text_abbreviations')
    .select('abbreviation, full_text')
    .order('abbreviation');

  if (error) throw error;

  // Atualiza o cache
  abbreviationsCache = data;
  lastCacheUpdate = now;

  return data;
};

// Limpa o cache forçando recarregamento na próxima chamada
export const clearAbbreviationsCache = () => {
  abbreviationsCache = null;
};

// Processa o texto substituindo todas as abreviações conhecidas
export const processText = async (text: string): Promise<string> => {
  const abbreviations = await loadAbbreviations();
  
  // Converte para maiúsculas para fazer o match
  let processedText = text.toUpperCase();

  // Substitui cada abreviação pelo texto completo
  for (const { abbreviation, full_text } of abbreviations) {
    // Usa regex para substituir apenas palavras inteiras
    const regex = new RegExp(`\\b${abbreviation}\\b`, 'g');
    processedText = processedText.replace(regex, full_text);
  }

  return processedText;
};
