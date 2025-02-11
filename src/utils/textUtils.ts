export const abbreviationMap = new Map<string, string>([
  ['CJ', 'Conjunto'],
  ['SUP', 'Suporte'],
  ['P-CHOQ', 'Para-choque'],
  ['DIA', 'Dianteiro'],
  ['ESQ', 'Esquerdo'],
  ['NEBL', 'Neblina'],
  ['E', 'Esquerdo'],
  ['MOLD', 'Moldura'],
  ['P-CHOQUE', 'Para-choque'],
  ['DT', 'Dianteiro'],
  ['VÁLV', 'Válvula'],
  ['LIMPAD', 'Limpador'],
  ['P-BARRO', 'Para-barro'],
  ['ANT', 'Anterior'],
  ['REF', 'Refletor']
]);

export function expandAbbreviations(text: string): string {
  // Remove (I) e (f)
  let expandedText = text.replace(/\([If]\)/g, '').trim();

  // Substitui abreviações
  for (const [abbr, full] of abbreviationMap) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'g');
    expandedText = expandedText.replace(regex, full);
  }

  return expandedText;
}
