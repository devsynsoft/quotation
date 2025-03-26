import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { customToast } from '../lib/toast';
import { Loader2, Send, Printer } from 'lucide-react';

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
  vehicle?: {
    brand: string;
    model: string;
    year: string;
    chassis?: string;
    images?: string[];
  };
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
  response_data?: QuotationResponse; 
  responded_at?: string;
}

const QuotationResponse = () => {
  const { id, requestId } = useParams<{ id: string; requestId: string }>();
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
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (id && requestId) {
      loadQuotation(id, requestId);
    }
  }, [id, requestId]);

  useEffect(() => {
    if (quotation) {
      // Se não houver resposta já carregada dos dados salvos
      if (!response.parts.length) {
        const initialParts = quotation.parts.map(part => ({
          description: part.description,
          quantity: part.quantity,
          unit_price: 0,
          total_price: 0,
          notes: part.notes || '',
          available: true,
          condition: 'new' as 'new' | 'used'
        }));

        setResponse({
          quotation_id: quotation.id,
          supplier_name: '',
          supplier_phone: '',
          parts: initialParts,
          total_price: 0,
          delivery_time: '',
          notes: ''
        });
      }
      
      // Log para debug
      console.log('Inicializando response com os dados da cotação:', response);
    }
  }, [quotation]);

  useEffect(() => {
    console.log('Estado atual - response:', response);
    console.log('Estado atual - quotation:', quotation);
    console.log('Estado atual - request:', request);
    console.log('Estado atual - submitted:', submitted);
  }, [response, quotation, request, submitted]);

  const loadQuotation = async (quotationId: string, quotationRequestId: string) => {
    setLoading(true);
    try {
      // 1. Primeiro carrega os dados da solicitação de cotação
      const { data: requestData, error: requestError } = await supabase
        .from('quotation_requests')
        .select('*, response_data')
        .eq('id', quotationRequestId)
        .single();

      if (requestError) {
        console.error('Erro ao buscar solicitação de cotação:', requestError);
        throw requestError;
      }

      console.log('Dados da solicitação de cotação carregados:', requestData);

      // 2. Verifica se a cotação já foi respondida
      if (requestData.status === 'responded') {
        setRequest(requestData);
        setSubmitted(true);
        
        if (requestData.response_data) {
          console.log('Dados da resposta carregados:', requestData.response_data);
          const responseData = requestData.response_data;
        
          // Garante que todos os campos necessários estejam presentes
          const formattedResponse = {
            quotation_id: responseData.quotation_id || quotationId,
            supplier_name: responseData.supplier_name || '',
            supplier_phone: responseData.supplier_phone || '',
            parts: responseData.parts || [],
            total_price: responseData.total_price || 0,
            delivery_time: responseData.delivery_time || '',
            notes: responseData.notes || ''
          };
        
          console.log('Dados da resposta formatados:', formattedResponse);
          setResponse(formattedResponse);
        } else {
          console.error('Resposta marcada como respondida, mas não há dados de resposta');
          customToast.error('Não foi possível carregar os dados da resposta');
        }
      } else {
        setRequest(requestData);
      }

      // 3. Carrega os dados básicos da cotação
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select('*')
        .eq('id', quotationId)
        .single();

      if (quotationError) {
        console.error('Erro ao buscar cotação:', quotationError);
        throw quotationError;
      }
      
      console.log('Dados da cotação carregados:', quotationData);
      
      // 4. Cria uma cópia dos dados da cotação para adicionar informações adicionais
      let finalQuotationData = { ...quotationData };
      
      // 5. Busca os dados do veículo separadamente
      if (quotationData && quotationData.vehicle_id) {
        try {
          const { data: vehicleData, error: vehicleError } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', quotationData.vehicle_id)
            .single();
          
          if (vehicleError) {
            console.error('Erro ao buscar veículo:', vehicleError);
          } else if (vehicleData) {
            console.log('Dados do veículo carregados:', vehicleData);
            finalQuotationData.vehicle = vehicleData;
          }
        } catch (vehicleErr) {
          console.error('Exceção ao buscar veículo:', vehicleErr);
        }
      }
      
      // 6. Busca os itens da cotação
      try {
        console.log('Tentando buscar itens da cotação com ID:', quotationId);
        
        // Tenta primeiro na tabela quotation_items
        const { data: quotationItemsData, error: quotationItemsError } = await supabase
          .from('quotation_items')
          .select('*')
          .eq('quotation_id', quotationId);
        
        if (quotationItemsError) {
          console.error('Erro ao buscar itens da cotação em quotation_items:', quotationItemsError);
          
          // Se falhar, tenta na tabela quotation_parts
          const { data: quotationPartsData, error: quotationPartsError } = await supabase
            .from('quotation_parts')
            .select('*')
            .eq('quotation_id', quotationId);
            
          if (quotationPartsError) {
            console.error('Erro ao buscar itens da cotação em quotation_parts:', quotationPartsError);
          } else if (quotationPartsData && quotationPartsData.length > 0) {
            console.log('Itens da cotação carregados de quotation_parts:', quotationPartsData);
            finalQuotationData.parts = quotationPartsData;
          } else {
            console.log('Nenhum item encontrado em quotation_parts');
          }
        } else if (quotationItemsData && quotationItemsData.length > 0) {
          console.log('Itens da cotação carregados de quotation_items:', quotationItemsData);
          finalQuotationData.parts = quotationItemsData;
        } else {
          console.log('Nenhum item encontrado em quotation_items');
        }
        
        // 7. Se não encontrou peças nas tabelas, mas tem nos dados da resposta, usa esses
        if (requestData.response_data && requestData.response_data.parts) {
          console.log('Peças encontradas nos dados da resposta:', requestData.response_data.parts);
          if (!finalQuotationData.parts || finalQuotationData.parts.length === 0) {
            finalQuotationData.parts = requestData.response_data.parts;
          }
        }
      } catch (itemsErr) {
        console.error('Exceção ao buscar itens da cotação:', itemsErr);
      }
      
      // 8. Atualiza o estado com os dados finais
      console.log('Dados finais da cotação:', finalQuotationData);
      setQuotation(finalQuotationData);
      setDataLoaded(true);
    } catch (err: any) {
      console.error('Erro ao carregar cotação:', err);
      customToast.error(err.message || 'Erro ao carregar cotação');
    } finally {
      setLoading(false);
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
        <style type="text/css" media="print">
          {`
            @page { size: auto; margin: 10mm; }
            @media print {
              body { background-color: #fff; }
              .no-print { display: none !important; }
              .print-only { display: block !important; }
              .print-container { box-shadow: none !important; padding: 0 !important; }
              .print-header { text-align: center; margin-bottom: 20px; }
            }
          `}
        </style>
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
                Esta cotação já foi respondida. Abaixo estão os detalhes da sua resposta.
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
                  className="mt-1 block w-full rounded-md border-2 border-blue-200 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                  className="mt-1 block w-full rounded-md border-2 border-blue-200 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                          <input
                            type="checkbox"
                            checked={part.available}
                            onChange={e => handlePartChange(index, 'available', e.target.checked)}
                            className="rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                          />
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
                          <select
                            value={part.condition}
                            onChange={e => handlePartChange(index, 'condition', e.target.value as 'new' | 'used')}
                            className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                          >
                            <option value="new">Nova</option>
                            <option value="used">Usada</option>
                          </select>
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
                    className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-5 py-2"
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
                  className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-5 py-2"
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
