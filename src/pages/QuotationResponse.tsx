import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { customToast } from '../lib/toast';
import { Loader2, Send, Printer, Check, X } from 'lucide-react';

interface Part {
  description: string;
  quantity: number;
  notes?: string;
}

interface PartResponse {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  delivery_time?: string;
  available: boolean;
  condition: 'new' | 'used';
}

interface Quotation {
  id: string;
  vehicle_id?: string;
  vehicle?: any;
  parts: Part[];
  status: 'pending' | 'responded';
}

interface QuotationResponse {
  quotation_id: string;
  supplier_name: string;
  supplier_phone: string;
  parts: PartResponse[];
  total_price: number;
  delivery_time?: string;
  notes?: string;
}

interface QuotationRequest {
  id: string;
  quotation_id: string;
  supplier_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  response_data?: any;
  responded_at?: string;
}

interface CounterOffer {
  id: string;
  quotation_id: string;
  request_id: string;
  supplier_id: string;
  counter_offer_data: {
    supplier_name: string;
    supplier_phone: string;
    parts: {
      description: string;
      quantity: number;
      original_price: number;
      original_total: number;
      counter_price: number;
      counter_total: number;
      discount_percentage: number;
      available: boolean;
      condition?: 'new' | 'used';
      notes?: string;
      accepted?: boolean;
    }[];
    total_price: number;
    delivery_time?: string;
    notes?: string;
  };
  status: string;
  response_data?: any;
  created_at: string;
  updated_at: string;
}

const QuotationResponse = () => {
  const { id, requestId } = useParams<{ id: string; requestId: string }>();
  const [searchParams] = useSearchParams();
  const counterOfferId = searchParams.get('counter_offer_id');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [request, setRequest] = useState<QuotationRequest | null>(null);
  const [response, setResponse] = useState<QuotationResponse>({
    quotation_id: id || '',
    supplier_name: '',
    supplier_phone: '',
    parts: [],
    total_price: 0,
    delivery_time: '',
    notes: ''
  });
  const [counterOffer, setCounterOffer] = useState<CounterOffer | null>(null);
  const [isCounterOffer, setIsCounterOffer] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (id && requestId) {
      console.log('Iniciando carregamento da cotação com ID:', id, 'e requestId:', requestId);
      
      if (counterOfferId) {
        console.log('Carregando contraproposta com ID:', counterOfferId);
        setIsCounterOffer(true);
        loadCounterOffer(counterOfferId);
      } else {
        loadQuotation(id, requestId);
      }
    }
  }, [id, requestId, counterOfferId]);

  useEffect(() => {
    console.log('Estado response atualizado:', response);
    console.log('Número de itens em response.parts:', response.parts ? response.parts.length : 0);
  }, [response]);

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

      // Carrega os dados da cotação original
      await loadQuotation(id!, requestId!, true);

      // Inicializa a resposta com os dados da contraproposta
      const counterOfferParts = counterOfferData.counter_offer_data.parts.map(part => ({
        ...part,
        accepted: part.accepted !== undefined ? part.accepted : true
      }));

      setResponse({
        quotation_id: id || '',
        supplier_name: counterOfferData.counter_offer_data.supplier_name,
        supplier_phone: counterOfferData.counter_offer_data.supplier_phone,
        parts: counterOfferParts,
        total_price: calculateAcceptedTotal(counterOfferParts),
        delivery_time: counterOfferData.counter_offer_data.delivery_time || '',
        notes: counterOfferData.counter_offer_data.notes || ''
      });

      if (counterOfferData.status === 'responded') {
        setSubmitted(true);
      }
    } catch (err: any) {
      console.error('Erro ao carregar contraproposta:', err);
      customToast.error(err.message || 'Erro ao carregar contraproposta');
    } finally {
      setLoading(false);
    }
  };

  const calculateAcceptedTotal = (parts: any[]) => {
    return parts.reduce((sum, part) => 
      sum + (part.available && (part.accepted !== false) ? (part.counter_total || 0) : 0), 0);
  };

  // Modificação da função loadQuotation para suportar contrapropostas
  const loadQuotation = async (quotationId: string, quotationRequestId: string, isForCounterOffer = false) => {
    setLoading(true);
    try {
      console.log('Iniciando carregamento da cotação:', quotationId, 'request:', quotationRequestId);
      
      // 1. Primeiro carrega os dados da solicitação de cotação
      const { data: requestData, error: requestError } = await supabase
        .from('quotation_requests')
        .select('*')
        .eq('id', quotationRequestId)
        .single();

      if (requestError) {
        console.error('Erro ao buscar solicitação de cotação:', requestError);
        throw requestError;
      }

      console.log('Dados da solicitação de cotação carregados:', requestData);
      setRequest(requestData);

      // 2. Verifica se a cotação já foi respondida
      if (requestData.status === 'responded') {
        console.log('Cotação já respondida, carregando dados da resposta');
        setSubmitted(true);
        
        // Verifica se há dados de resposta no objeto requestData
        if (requestData.response_data) {
          console.log('Tipo de requestData.response_data:', typeof requestData.response_data);
          
          // Tenta converter response_data para objeto se for string
          let responseData = requestData.response_data;
          
          if (typeof responseData === 'string') {
            console.log('Convertendo response_data de string para objeto');
            try {
              responseData = JSON.parse(responseData);
            } catch (parseError) {
              console.error('Erro ao fazer parse do JSON:', parseError);
              console.log('String original:', responseData);
            }
          }
            
          console.log('Estrutura de responseData após processamento:', responseData);
          
          if (responseData && responseData.parts && Array.isArray(responseData.parts)) {
            console.log('Usando partes de requestData.response_data:', responseData.parts);
            const formattedResponse = {
              quotation_id: responseData.quotation_id || quotationId,
              supplier_name: responseData.supplier_name || '',
              supplier_phone: responseData.supplier_phone || '',
              parts: responseData.parts,
              total_price: responseData.total_price || 0,
              delivery_time: responseData.delivery_time || '',
              notes: responseData.notes || ''
            };
            
            console.log('Dados da resposta formatados:', formattedResponse);
            setResponse(formattedResponse);
          } else {
            console.error('responseData não contém um array parts válido:', responseData);
          }
        } else {
          console.log('Cotação marcada como respondida, mas não há dados de resposta');
        }
      }
      
      // 3. Carrega os dados básicos da cotação
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select(`
          *,
          vehicles (
            id, brand, model, year, created_at
          )
        `)
        .eq('id', quotationId)
        .single();
      
      if (quotationError) {
        console.error('Erro ao carregar dados da cotação:', quotationError);
        setLoading(false);
        return;
      }
      
      console.log('Dados da cotação carregados:', quotationData);
      
      // 4. Cria uma cópia dos dados da cotação para adicionar informações adicionais
      let finalQuotationData = { 
        ...quotationData,
        vehicle: quotationData.vehicles,
        parts: [],
        status: quotationData.status || 'pending'
      };
      
      // 5. Busca os itens da cotação
      console.log('Buscando itens da cotação para ID:', quotationId);
      
      // Se a cotação já foi respondida, usa os dados de response_data
      if (requestData.status === 'responded' && requestData.response_data) {
        try {
          console.log('Tipo de requestData.response_data:', typeof requestData.response_data);
          
          // Tenta converter response_data para objeto se for string
          let responseData = requestData.response_data;
          
          if (typeof responseData === 'string') {
            console.log('Convertendo response_data de string para objeto');
            try {
              responseData = JSON.parse(responseData);
            } catch (parseError) {
              console.error('Erro ao fazer parse do JSON:', parseError);
              console.log('String original:', responseData);
            }
          }
            
          console.log('Estrutura de responseData após processamento:', responseData);
          
          if (responseData && responseData.parts && Array.isArray(responseData.parts)) {
            console.log('Usando partes de requestData.response_data:', responseData.parts);
            finalQuotationData.parts = responseData.parts;
          } else {
            console.error('responseData não contém um array parts válido:', responseData);
          }
        } catch (error) {
          console.error('Erro ao processar response_data:', error);
        }
      } else {
        // Se a cotação não foi respondida, busca os itens da coluna parts da tabela quotations
        console.log('Cotação não respondida, buscando parts da tabela quotations');
        
        // Verifica se quotationData já tem a propriedade parts
        if (quotationData.parts && Array.isArray(quotationData.parts)) {
          console.log('Usando parts já carregados de quotationData:', quotationData.parts);
          finalQuotationData.parts = quotationData.parts;
        }
      }
      
      // 6. Se não encontrou itens, exibe um erro
      if (!finalQuotationData.parts || finalQuotationData.parts.length === 0) {
        console.error('Nenhum item encontrado para a cotação');
      }
      
      // 7. Inicializa o estado response com os itens da cotação se ainda não foi inicializado e não for para contraproposta
      if (!isForCounterOffer) {
        // Se a cotação já foi respondida e temos os dados de resposta
        if (requestData.status === 'responded' && requestData.response_data) {
          try {
            console.log('Usando dados de resposta para inicializar o estado');
            
            // Tenta converter response_data para objeto se for string
            let responseData = requestData.response_data;
            
            if (typeof responseData === 'string') {
              responseData = JSON.parse(responseData);
            }
            
            if (responseData && responseData.parts && Array.isArray(responseData.parts)) {
              console.log('Usando partes de requestData.response_data para o estado:', responseData.parts);
              
              // Garante que todos os campos necessários estejam presentes
              const formattedResponse = {
                quotation_id: responseData.quotation_id || quotationId,
                supplier_name: responseData.supplier_name || '',
                supplier_phone: responseData.supplier_phone || '',
                parts: responseData.parts.map((part: any) => ({
                  description: part.description,
                  quantity: part.quantity,
                  unit_price: part.unit_price || 0,
                  total_price: part.total_price || 0,
                  available: part.available !== undefined ? part.available : true,
                  condition: part.condition || 'new',
                  notes: part.notes || ''
                })),
                total_price: responseData.total_price || 0,
                delivery_time: responseData.delivery_time || '',
                notes: responseData.notes || ''
              };
              
              console.log('Estado formatado com dados de resposta:', formattedResponse);
              setResponse(formattedResponse);
              setSubmitted(true);
            }
          } catch (error) {
            console.error('Erro ao processar response_data para o estado:', error);
          }
        } 
        // Se a cotação não foi respondida ou não temos dados de resposta, inicializa com os itens originais
        else if ((!response.parts || response.parts.length === 0) && finalQuotationData.parts.length > 0) {
          const initialParts = finalQuotationData.parts.map(part => ({
            description: part.description,
            quantity: part.quantity,
            unit_price: 0,
            total_price: 0,
            available: true,
            condition: 'new' as 'new' | 'used',
            notes: part.notes || ''
          }));
          
          console.log('Inicializando response com os itens originais da cotação:', initialParts);
          
          setResponse(prev => ({
            ...prev,
            quotation_id: quotationId,
            parts: initialParts,
            total_price: 0
          }));
        }
      }
      
      // 8. Atualiza o estado da cotação
      setQuotation(finalQuotationData);
      
    } catch (error) {
      console.error('Erro ao carregar cotação:', error);
      customToast.error('Erro ao carregar cotação. Por favor, tente novamente.');
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  };

  const handlePartChange = (index: number, field: string, value: any) => {
    setResponse(prev => {
      const newParts = [...prev.parts];
      
      if (field === 'condition') {
        newParts[index] = {
          ...newParts[index],
          [field]: value as 'new' | 'used'
        };
      } else {
        newParts[index] = {
          ...newParts[index],
          [field]: value
        };
      }

      if (field === 'available' && !value) {
        newParts[index].unit_price = 0;
        newParts[index].total_price = 0;
      }
      
      if (field === 'unit_price' && value > 0) {
        newParts[index].available = true;
      }

      if (field === 'unit_price' && newParts[index].available) {
        newParts[index].total_price = value * newParts[index].quantity;
      }

      const totalPrice = newParts.reduce((sum, part) => 
        sum + (part.available ? (part.total_price || 0) : 0), 0);

      return {
        ...prev,
        parts: newParts,
        total_price: totalPrice,
      };
    });
  };

  const handlePartAcceptance = (index: number, accepted: boolean) => {
    if (!counterOffer) return;

    setResponse(prev => {
      const newParts = [...prev.parts];
      newParts[index] = {
        ...newParts[index],
        accepted
      };

      // Recalcula o total apenas com as peças aceitas
      const totalPrice = calculateAcceptedTotal(newParts);

      return {
        ...prev,
        parts: newParts,
        total_price: totalPrice
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    if (!response.supplier_name.trim() || !response.supplier_phone.trim()) {
      customToast.error('Por favor, preencha seu nome e telefone');
      return;
    }

    if (response.parts.some(part => part.available && !part.unit_price)) {
      customToast.error('Por favor, preencha o preço de todas as peças disponíveis');
      return;
    }

    if (response.parts.some(part => part.available && !part.condition)) {
      customToast.error('Por favor, selecione a condição (nova ou usada) para todas as peças disponíveis');
      return;
    }

    try {
      setSubmitting(true);

      const { error: updateError } = await supabase
        .from('quotation_requests')
        .update({
          status: 'responded',
          response_data: response,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      customToast.success('Cotação enviada com sucesso!');
      setSubmitted(true);
    } catch (err: any) {
      console.error('Erro ao enviar cotação:', err);
      customToast.error(err.message || 'Erro ao enviar cotação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitCounterOfferResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !counterOffer) return;

    try {
      setSubmitting(true);

      // Prepara os dados da resposta
      const responseData = {
        parts: response.parts.map(part => ({
          description: part.description,
          quantity: part.quantity,
          original_price: part.original_price,
          counter_price: part.counter_price,
          counter_total: part.counter_total,
          discount_percentage: part.discount_percentage,
          available: part.available,
          condition: part.condition,
          accepted: part.accepted !== undefined ? part.accepted : true,
          notes: part.notes
        })),
        total_price: response.total_price,
        delivery_time: response.delivery_time,
        notes: response.notes,
        supplier_name: response.supplier_name,
        supplier_phone: response.supplier_phone
      };

      // Atualiza o status da contraproposta
      const allAccepted = response.parts.every(part => part.accepted !== false);
      const status = allAccepted ? 'accepted' : 'partially_accepted';

      const { error: updateError } = await supabase
        .from('counter_offers')
        .update({
          status: status,
          response_data: responseData,
          updated_at: new Date().toISOString()
        })
        .eq('id', counterOffer.id);

      if (updateError) throw updateError;

      // Atualiza a cotação original com os novos valores
      const { error: quotationUpdateError } = await supabase
        .from('quotation_requests')
        .update({
          response_data: {
            ...response,
            renegotiated: true
          }
        })
        .eq('id', requestId);

      if (quotationUpdateError) throw quotationUpdateError;

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6 print-container">
            <div className="mb-6 text-center print-header">
              <div className="mb-4 no-print">
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Cotação Enviada com Sucesso!
              </h2>
              <p className="text-gray-600 mb-6 no-print">
                Esta cotação já foi enviada e não pode ser alterada.
              </p>
              <p className="text-gray-900 font-bold print-only" style={{ display: 'none' }}>
                Cotação de Peças - {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-medium mb-2">Detalhes do Veículo</h2>
              <p>
                {quotation?.vehicle?.brand || 'N/A'} {quotation?.vehicle?.model || ''} {quotation?.vehicle?.year || ''}
                {quotation?.vehicle?.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  Nome do Fornecedor
                </label>
                <p className="text-gray-900">{response.supplier_name}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  Telefone do Fornecedor
                </label>
                <p className="text-gray-900">{response.supplier_phone}</p>
              </div>
            </div>

            <div className="overflow-x-auto mb-6">
              <h2 className="text-lg font-medium mb-4">Peças Cotadas</h2>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peça
                    </th>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qtde
                    </th>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Condição
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Un.
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {response.parts.length > 0 ? (
                    response.parts.map((part, index) => (
                      <tr key={index} className={part.available ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {part.description}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                          {part.available ? (
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                              part.condition === 'new'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {part.condition === 'new' ? 'Nova' : 'Usada'}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
                              Não disponível
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {part.available ? `R$ ${part.unit_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {part.available ? `R$ ${part.total_price.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">
                        Nenhuma peça encontrada na cotação.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                      Valor Total:
                    </td>
                    <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                      R$ {response.total_price.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
              {response.delivery_time && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Prazo de Entrega</h3>
                  <p className="mt-1 text-sm text-gray-900">{response.delivery_time}</p>
                </div>
              )}
              {response.notes && (
                <div className="sm:col-span-2">
                  <h3 className="text-sm font-medium text-gray-700">Observações</h3>
                  <p className="mt-1 text-sm text-gray-900">{response.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 text-center text-gray-500 text-sm no-print">
              <p>Esta cotação já foi enviada e não pode ser alterada.</p>
              <p className="mt-2">Se precisar de ajuda, entre em contato com o solicitante.</p>
            </div>
            <div className="mt-6 flex justify-center no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Cotação
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!quotation || !dataLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-red-500">Cotação não encontrada</p>
      </div>
    );
  }

  if (isCounterOffer && counterOffer) {
    if (loading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (submitted) {
      return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white shadow rounded-lg p-6 print-container">
              <div className="mb-6 text-center print-header">
                <div className="mb-4 no-print">
                  <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Resposta à Contraproposta Enviada!
                </h2>
                <p className="text-gray-600 mb-6 no-print">
                  Sua resposta à contraproposta foi enviada com sucesso.
                </p>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-medium mb-2">Detalhes do Veículo</h2>
                <p>
                  {quotation?.vehicle?.brand || 'N/A'} {quotation?.vehicle?.model || ''} {quotation?.vehicle?.year || ''}
                  {quotation?.vehicle?.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
                </p>
              </div>

              <div className="overflow-x-auto mb-6">
                <h2 className="text-lg font-medium mb-4">Itens da Contraproposta</h2>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Peça
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qtde
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Preço Original
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contraproposta
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {response.parts.map((part, index) => (
                      <tr key={index} className={!part.available ? 'bg-gray-100' : part.accepted ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {part.description}
                          {!part.available && <span className="ml-2 text-red-500">(Não disponível)</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {part.available ? `R$ ${part.original_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {part.available ? `R$ ${part.counter_price.toFixed(2)}` : '-'}
                          {part.available && part.condition && (
                            <div className="text-xs mt-1">
                              <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                part.condition === 'new'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {part.condition === 'new' ? 'Nova' : 'Usada'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                          {part.available ? (
                            part.accepted ? (
                              <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                Aceito
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
                                Recusado
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                              N/A
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        Valor Total Original:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        R$ {counterOffer.counter_offer_data.parts.reduce((sum, part) => 
                          sum + (part.available ? part.original_total : 0), 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                        Valor Total Contraproposta:
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                        R$ {response.total_price.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-6 text-center text-gray-500 text-sm no-print">
                <p>Esta resposta já foi enviada e não pode ser alterada.</p>
                <p className="mt-2">Aguarde o contato do solicitante para finalizar a negociação.</p>
              </div>
              <div className="mt-6 flex justify-center no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>CONTRAPROPOSTA:</strong> O cliente fez uma contraproposta para os itens abaixo. 
                    Você pode aceitar ou recusar cada item individualmente.
                  </p>
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-6">Responder Contraproposta</h1>

            <div className="mb-6">
              <h2 className="text-lg font-medium mb-2">Detalhes do Veículo</h2>
              <p>
                {quotation?.vehicle?.brand || 'N/A'} {quotation?.vehicle?.model || ''} {quotation?.vehicle?.year || ''}
                {quotation?.vehicle?.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
              </p>
            </div>

            <form onSubmit={handleSubmitCounterOfferResponse} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-2">
                    Nome do Fornecedor
                  </label>
                  <p className="text-gray-900">{response.supplier_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-2">
                    Telefone do Fornecedor
                  </label>
                  <p className="text-gray-900">{response.supplier_phone}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Peça
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qtde
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Preço Original
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contraproposta
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Desconto
                      </th>
                      <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {response.parts.map((part, index) => (
                      <tr key={index} className={!part.available ? 'bg-gray-100' : part.accepted ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {part.description}
                          {!part.available && <span className="ml-2 text-red-500">(Não disponível)</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {part.available ? `R$ ${part.original_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {part.available ? (
                            <div className="flex items-center gap-2">
                              <div>
                                R$ {part.counter_price.toFixed(2)} /un
                                <br />
                                <span className="text-xs text-green-500">
                                  -R$ {(part.original_price - part.counter_price).toFixed(2)} ({-part.discount_percentage}%)
                                </span>
                                <br />
                                <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                                  part.condition === 'new'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {part.condition === 'new' ? 'Nova' : 'Usada'}
                                </span>
                              </div>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                          {part.available ? `${part.discount_percentage}%` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                          {part.available && (
                            <div className="flex justify-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handlePartAcceptance(index, true)}
                                className={`p-1 rounded-full ${part.accepted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                                title="Aceitar"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePartAcceptance(index, false)}
                                className={`p-1 rounded-full ${part.accepted === false ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                                title="Recusar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        Valor Total Original:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        R$ {counterOffer.counter_offer_data.parts.reduce((sum, part) => 
                          sum + (part.available ? part.original_total : 0), 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                        Valor Total Contraproposta:
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                        R$ {response.total_price.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div>
                <h2 className="text-lg font-medium mb-4">Informações Gerais</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Prazo de Entrega
                    </label>
                    <input
                      type="text"
                      value={response.delivery_time}
                      onChange={e => setResponse(prev => ({ ...prev, delivery_time: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                      placeholder="Ex: 5 dias úteis"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Observações Gerais
                  </label>
                  <textarea
                    value={response.notes}
                    onChange={e => setResponse(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                    placeholder="Adicione observações relevantes sobre a contraproposta..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Resposta
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Responder Cotação</h1>

          <div className="mb-6">
            <h2 className="text-lg font-medium mb-2">Detalhes do Veículo</h2>
            <p>
              {quotation?.vehicle?.brand || 'N/A'} {quotation?.vehicle?.model || ''} {quotation?.vehicle?.year || ''}
              {quotation?.vehicle?.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  Nome do Fornecedor *
                </label>
                <input
                  type="text"
                  value={response.supplier_name}
                  onChange={e => setResponse(prev => ({ ...prev, supplier_name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-2 border-blue-200 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  required
                  placeholder="Digite seu nome completo"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  Telefone do Fornecedor *
                </label>
                <input
                  type="tel"
                  value={response.supplier_phone}
                  onChange={e => setResponse(prev => ({ ...prev, supplier_phone: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-2 border-blue-200 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  required
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Disponível
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peça
                    </th>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qtde
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Un.
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Condição
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {response.parts.length > 0 ? (
                    response.parts.map((part, index) => (
                      <tr key={index} className={part.available ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex justify-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handlePartChange(index, 'available', true)}
                              className={`px-3 py-1 rounded-md text-xs font-medium ${
                                part.available
                                  ? 'bg-green-100 text-green-800 border-2 border-green-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePartChange(index, 'available', false)}
                              className={`px-3 py-1 rounded-md text-xs font-medium ${
                                !part.available
                                  ? 'bg-red-100 text-red-800 border-2 border-red-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}
                            >
                              Não
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {part.description}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          <input
                            type="number"
                            value={part.unit_price}
                            onChange={e => handlePartChange(index, 'unit_price', parseFloat(e.target.value))}
                            className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                            min={0}
                            step={0.01}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          {part.available ? `R$ ${part.total_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => handlePartChange(index, 'condition', 'new')}
                              className={`px-3 py-1 rounded-md text-xs font-medium ${
                                part.condition === 'new'
                                  ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}
                            >
                              Nova
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePartChange(index, 'condition', 'used')}
                              className={`px-3 py-1 rounded-md text-xs font-medium ${
                                part.condition === 'used'
                                  ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}
                            >
                              Usada
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">
                        Nenhuma peça encontrada na cotação.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="text-lg font-medium mb-4">Informações Gerais</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Prazo de Entrega
                  </label>
                  <input
                    type="text"
                    value={response.delivery_time}
                    onChange={e => setResponse(prev => ({ ...prev, delivery_time: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                    placeholder="Ex: 5 dias úteis"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Valor Total
                  </label>
                  <p className="mt-2 text-lg font-medium">
                    R$ {response.total_price.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Observações Gerais
                </label>
                <textarea
                  value={response.notes}
                  onChange={e => setResponse(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                  placeholder="Adicione observações relevantes sobre a cotação..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Cotação
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default QuotationResponse;
