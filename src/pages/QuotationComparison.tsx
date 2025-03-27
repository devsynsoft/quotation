import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { customToast } from '../lib/toast';
import { ArrowLeft, MessageCircle } from 'lucide-react';

interface Part {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  available: boolean;
  purchased?: boolean;
  purchase_date?: Date;
  purchase_price?: number;
  condition?: string;
}

interface QuotationPart {
  description: string;
  quantity: number;
  part_cost: number;
  operation?: string;
  code?: string;
}

interface Quotation {
  id: string;
  parts: QuotationPart[];
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
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [uniqueParts, setUniqueParts] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'parts' | 'total'>('parts');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Função para ordenar os requests
  const sortRequests = (requests: QuotationRequest[]) => {
    return [...requests].sort((a, b) => {
      if (sortBy === 'parts') {
        const partsA = a.response_data?.parts.filter(p => p.available).length || 0;
        const partsB = b.response_data?.parts.filter(p => p.available).length || 0;
        return sortOrder === 'desc' ? partsB - partsA : partsA - partsB;
      } else {
        const totalA = a.response_data?.total_price || 0;
        const totalB = b.response_data?.total_price || 0;
        return sortOrder === 'desc' ? totalB - totalA : totalA - totalB;
      }
    });
  };

  const sortedRequests = sortRequests(requests);

  useEffect(() => {
    if (id) {
      loadQuotationRequests();
    }
  }, [id]);

  const loadQuotationRequests = async () => {
    try {
      // Carrega a cotação original com os valores de regulagem
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select('*, parts')
        .eq('id', id)
        .single();

      if (quotationError) throw quotationError;
      setQuotation(quotationData);

      // Carrega as ordens de compra para esta cotação
      const { data: purchaseOrdersData, error: purchaseOrdersError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          created_at,
          items:purchase_order_items(
            id,
            quotation_part_index,
            unit_price,
            part_description
          )
        `)
        .eq('quotation_id', id);

      if (purchaseOrdersError) throw purchaseOrdersError;

      // Carrega as solicitações de cotação
      const { data, error } = await supabase
        .from('quotation_requests')
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .eq('quotation_id', id)
        .eq('status', 'responded');

      if (error) throw error;

      // Adiciona informações de compra nas peças
      const requestsWithPurchaseInfo = data?.map(request => {
        if (request.response_data?.parts) {
          request.response_data.parts = request.response_data.parts.map(part => {
            const purchaseOrder = purchaseOrdersData?.find(order => 
              order.items?.some(item => item.part_description === part.description)
            );
            const purchaseItem = purchaseOrder?.items?.find(item => 
              item.part_description === part.description
            );

            if (purchaseItem) {
              return {
                ...part,
                purchased: true,
                purchase_date: purchaseOrder.created_at,
                purchase_price: purchaseItem.unit_price
              };
            }
            return part;
          });
        }
        return request;
      });

      setRequests(requestsWithPurchaseInfo || []);

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
      customToast.error('Erro ao carregar respostas dos fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const findPartInRequest = (request: QuotationRequest, description: string) => {
    return request.response_data?.parts.find(p => p.description === description);
  };

  const findRegulationPart = (description: string) => {
    return quotation?.parts.find(p => p.description === description);
  };

  // Calcula a diferença em relação ao valor de regulagem
  const calculateDifference = (quotedPrice: number, regulationPrice: number) => {
    const difference = quotedPrice - regulationPrice;
    const percentage = (difference / regulationPrice) * 100;
    
    return {
      value: difference,
      percentage,
      isAbove: difference > 0
    };
  };

  // Formata o número para o padrão brasileiro (. para milhar e , para decimal)
  const formatBRL = (value: number) => {
    return value.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).replace(/^R\$\s*/, ''); // Remove o "R$ " pois já adicionamos manualmente
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
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Comparação de Cotações</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                  <label className="text-sm text-gray-600">Ordenar por:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'parts' | 'total')}
                    className="text-sm bg-white border border-gray-300 rounded-md py-1 px-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="parts">Peças Respondidas</option>
                    <option value="total">Valor Total</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="text-sm bg-white border border-gray-300 rounded-md py-1 px-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="desc">Maior → Menor</option>
                    <option value="asc">Menor → Maior</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Peça
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Regulagem
                  </th>
                  {sortedRequests.map(request => (
                    <th key={request.id} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <a href={`https://wa.me/55${request.response_data?.supplier_phone}`} target="_blank" rel="noopener noreferrer">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-green-500" />
                          {(request.response_data?.supplier_name || 'NÃO INFORMADO').toUpperCase()}
                        </div>
                      </a>
                      <br />
                      <span className="text-xs font-normal normal-case">
                        {request.response_data?.parts.filter(p => p.available).length || 0} peças disponíveis
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {uniqueParts.map((partDescription, index) => {
                  const regulationPart = quotation?.parts.find(p => p.description === partDescription);
                  return (
                    <tr key={index} className={`${
                      findPartInRequest(requests[0], partDescription)?.purchased ? 'bg-green-50' : 
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-start">
                          {findPartInRequest(requests[0], partDescription)?.purchased && (
                            <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{partDescription}</div>
                            {findPartInRequest(requests[0], partDescription)?.purchased && (
                              <div className="text-xs text-gray-600 mt-1">
                                <div>Comprada em: {new Date(findPartInRequest(requests[0], partDescription)?.purchase_date).toLocaleDateString('pt-BR')}</div>
                                <div>Valor: {findPartInRequest(requests[0], partDescription)?.purchase_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {regulationPart?.part_cost ? (
                          <div>
                            {regulationPart.part_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} /un
                            <br />
                            <span className="text-xs text-gray-500">
                              Total: {(regulationPart.part_cost * regulationPart.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        ) : '-'}
                      </td>
                      {sortedRequests.map(request => {
                        const part = findPartInRequest(request, partDescription);
                        const regulationPrice = regulationPart?.part_cost || 0;
                        const priceDifference = (part?.unit_price || 0) - regulationPrice;
                        const percentageDifference = regulationPrice > 0 
                          ? ((priceDifference / regulationPrice) * 100)
                          : 0;

                        return (
                          <td key={request.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {part ? (
                              part.available ? (
                                <div className="flex items-center gap-2">
                                  <div>
                                    {part.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} /un
                                    <br />
                                    <span className={`text-xs ${priceDifference > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                      {priceDifference > 0 ? '+' : ''}
                                      {priceDifference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      {' '}
                                      ({priceDifference > 0 ? '+' : ''}
                                      {percentageDifference.toFixed(1)}%)
                                    </span>
                                    <br />
                                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                                      part.condition === 'new' || !part.condition
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {part.condition === 'used' ? 'Usada' : 'Nova'}
                                    </span>
                                  </div>
                                  {sortedRequests.every(r => {
                                    const p = findPartInRequest(r, partDescription);
                                    return !p?.available || (p.available && part.unit_price <= p.unit_price);
                                  }) && '🏆'}
                                </div>
                              ) : (
                                <span className="text-red-500">Não disponível</span>
                              )
                            ) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {quotation?.parts.reduce((total, part) => total + (part.part_cost || 0) * part.quantity, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  {sortedRequests.map(request => (
                    <td key={request.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.response_data?.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
