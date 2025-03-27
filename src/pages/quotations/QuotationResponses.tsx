import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import CounterOfferModal from '../../components/quotations/CounterOfferModal';

interface QuotationResponse {
  id: string;
  supplier_id: string;
  response_data: {
    supplier_name?: string;
    supplier_phone?: string;
    parts?: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      condition?: string;
      available?: boolean;
      delivery_time?: string;
      notes?: string;
    }>;
    total_price?: number;
    delivery_time?: string;
    notes?: string;
  };
  responded_at: string;
}

interface Part {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  condition?: string;
  available?: boolean;
  delivery_time?: string;
  notes?: string;
}

const QuotationResponses: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [responses, setResponses] = useState<QuotationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [counterOfferModalOpen, setCounterOfferModalOpen] = useState(false);
  const [selectedResponseForCounterOffer, setSelectedResponseForCounterOffer] = useState<QuotationResponse | null>(null);

  useEffect(() => {
    if (id) {
      loadResponses();
    }
  }, [id]);

  const loadResponses = async () => {
    try {
      setLoading(true);
      console.log('Carregando respostas para cotação ID:', id);
      
      if (!id) {
        console.error('ID da cotação não fornecido');
        toast.error('ID da cotação não fornecido');
        return;
      }
      
      // Verificar a estrutura da tabela quotation_requests
      const { data: tableInfo, error: tableError } = await supabase
        .from('quotation_requests')
        .select('*')
        .limit(1);
        
      console.log('Estrutura da tabela:', tableInfo);
      
      if (tableError) {
        console.error('Erro ao verificar estrutura da tabela:', tableError);
      }
      
      // Fazer a consulta com os campos corretos
      const { data, error } = await supabase
        .from('quotation_requests')
        .select('*')
        .eq('quotation_id', id)
        .eq('status', 'responded');

      if (error) {
        console.error('Erro ao carregar respostas:', error);
        throw error;
      }
      
      console.log('Dados retornados:', data);
      
      // Formatar os dados para o formato esperado
      const formattedResponses = data?.map(item => ({
        id: item.id,
        supplier_id: item.supplier_id,
        response_data: item.response_data || {},
        responded_at: item.responded_at || item.updated_at
      })) || [];
      
      console.log('Respostas formatadas:', formattedResponses);
      setResponses(formattedResponses);
    } catch (err) {
      console.error('Erro ao carregar respostas:', err);
      toast.error('Erro ao carregar respostas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCounterOfferModal = (response: QuotationResponse) => {
    setSelectedResponseForCounterOffer(response);
    setCounterOfferModalOpen(true);
  };

  const handleCloseCounterOfferModal = () => {
    setCounterOfferModalOpen(false);
    setSelectedResponseForCounterOffer(null);
  };

  const handleCounterOfferSubmit = async (counterOfferData: any) => {
    try {
      // Lógica para salvar a contraproposta
      console.log('Enviando contraproposta:', counterOfferData);
      
      // Fechar o modal
      handleCloseCounterOfferModal();
      
      // Mostrar mensagem de sucesso
      toast.success('Contraproposta enviada com sucesso!');
      
      // Recarregar as respostas
      loadResponses();
    } catch (error) {
      console.error('Erro ao enviar contraproposta:', error);
      toast.error('Erro ao enviar contraproposta');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/quotations')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Cotações
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Respostas da Cotação</h1>

      {responses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Nenhuma resposta recebida ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {responses.map((response) => (
            <div key={response.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {response.response_data.supplier_name || 'Fornecedor'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Respondido em: {new Date(response.responded_at).toLocaleString()}
                    </p>
                    <p className="text-sm font-medium mt-2">
                      Total: {response.response_data.total_price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <a 
                      href={`/quotation-response/${response.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      Ver detalhes
                    </a>
                    
                    <button
                      onClick={() => handleOpenCounterOfferModal(response)}
                      className="text-sm text-green-600 hover:text-green-800 flex items-center"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Contraproposta
                    </button>
                  </div>
                </div>

                {/* Detalhes das peças */}
                <div className="mt-4 space-y-4">
                  {response.response_data.parts?.map((part, index) => (
                    <div key={index} className="border-t pt-4">
                      <h4 className="font-medium">{part.description}</h4>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Quantidade: {part.quantity}</p>
                          <p className="text-sm text-gray-500">
                            Preço unitário: {part.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className="text-sm text-gray-500">
                            Preço total: {part.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">
                            Condição: {part.condition || 'Não especificada'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Disponível: {part.available ? 'Sim' : 'Não'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {counterOfferModalOpen && selectedResponseForCounterOffer && (
        <CounterOfferModal
          isOpen={counterOfferModalOpen}
          onClose={handleCloseCounterOfferModal}
          onSubmit={handleCounterOfferSubmit}
          quotationResponse={selectedResponseForCounterOffer}
          quotationId={id || ''}
        />
      )}
    </div>
  );
};

export default QuotationResponses;
