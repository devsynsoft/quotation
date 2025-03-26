import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ChevronRight, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Vehicle {
  brand: string;
  model: string;
  year: string;
}

interface Quotation {
  id: string;
  created_at: string;
  status?: string;
  vehicle_id: string;
  vehicles?: Vehicle;
  suppliers_count?: number;
  first_send_time?: string;
  last_send_time?: string;
  vehicle_image?: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'completed', label: 'Finalizada' },
  { value: 'in_progress', label: 'Em andamento' }
];

const QuotationsList = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadQuotations();
  }, [statusFilter]); // Recarrega quando o filtro de status muda

  const loadQuotations = async () => {
    try {
      let query = supabase
        .from('quotations')
        .select(`
          id,
          created_at,
          vehicle_id,
          vehicles (
            brand,
            model,
            year
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
          vehicle?.model?.toLowerCase().includes(searchLower) ||
          vehicle?.brand?.toLowerCase().includes(searchLower)
        );
      }) || [];

      // Buscar informações de envio para cada cotação
      const quotationsWithSendInfo = await Promise.all(filteredData.map(async (quotation) => {
        // Buscar todos os quotation_requests para esta cotação
        const { data: requestsData, error: requestsError } = await supabase
          .from('quotation_requests')
          .select('created_at, supplier_id')
          .eq('quotation_id', quotation.id)
          .order('created_at', { ascending: true });

        if (requestsError) {
          console.error('Erro ao buscar quotation_requests:', requestsError);
          return quotation;
        }

        // Buscar imagem do veículo
        let vehicleImage: string | undefined = undefined;
        if (quotation.vehicle_id) {
          try {
            // Buscar diretamente da tabela vehicles usando any para ignorar erros de tipo
            const { data: vehicleData, error: vehicleError } = await supabase
              .from('vehicles')
              .select('*')
              .eq('id', quotation.vehicle_id)
              .single();
              
            if (!vehicleError && vehicleData) {
              // Usar any para acessar o campo images
              const vehicle = vehicleData as any;
              if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
                vehicleImage = vehicle.images[0];
              }
            }
          } catch (error) {
            console.error('Erro ao buscar imagem do veículo:', error);
          }
        }

        if (requestsData && requestsData.length > 0) {
          // Contar fornecedores únicos
          const uniqueSuppliers = new Set(requestsData.map(req => req.supplier_id));
          
          // Obter o primeiro e último timestamp de envio
          const firstSendTime = requestsData[0].created_at;
          const lastSendTime = requestsData[requestsData.length - 1].created_at;

          return {
            ...quotation,
            suppliers_count: uniqueSuppliers.size,
            first_send_time: firstSendTime,
            last_send_time: lastSendTime,
            vehicle_image: vehicleImage
          };
        }

        return {
          ...quotation,
          vehicle_image: vehicleImage
        };
      }));

      setQuotations(quotationsWithSendInfo);
    } catch (err) {
      console.error('Erro ao carregar cotações:', err);
    } finally {
      setLoading(false);
    }
  };

  // Atualiza a busca quando o usuário digita
  useEffect(() => {
    const timer = setTimeout(() => {
      loadQuotations();
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (e: React.MouseEvent, quotationId: string) => {
    e.stopPropagation(); // Previne a navegação ao clicar no botão de excluir
    
    if (!window.confirm('Tem certeza que deseja excluir esta cotação?')) {
      return;
    }

    try {
      // Primeiro exclui os registros relacionados em quotation_requests
      const { error: requestsError } = await supabase
        .from('quotation_requests')
        .delete()
        .eq('quotation_id', quotationId);

      if (requestsError) throw requestsError;

      // Depois exclui a cotação
      const { error: quotationError } = await supabase
        .from('quotations')
        .delete()
        .eq('id', quotationId);

      if (quotationError) throw quotationError;

      toast.success('Cotação excluída com sucesso');
      loadQuotations(); // Recarrega a lista
    } catch (err) {
      console.error('Erro ao excluir cotação:', err);
      toast.error('Erro ao excluir cotação');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Cotações</h1>
        <button
          onClick={() => navigate('/quotation/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Nova Cotação
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar por modelo ou marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {quotations.map(quotation => (
          <div
            key={quotation.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-300 cursor-pointer"
            onClick={() => navigate(`/quotations/${quotation.id}`)}
          >
            <div className="flex items-center">
              {quotation.vehicle_image && (
                <div className="mr-4">
                  <img 
                    src={quotation.vehicle_image} 
                    alt={`${quotation.vehicles?.brand} ${quotation.vehicles?.model}`} 
                    className="w-16 h-16 object-cover rounded-md"
                  />
                </div>
              )}
              <div>
                <h3 className="font-medium">
                  {quotation.vehicles ? (
                    `${quotation.vehicles.brand} ${quotation.vehicles.model} ${quotation.vehicles.year}`
                  ) : (
                    'Veículo não encontrado'
                  )}
                </h3>
                <p className="text-sm text-gray-500">
                  {new Date(quotation.created_at).toLocaleDateString()}
                </p>
                {quotation.suppliers_count && (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Enviado para:</span> {quotation.suppliers_count} fornecedores
                    {quotation.first_send_time && quotation.last_send_time && (
                      <span className="ml-1">
                        ({new Date(quotation.first_send_time).toLocaleTimeString()} - {new Date(quotation.last_send_time).toLocaleTimeString()})
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className={`px-2 py-1 text-sm rounded-full ${
                quotation.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : quotation.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {quotation.status === 'pending' ? 'Pendente' :
                 quotation.status === 'completed' ? 'Finalizada' : 'Em andamento'}
              </span>
              <button
                onClick={(e) => handleDelete(e, quotation.id)}
                className="p-1 hover:bg-red-100 rounded-full transition-colors"
                title="Excluir cotação"
              >
                <Trash2 className="h-5 w-5 text-red-500" />
              </button>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        ))}

        {quotations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhuma cotação encontrada
          </div>
        )}
      </div>
    </div>
  );
};

export default QuotationsList;
