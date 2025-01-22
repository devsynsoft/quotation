import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface QuotationResponse {
  id: string;
  response_data: {
    supplier_name: string;
    supplier_phone: string;
    parts: {
      description: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      notes?: string;
      delivery_time?: string;
      available: boolean;
    }[];
    total_price: number;
    delivery_time?: string;
    notes?: string;
  };
  responded_at: string;
}

interface SelectedPart {
  requestId: string;
  partIndex: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export default function QuotationCompare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState<any>(null);
  const [responses, setResponses] = useState<QuotationResponse[]>([]);
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [creatingOrder, setCreatingOrder] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      // Carrega a cotação
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select(`
          *,
          vehicle:vehicles(*)
        `)
        .eq('id', id)
        .single();

      if (quotationError) throw quotationError;

      // Carrega as respostas
      const { data: responsesData, error: responsesError } = await supabase
        .from('quotation_requests')
        .select('*')
        .eq('quotation_id', id)
        .eq('status', 'responded');

      if (responsesError) throw responsesError;

      setQuotation(quotationData);
      setResponses(responsesData || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handlePartSelect = (requestId: string, partIndex: number, selected: boolean) => {
    setSelectedParts(prev => {
      if (selected) {
        const response = responses.find(r => r.id === requestId);
        const part = response?.response_data.parts[partIndex];
        if (!response || !part) return prev;

        // Remove qualquer outra seleção para a mesma peça
        const filtered = prev.filter(p => p.partIndex !== partIndex);
        
        return [...filtered, {
          requestId,
          partIndex,
          quantity: part.quantity,
          unitPrice: part.unit_price,
          totalPrice: part.total_price
        }];
      } else {
        return prev.filter(p => !(p.requestId === requestId && p.partIndex === partIndex));
      }
    });
  };

  const createPurchaseOrder = async () => {
    if (!id || selectedParts.length === 0) return;

    try {
      setCreatingOrder(true);

      // Agrupa as peças por fornecedor
      const supplierParts = selectedParts.reduce((acc, part) => {
        if (!acc[part.requestId]) {
          acc[part.requestId] = [];
        }
        acc[part.requestId].push(part);
        return acc;
      }, {} as Record<string, SelectedPart[]>);

      // Cria uma ordem de compra para cada fornecedor
      for (const [requestId, parts] of Object.entries(supplierParts)) {
        const totalPrice = parts.reduce((sum, part) => sum + part.totalPrice, 0);

        // Cria a ordem de compra
        const { data: order, error: orderError } = await supabase
          .from('purchase_orders')
          .insert({
            quotation_id: id,
            total_price: totalPrice
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Cria os itens da ordem
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(
            parts.map(part => ({
              purchase_order_id: order.id,
              quotation_request_id: requestId,
              part_index: part.partIndex,
              quantity: part.quantity,
              unit_price: part.unitPrice,
              total_price: part.totalPrice
            }))
          );

        if (itemsError) throw itemsError;
      }

      toast.success('Ordens de compra criadas com sucesso!');
      navigate(`/quotations/${id}/orders`);
    } catch (err) {
      console.error('Erro ao criar ordens de compra:', err);
      toast.error('Erro ao criar ordens de compra');
    } finally {
      setCreatingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={() => navigate(`/quotations/${id}`)}
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar para Detalhes
      </button>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Comparar Cotações</h1>
          {selectedParts.length > 0 && (
            <button
              onClick={createPurchaseOrder}
              disabled={creatingOrder}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Gerar Ordem de Compra
                </>
              )}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Peça
                </th>
                {responses.map(response => (
                  <th key={response.id} className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {response.response_data.supplier_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotation.parts.map((part: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {part.description}
                    <br />
                    <span className="text-gray-500">Qtd: {part.quantity}</span>
                  </td>
                  {responses.map(response => {
                    const responsePart = response.response_data.parts[index];
                    return (
                      <td key={response.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {responsePart?.available ? (
                          <div className="space-y-1">
                            <p>R$ {responsePart.unit_price.toFixed(2)} / un</p>
                            <p>Total: R$ {responsePart.total_price.toFixed(2)}</p>
                            {responsePart.delivery_time && (
                              <p>Prazo: {responsePart.delivery_time}</p>
                            )}
                            <label className="inline-flex items-center mt-2">
                              <input
                                type="checkbox"
                                checked={selectedParts.some(
                                  p => p.requestId === response.id && p.partIndex === index
                                )}
                                onChange={e => handlePartSelect(response.id, index, e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                              />
                              <span className="ml-2">Selecionar</span>
                            </label>
                          </div>
                        ) : (
                          <span className="text-red-500">Não disponível</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Linha de Totais */}
              <tr className="bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Total Geral
                </td>
                {responses.map(response => (
                  <td key={response.id} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    R$ {response.response_data.total_price.toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
