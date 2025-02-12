import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Part {
  description: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  operation?: string;
  code?: string;
}

interface QuotationRequest {
  id: string;
  supplier: {
    name: string;
  };
  response_data?: {
    parts: {
      description: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      available: boolean;
    }[];
  };
}

interface Quotation {
  id: string;
  parts: Part[];
}

export function QuotationCompare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [requests, setRequests] = useState<QuotationRequest[]>([]);

  useEffect(() => {
    loadQuotationDetails();
  }, []);

  const loadQuotationDetails = async () => {
    try {
      setLoading(true);

      // Carrega a cotação
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select('*, parts')
        .eq('id', id)
        .single();

      if (quotationError) throw quotationError;

      // Carrega as solicitações de cotação
      const { data: requestsData, error: requestsError } = await supabase
        .from('quotation_requests')
        .select(`
          id,
          supplier:suppliers(name),
          response_data
        `)
        .eq('quotation_id', id)
        .eq('status', 'responded');

      if (requestsError) throw requestsError;

      setQuotation(quotationData);
      setRequests(requestsData);
    } catch (err) {
      console.error('Erro ao carregar detalhes da cotação:', err);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-500">Cotação não encontrada</p>
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
        Voltar para Detalhes da Cotação
      </button>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-6">Comparação de Cotações</h1>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Peça
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qtde
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Regulagem
                </th>
                {requests.map((request) => (
                  <th key={request.id} scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {request.supplier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotation.parts.map((part, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-4 text-sm text-gray-900">
                    {part.description}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900">
                    {part.code}
                  </td>
                  <td className="px-3 py-4 text-sm text-center text-gray-900">
                    {part.quantity}
                  </td>
                  <td className="px-3 py-4 text-sm text-right text-gray-900">
                    {part.unit_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  {requests.map((request) => {
                    const quotedPart = request.response_data?.parts.find(
                      (p) => p.description === part.description
                    );

                    if (!quotedPart?.available || !part.unit_price) {
                      return (
                        <td key={request.id} className="px-3 py-4 text-sm text-center text-gray-500">
                          -
                        </td>
                      );
                    }

                    const diff = calculateDifference(quotedPart.unit_price, part.unit_price);
                    const textColorClass = diff.isAbove ? 'text-red-600' : 'text-green-600';

                    return (
                      <td key={request.id} className="px-3 py-4 text-sm text-right">
                        <div>
                          {quotedPart.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className={textColorClass}>
                          {diff.value > 0 ? '+' : ''}
                          {diff.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          {' '}
                          ({diff.value > 0 ? '+' : ''}
                          {diff.percentage.toFixed(1)}%)
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default QuotationCompare;
