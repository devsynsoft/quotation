import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';

type Quotation = Database['public']['Tables']['quotations']['Row'];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'accepted', label: 'Aceita' },
  { value: 'rejected', label: 'Rejeitada' }
];

export function QuotationsList() {
  const [quotations, setQuotations] = React.useState<Quotation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  React.useEffect(() => {
    fetchQuotations();
  }, []);

  async function fetchQuotations() {
    try {
      let query = supabase
        .from('quotations')
        .select(`
          id,
          created_at,
          status,
          vehicle_id,
          vehicles (
            brand,
            model,
            year,
            chassis,
            plate
          ),
          parts (
            operation,
            code,
            description,
            quantity,
            painting_hours,
            unit_price,
            discount_percentage
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro na query:', error);
        throw error;
      }

      // Filtra os resultados com base na busca
      const filteredData = data?.filter(quotation => {
        if (!search) return true;
        
        const searchLower = search.toLowerCase();
        const vehicle = quotation.vehicles;
        
        return (
          vehicle?.plate?.toLowerCase().includes(searchLower) ||
          vehicle?.model?.toLowerCase().includes(searchLower) ||
          vehicle?.brand?.toLowerCase().includes(searchLower)
        );
      });

      setQuotations(filteredData || []);
    } catch (err) {
      console.error('Erro ao carregar cotações:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Atualiza a busca quando o usuário digita
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuotations();
    }, 300);

    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cotações</h1>
        <Link
          to="/quotations/new"
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Cotação
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por placa, modelo ou marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Veículo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    Nenhuma cotação encontrada
                  </td>
                </tr>
              ) : (
                quotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {quotation.vehicles?.brand} {quotation.vehicles?.model}
                        </div>
                        <div className="text-gray-500">
                          {quotation.vehicles?.year}
                          {quotation.vehicles?.plate && (
                            <span className="ml-2 font-medium">
                              Placa: {quotation.vehicles.plate}
                            </span>
                          )}
                        </div>
                        {quotation.vehicles?.chassis && (
                          <div className="text-gray-500 text-xs">
                            Chassis: {quotation.vehicles.chassis}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        <h4 className="font-medium mb-1">Peças:</h4>
                        <div className="space-y-1">
                          {quotation.parts.map((part, partIndex) => (
                            <div key={partIndex} className="flex items-start space-x-2">
                              <span className="text-gray-500">{part.operation}</span>
                              <span className="text-gray-500">{part.code}</span>
                              <span>{part.description}</span>
                              <span className="text-gray-500">({part.quantity}x)</span>
                              <span className="text-gray-500">
                                {part.unit_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              {part.discount_percentage > 0 && (
                                <span className="text-gray-500">(-{part.discount_percentage}%)</span>
                              )}
                              {part.painting_hours > 0 && (
                                <span className="text-gray-500">Pintura: {part.painting_hours}h</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${quotation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          quotation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'}`}>
                        {quotation.status === 'pending' ? 'Pendente' :
                         quotation.status === 'accepted' ? 'Aceita' : 'Rejeitada'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(quotation.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <Link
                        to={`/quotations/${quotation.id}`}
                        className="text-primary hover:text-primary/80"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}