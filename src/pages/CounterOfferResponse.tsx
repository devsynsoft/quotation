import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { customToast } from '../lib/toast';
import { Loader2, ArrowLeft, Check, X } from 'lucide-react';

interface PartResponse {
  description: string;
  quantity: number;
  original_price: number;
  original_total: number;
  counter_price: number;
  counter_total: number;
  discount_percentage: number;
  condition: string;
  available: boolean;
  delivery_time?: string;
  notes?: string;
  accepted?: boolean;
}

interface ResponseData {
  quotation_id: string;
  supplier_name: string;
  supplier_phone: string;
  parts: PartResponse[];
  total_price: number;
  delivery_time: string;
  notes: string;
}

interface CounterOffer {
  id: string;
  quotation_id: string;
  request_id: string;
  supplier_id: string;
  status: string;
  counter_offer_data: {
    supplier_name: string;
    supplier_phone: string;
    parts: PartResponse[];
    total_price: number;
    delivery_time?: string;
    notes?: string;
  };
  created_at: string;
}

export default function CounterOfferResponse() {
  const { id, requestId } = useParams();
  const [searchParams] = useSearchParams();
  const counterOfferId = searchParams.get('counter_offer_id');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [counterOffer, setCounterOffer] = useState<CounterOffer | null>(null);
  const [quotation, setQuotation] = useState<any>(null);
  const [response, setResponse] = useState<ResponseData>({
    quotation_id: '',
    supplier_name: '',
    supplier_phone: '',
    parts: [],
    total_price: 0,
    delivery_time: '',
    notes: ''
  });

  useEffect(() => {
    if (counterOfferId) {
      loadCounterOffer(counterOfferId);
    } else {
      customToast.error('ID da contraproposta não fornecido');
      setLoading(false);
    }
  }, [counterOfferId]);

  const loadCounterOffer = async (counterOfferId: string) => {
    setLoading(true);
    try {
      // Carrega os dados da contraproposta
      const { data: counterOfferData, error: counterOfferError } = await supabase
        .from('counter_offers')
        .select('*')
        .eq('id', counterOfferId)
        .single();

      if (counterOfferError) {
        console.error('Erro ao buscar contraproposta:', counterOfferError);
        throw counterOfferError;
      }

      console.log('Dados da contraproposta carregados:', counterOfferData);
      setCounterOffer(counterOfferData);
      
      // Verifica se a contraproposta já foi respondida
      if (counterOfferData.status === 'responded') {
        console.log('Esta contraproposta já foi respondida');
        setSubmitted(true);
      }

      // Carrega os dados da cotação original
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select('*')
        .eq('id', counterOfferData.quotation_id)
        .single();

      if (quotationError) {
        console.error('Erro ao buscar cotação:', quotationError);
        throw quotationError;
      }

      setQuotation(quotationData);

      // Inicializa a resposta com os dados da contraproposta
      if (counterOfferData.counter_offer_data && counterOfferData.counter_offer_data.parts) {
        // Filtra apenas as peças disponíveis
        const counterOfferParts = counterOfferData.counter_offer_data.parts
          .filter((part: PartResponse) => part.available !== false) // Inclui apenas peças disponíveis
          .map((part: PartResponse) => ({
            ...part,
            accepted: part.accepted !== undefined ? part.accepted : true
          }));

        setResponse({
          quotation_id: counterOfferData.quotation_id || '',
          supplier_name: counterOfferData.counter_offer_data.supplier_name || '',
          supplier_phone: counterOfferData.counter_offer_data.supplier_phone || '',
          parts: counterOfferParts,
          total_price: calculateAcceptedTotal(counterOfferParts),
          delivery_time: counterOfferData.counter_offer_data.delivery_time || '',
          notes: counterOfferData.counter_offer_data.notes || ''
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      customToast.error('Erro ao carregar dados da contraproposta');
    } finally {
      setLoading(false);
    }
  };

  const calculateAcceptedTotal = (parts: PartResponse[]) => {
    return parts
      .filter(part => part.accepted)
      .reduce((total, part) => total + (part.counter_price * part.quantity), 0);
  };

  const handlePartAcceptChange = (index: number, accepted: boolean) => {
    const updatedParts = [...response.parts];
    updatedParts[index] = { ...updatedParts[index], accepted };
    
    setResponse({
      ...response,
      parts: updatedParts,
      total_price: calculateAcceptedTotal(updatedParts)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!counterOffer) {
      customToast.error('Dados da contraproposta não encontrados');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Prepara os dados da resposta
      const responseData = {
        status: 'responded',
        response_data: JSON.parse(JSON.stringify({
          ...response,
          responded_at: new Date().toISOString()
        }))
      };
      
      // Atualiza a contraproposta com a resposta
      const { error } = await supabase
        .from('counter_offers')
        .update(responseData)
        .eq('id', counterOffer.id);
      
      if (error) throw error;
      
      // Atualiza a resposta original do fornecedor com os itens aceitos da contraproposta
      if (counterOffer.request_id) {
        // Primeiro, obtém a resposta atual
        const { data: requestData, error: requestError } = await supabase
          .from('quotation_requests')
          .select('*')
          .eq('id', counterOffer.request_id)
          .single();
        
        if (requestError) {
          console.error('Erro ao buscar resposta original:', requestError);
        } else if (requestData) {
          // Filtra apenas os itens aceitos da contraproposta
          const acceptedParts = response.parts.filter(part => part.accepted);
          
          // Prepara os dados atualizados da resposta
          let updatedResponseData = requestData.response_data || {};
          
          if (typeof updatedResponseData === 'string') {
            try {
              updatedResponseData = JSON.parse(updatedResponseData);
            } catch (e) {
              updatedResponseData = {};
            }
          }
          
          // Se não tiver parts, inicializa como array vazio
          if (!updatedResponseData.parts) {
            updatedResponseData.parts = [];
          }
          
          // Atualiza os itens aceitos e marca como negociados
          const updatedParts = updatedResponseData.parts.map((part: any) => {
            // Procura se este item foi aceito na contraproposta
            const acceptedPart = acceptedParts.find(
              p => p.description === part.description && p.quantity === part.quantity
            );
            
            if (acceptedPart) {
              // Se foi aceito, atualiza o preço e marca como negociado
              return {
                ...part,
                unit_price: acceptedPart.counter_price,
                total_price: acceptedPart.counter_total,
                negotiated: true // Marca como negociado
              };
            }
            
            return part;
          });
          
          // Atualiza o total
          const updatedTotal = updatedParts.reduce(
            (sum: number, part: any) => sum + (part.total_price || 0), 
            0
          );
          
          // Prepara os dados para atualização
          const updateData = {
            response_data: {
              ...updatedResponseData,
              parts: updatedParts,
              total_price: updatedTotal
            }
          };
          
          // Atualiza a resposta original
          const { error: updateError } = await supabase
            .from('quotation_requests')
            .update(updateData)
            .eq('id', counterOffer.request_id);
          
          if (updateError) {
            console.error('Erro ao atualizar resposta original:', updateError);
          }
        }
      }
      
      // Envia notificação para o solicitante (implementação futura)
      
      customToast.success('Resposta à contraproposta enviada com sucesso!');
      setSubmitted(true);
    } catch (err: any) {
      console.error('Erro ao enviar resposta à contraproposta:', err);
      customToast.error(err.message || 'Erro ao enviar resposta');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Carregando contraproposta...</span>
      </div>
    );
  }

  if (!counterOffer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-red-500 text-xl mb-4">Contraproposta não encontrada</div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-green-100 p-3 rounded-full">
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-4">Resposta Enviada!</h2>
          <p className="text-gray-600 text-center mb-6">
            Sua resposta à contraproposta foi enviada com sucesso. O solicitante será notificado.
          </p>
          <p className="text-sm text-gray-500 text-center mb-4">
            Esta contraproposta já foi respondida e não pode ser modificada. 
            Se necessário, entre em contato com o solicitante para uma nova negociação.
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center px-3 py-1 text-sm text-blue-500 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </button>
        <h1 className="text-2xl font-bold mt-2">Resposta à Contraproposta</h1>
        <p className="text-gray-600">
          Revise os valores propostos e indique quais itens você aceita.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Informações da Cotação</h2>
        {quotation && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Veículo</p>
              <p className="font-medium">
                {quotation.vehicles?.brand} {quotation.vehicles?.model} {quotation.vehicles?.year}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Data da Solicitação</p>
              <p className="font-medium">
                {new Date(quotation.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold">Itens da Contraproposta</h2>
            <p className="text-sm text-gray-500">
              Compare os valores originais e os valores propostos na contraproposta.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aceitar
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qtd
                  </th>
                  <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condição
                  </th>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Original
                  </th>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Proposto
                  </th>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Desconto
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {response.parts.length > 0 ? (
                  response.parts.map((part, index) => (
                    <tr key={index} className={part.accepted ? 'bg-green-50' : ''}>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handlePartAcceptChange(index, true)}
                            className={`p-1 rounded-full mr-1 ${
                              part.accepted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePartAcceptChange(index, false)}
                            className={`p-1 rounded-full ${
                              !part.accepted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {part.description}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {part.quantity}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                          part.condition === 'new'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {part.condition === 'new' ? 'Nova' : 'Usada'}
                        </span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        R$ {part.original_price.toFixed(2)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        R$ {part.counter_price.toFixed(2)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {part.discount_percentage}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">
                      Nenhum item encontrado na contraproposta
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-right text-sm font-medium text-gray-900">
                    Total dos itens aceitos:
                  </td>
                  <td colSpan={2} className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                    R$ {response.total_price.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Informações Adicionais</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prazo de Entrega
            </label>
            <input
              type="text"
              value={response.delivery_time}
              onChange={(e) => setResponse({...response, delivery_time: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Ex: 5 dias úteis"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={response.notes}
              onChange={(e) => setResponse({...response, notes: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md"
              rows={3}
              placeholder="Informações adicionais sobre a resposta..."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 mr-2 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar Resposta
          </button>
        </div>
      </form>
    </div>
  );
}
