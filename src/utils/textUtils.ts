import { supabase } from '../lib/supabase';

let cachedAbbreviations: Map<string, string> | null = null;

async function loadAbbreviations(): Promise<Map<string, string>> {
  if (cachedAbbreviations) return cachedAbbreviations;

  const { data, error } = await supabase
    .from('text_abbreviations')
    .select('abbreviation, full_text');

  if (error) throw error;

  const map = new Map<string, string>();
  data?.forEach(row => map.set(row.abbreviation, row.full_text));
  cachedAbbreviations = map;
  return map;
}

export async function expandAbbreviations(text: string): Promise<string> {
  // Remove (I) e (f)
  let expandedText = text.replace(/\([If]\)/g, '').trim();

  try {
    const abbreviations = await loadAbbreviations();

    // Substitui abreviações
    for (const [abbr, full] of abbreviations) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'g');
      expandedText = expandedText.replace(regex, full);
    }
  } catch (error) {
    console.error('Erro ao carregar abreviações:', error);
  }

  return expandedText;
}

// Função para limpar o cache quando as abreviações são atualizadas
export function clearAbbreviationsCache() {
  cachedAbbreviations = null;
}
