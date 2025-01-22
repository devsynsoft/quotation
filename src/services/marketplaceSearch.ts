interface VehiclePart {
  description: string;
  code?: string;
  vehicle: {
    brand: string;
    model: string;
    year: string;
  };
}

interface CompanyInfo {
  state: string;
}

function formatSearchTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '-') // Substitui caracteres especiais por hífen
    .replace(/-+/g, '-') // Remove hífens duplicados
    .replace(/^-|-$/g, ''); // Remove hífens no início e fim
}

export function searchMercadoLivre(part: VehiclePart) {
  try {
    // Formata os termos de busca
    const brand = formatSearchTerm(part.vehicle.brand);
    const model = formatSearchTerm(part.vehicle.model);
    const year = part.vehicle.year;
    const description = formatSearchTerm(part.description);
    const code = part.code ? formatSearchTerm(part.code) : '';

    // Monta a URL de busca
    let url = `https://lista.mercadolivre.com.br/pecas-e-acessorios-${brand}-${model}-${year}-${description}`;
    
    // Adiciona o código se existir
    if (code) {
      url += `-${code}`;
    }

    // Abre em uma nova aba
    window.open(url, '_blank');
  } catch (error) {
    console.error('Erro ao buscar no Mercado Livre:', error);
  }
}

export function searchOLX(part: VehiclePart, company: CompanyInfo) {
  try {
    // Formata os termos de busca
    const brand = formatSearchTerm(part.vehicle.brand);
    const model = formatSearchTerm(part.vehicle.model);
    const year = part.vehicle.year;
    const description = formatSearchTerm(part.description);
    const code = part.code ? formatSearchTerm(part.code) : '';

    // Monta a URL de busca
    const baseUrl = 'https://www.olx.com.br/autos-e-pecas/pecas-e-acessorios';
    const searchUrl = new URL(`${baseUrl}/estado-${company.state.toLowerCase()}`);
    
    // Monta a query de busca
    const searchTerms = [brand, model, year, description, code]
      .filter(Boolean)
      .join(' ');
    
    searchUrl.searchParams.append('q', searchTerms);

    // Abre em uma nova aba
    window.open(searchUrl.toString(), '_blank');
  } catch (error) {
    console.error('Erro ao buscar na OLX:', error);
  }
}
