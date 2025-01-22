import { ShoppingCart, Search } from 'lucide-react';
import { searchMercadoLivre, searchOLX } from '../../services/marketplaceSearch';

interface MarketplaceSearchProps {
  description: string;
  code?: string;
  vehicle: {
    brand: string;
    model: string;
    year: string;
  };
  companyState: string;
}

export function MarketplaceSearch({ description, code, vehicle, companyState }: MarketplaceSearchProps) {
  const handleMercadoLivreSearch = () => {
    searchMercadoLivre({
      description,
      code,
      vehicle
    });
  };

  const handleOLXSearch = () => {
    searchOLX(
      {
        description,
        code,
        vehicle
      },
      { state: companyState }
    );
  };

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={handleMercadoLivreSearch}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 rounded-md transition-colors"
        title="Pesquisar no Mercado Livre"
      >
        <ShoppingCart className="w-4 h-4 mr-1" />
        Mercado Livre
      </button>
      
      <button
        onClick={handleOLXSearch}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-800 bg-purple-100 hover:bg-purple-200 rounded-md transition-colors"
        title="Pesquisar na OLX"
      >
        <Search className="w-4 h-4 mr-1" />
        OLX
      </button>
    </div>
  );
}
