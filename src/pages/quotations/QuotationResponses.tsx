import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Loader2 } from 'lucide-react';
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

export default function QuotationResponses() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<QuotationResponse[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadResponses();
    }
  }, [id]);

  const loadResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('quotation_requests')
        .select('*')
        .eq('quotation_id', id)
        .eq('status', 'responded');

      if (error) throw error;
      setResponses(data || []);
    } catch (err) {
      console.error('Erro ao carregar respostas:', err);
      toast.error('Erro ao carregar respostas');
    } finally {
      setLoading(false);
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
        <h1 className="text-2xl font-bold mb-6">Respostas Recebidas</h1>

        <div className="space-y-6">
          {responses.map((response) => (
            <div
              key={response.id}
              className={`border rounded-lg p-4 ${
                selectedResponse === response.id ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-medium text-lg">
                    {response.response_data.supplier_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Telefone: {response.response_data.supplier_phone}
                  </p>
                  <p className="text-sm text-gray-600">
                    Respondido em: {new Date(response.responded_at).toLocaleString()}
                  </p>
                  <p className="text-sm font-medium mt-2">
                    Total: {response.response_data.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedResponse(
                    selectedResponse === response.id ? null : response.id
                  )}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectedResponse === response.id ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                </button>
              </div>

              {selectedResponse === response.id && (
                <div className="mt-4 space-y-4">
                  {response.response_data.parts.map((part, index) => (
                    <div key={index} className="border-t pt-4">
                      <h4 className="font-medium">{part.description}</h4>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Quantidade: {part.quantity}</p>
                          {part.available ? (
                            <>
                              <p className="text-sm text-gray-600">
                                Preço Unitário: {part.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                              <p className="text-sm text-gray-600">
                                Total: {part.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-red-500">Peça não disponível</p>
                          )}
                        </div>
                        <div>
                          {part.delivery_time && (
                            <p className="text-sm text-gray-600">
                              Prazo de Entrega: {part.delivery_time}
                            </p>
                          )}
                          {part.notes && (
                            <p className="text-sm text-gray-600">
                              Observações: {part.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {response.response_data.notes && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium">Observações Gerais</h4>
                      <p className="text-sm text-gray-600 mt-2">
                        {response.response_data.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
