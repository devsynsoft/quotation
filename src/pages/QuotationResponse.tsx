import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { Loader2, Send } from 'lucide-react';

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
}

interface Quotation {
  id: string;
  vehicle: {
    brand: string;
    model: string;
    year: string;
    chassis?: string;
    images?: string[];
  };
  parts: Part[];
  images?: string[];
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

const QuotationResponse = () => {
  const { id, requestId } = useParams<{ id: string; requestId: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [request, setRequest] = useState<any>(null);
  const [response, setResponse] = useState<QuotationResponse>({
    quotation_id: id || '',
    supplier_name: '',
    supplier_phone: '',
    parts: [],
    total_price: 0,
  });

  useEffect(() => {
    if (id && requestId) {
      loadQuotation(id, requestId);
    }
  }, [id, requestId]);

  const loadQuotation = async (quotationId: string, quotationRequestId: string) => {
    try {
      // Primeiro verifica se a solicitação existe
      const { data: requestData, error: requestError } = await supabase
        .from('quotation_requests')
        .select('*, supplier:suppliers(*)')
        .eq('id', quotationRequestId)
        .eq('quotation_id', quotationId)
        .single();

      if (requestError) {
        if (requestError.code === 'PGRST116') {
          throw new Error('Link de cotação inválido ou expirado');
        }
        throw requestError;
      }

      if (requestData.status === 'responded') {
        throw new Error('Esta cotação já foi respondida');
      }

      setRequest(requestData);

      // Depois carrega os dados da cotação
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select(`
          *,
          vehicle:vehicles(*)
        `)
        .eq('id', quotationId)
        .single();

      if (quotationError) throw quotationError;

      setQuotation(quotationData);
      setResponse(prev => ({
        ...prev,
        parts: quotationData.parts.map((part: Part) => ({
          description: part.description,
          quantity: part.quantity,
          unit_price: 0,
          total_price: 0,
          notes: '',
          delivery_time: '',
          available: true
        })),
      }));
    } catch (err: any) {
      console.error('Erro ao carregar cotação:', err);
      toast.error(err.message || 'Erro ao carregar cotação');
    } finally {
      setLoading(false);
    }
  };

  const handlePartChange = (index: number, field: string, value: any) => {
    setResponse(prev => {
      const newParts = [...prev.parts];
      newParts[index] = {
        ...newParts[index],
        [field]: value,
      };

      // Se marcou como não disponível, zera os valores
      if (field === 'available' && !value) {
        newParts[index].unit_price = 0;
        newParts[index].total_price = 0;
      }
      
      // Se marcou como disponível, mantém os valores zerados até editar
      if (field === 'available' && value) {
        newParts[index].unit_price = 0;
        newParts[index].total_price = 0;
      }

      // Atualiza o preço total da peça se estiver disponível
      if (field === 'unit_price' && newParts[index].available) {
        newParts[index].total_price = value * newParts[index].quantity;
      }

      // Calcula o total geral apenas das peças disponíveis
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
      toast.error('Por favor, preencha seu nome e telefone');
      return;
    }

    if (response.parts.some(part => part.available && !part.unit_price)) {
      toast.error('Por favor, preencha o preço de todas as peças disponíveis');
      return;
    }

    try {
      setSubmitting(true);

      // Atualiza o status da solicitação
      const { error: updateError } = await supabase
        .from('quotation_requests')
        .update({
          status: 'responded',
          response_data: response,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      toast.success('Cotação enviada com sucesso!');
      setSubmitted(true);
    } catch (err: any) {
      console.error('Erro ao enviar cotação:', err);
      toast.error(err.message || 'Erro ao enviar cotação');
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
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Cotação Enviada com Sucesso!
            </h2>
            <p className="text-gray-600 mb-6">
              Obrigado por enviar sua cotação. Entraremos em contato em breve.
            </p>
            <p className="text-gray-500 text-sm">
              Você já pode fechar esta página.
            </p>
          </div>
        </div>
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
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Responder Cotação</h1>

          {/* Imagens do Veículo */}
          {quotation?.vehicle?.images && quotation.vehicle.images.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-medium mb-2">Imagens do Veículo</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quotation.vehicle.images.map((image: string, index: number) => (
                  <div key={index} className="relative">
                    <img
                      src={image}
                      alt={`Imagem ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg cursor-pointer"
                      onClick={() => window.open(image, '_blank')}
                      onError={(e) => {
                        console.error('Erro ao carregar imagem:', e);
                        e.currentTarget.src = '/placeholder-image.jpg';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detalhes do Veículo */}
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-2">Detalhes do Veículo</h2>
            <p>
              {quotation.vehicle.brand} {quotation.vehicle.model} {quotation.vehicle.year}
              {quotation.vehicle.chassis && ` - Chassi: ${quotation.vehicle.chassis}`}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados do Fornecedor */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  Nome do Fornecedor *
                </label>
                <input
                  type="text"
                  value={response.supplier_name || ''}
                  onChange={e => setResponse(prev => ({ ...prev, supplier_name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-2 border-blue-200 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 px-5 text-[16px] h-12 bg-white"
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
                  value={response.supplier_phone || ''}
                  onChange={e => setResponse(prev => ({ ...prev, supplier_phone: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-2 border-blue-200 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 px-5 text-[16px] h-12 bg-white"
                  required
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* Lista de Peças */}
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
                      Preço Un.
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Disponível
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {response.parts.map((part, index) => (
                    <tr key={index} className={`${
                      part.available === true ? 'bg-green-50' : 
                      part.available === false ? 'bg-red-50' : ''
                    }`}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {part.description}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                        {part.quantity}
                      </td>
                      {part.available && (
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={part.unit_price || ''}
                            onChange={e => handlePartChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-right rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </td>
                      )}
                      {part.available && (
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          <p className="text-right">{part.total_price?.toFixed(2)}</p>
                        </td>
                      )}
                      {!part.available && (
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                          -
                        </td>
                      )}
                      {!part.available && (
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                          -
                        </td>
                      )}
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                        <div className="flex justify-center items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handlePartChange(index, 'available', true)}
                            className={`px-3 py-1 rounded-l-md text-xs font-medium ${
                              part.available === true
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePartChange(index, 'available', false)}
                            className={`px-3 py-1 rounded-r-md text-xs font-medium ${
                              part.available === false
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            Não
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Informações Gerais */}
            <div>
              <h2 className="text-lg font-medium mb-4">Informações Gerais</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Prazo de Entrega
                  </label>
                  <input
                    type="text"
                    value={response.delivery_time || ''}
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
                  value={response.notes || ''}
                  onChange={e => setResponse(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 px-5 py-2"
                  placeholder="Adicione observações relevantes sobre a cotação..."
                />
              </div>
            </div>

            {/* Botão de Envio */}
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
