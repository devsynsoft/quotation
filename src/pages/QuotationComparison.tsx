import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { ArrowLeft } from 'lucide-react';

interface Part {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  available: boolean;
}

interface QuotationRequest {
  id: string;
  supplier_id: string;
  status: string;
  response_data?: {
    supplier_name: string;
    supplier_phone: string;
    parts: Part[];
    total_price: number;
    delivery_time?: string;
    notes?: string;
  };
  responded_at?: string;
  supplier?: {
    name: string;
    phone: string;
  };
}

export function QuotationComparison() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<QuotationRequest[]>([]);
  const [uniqueParts, setUniqueParts] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      loadQuotationRequests();
    }
  }, [id]);

  const loadQuotationRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('quotation_requests')
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .eq('quotation_id', id)
        .eq('status', 'responded');

      if (error) throw error;

      setRequests(data || []);

      // Extrai todas as peças únicas
      const parts = new Set<string>();
      data?.forEach(request => {
        request.response_data?.parts.forEach(part => {
          parts.add(part.description);
        });
      });
      setUniqueParts(Array.from(parts));
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
      toast.error('Erro ao carregar respostas dos fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const findPartInRequest = (request: QuotationRequest, description: string) => {
    return request.response_data?.parts.find(p => p.description === description);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/quotations/${id}`)}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Detalhes
          </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Comparação de Cotações</h1>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peça
                    </th>
                    {requests.map(request => (
                      <th key={request.id} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {request.response_data?.supplier_name || request.supplier?.name}
                        <div className="text-gray-400 font-normal">
                          Prazo: {request.response_data?.delivery_time || 'Não informado'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {uniqueParts.map(partDescription => (
                    <tr key={partDescription}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {partDescription}
                      </td>
                      {requests.map(request => {
                        const part = findPartInRequest(request, partDescription);
                        return (
                          <td key={request.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {part ? (
                              part.available ? (
                                <div>
                                  <div className="font-medium text-gray-900">
                                    R$ {part.unit_price.toFixed(2)} / un
                                  </div>
                                  <div className="text-gray-500">
                                    Total: R$ {part.total_price.toFixed(2)}
                                  </div>
                                  {part.notes && (
                                    <div className="text-gray-400 text-xs mt-1">
                                      Obs: {part.notes}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-red-500">Não disponível</span>
                              )
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Total
                    </td>
                    {requests.map(request => (
                      <td key={request.id} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        R$ {request.response_data?.total_price.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
