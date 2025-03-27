import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { customToast } from '../../lib/toast';

interface Part {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  counter_price?: number;
  counter_total?: number;
  discount_percentage?: number;
  condition?: string;
  available?: boolean;
  delivery_time?: string;
  notes?: string;
  accepted?: boolean;
}

interface QuotationResponse {
  id: string;
  quotation_id: string;
  supplier_id: string;
  status: string;
  response_data: {
    supplier_name: string;
    supplier_phone: string;
    parts: Part[];
    total_price: number;
    delivery_time?: string;
    notes?: string;
  };
  created_at: string;
  updated_at: string;
  responded_at: string;
}

interface QuotationRequest {
  id: string;
  quotation_id: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_phone?: string;
  status: string;
  parts?: Part[];
  total_price?: number;
  delivery_time?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  response_data?: any;
  supplier?: any;
}

interface CounterOfferModalProps {
  isOpen?: boolean;
  onClose: () => void;
  quotationId?: string;
  request: QuotationRequest | null;
  onSubmit?: (counterOfferData: any) => Promise<void>;
}

interface CounterOfferData {
  parts: Part[];
  total_price: number;
  delivery_time?: string;
  notes?: string;
}

const CounterOfferModal: React.FC<CounterOfferModalProps> = ({
  isOpen = true,
  onClose,
  quotationId,
  request,
  onSubmit
}) => {
  const [counterOffer, setCounterOffer] = React.useState<CounterOfferData>({
    parts: [],
    total_price: 0
  });
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (request) {
      // Verifica se temos dados de resposta
      if (request.response_data && request.response_data.parts && Array.isArray(request.response_data.parts)) {
        // Inicializa a contraproposta com os dados da resposta
        // Filtra apenas as peças disponíveis
        const initialParts = request.response_data.parts
          .filter((part: any) => part.available !== false) // Inclui apenas peças disponíveis
          .map((part: any) => ({
            description: part.description,
            quantity: part.quantity,
            unit_price: part.unit_price,
            total_price: part.total_price,
            counter_price: part.unit_price,
            counter_total: part.total_price,
            discount_percentage: 0,
            condition: part.condition,
            available: part.available,
            delivery_time: part.delivery_time,
            notes: part.notes
          }));

        setCounterOffer({
          parts: initialParts,
          total_price: initialParts.reduce((sum, part) => sum + part.counter_total, 0),
          delivery_time: request.response_data.delivery_time || '',
          notes: request.response_data.notes || ''
        });
      } 
      // Se não tiver response_data mas tiver parts direto no request
      else if (request.parts && Array.isArray(request.parts)) {
        // Filtra apenas as peças disponíveis
        const initialParts = request.parts
          .filter((part: any) => part.available !== false) // Inclui apenas peças disponíveis
          .map((part: any) => ({
            description: part.description,
            quantity: part.quantity,
            unit_price: part.unit_price,
            total_price: part.total_price,
            counter_price: part.unit_price,
            counter_total: part.total_price,
            discount_percentage: 0,
            condition: part.condition,
            available: part.available,
            delivery_time: part.delivery_time,
            notes: part.notes
          }));

        setCounterOffer({
          parts: initialParts,
          total_price: initialParts.reduce((sum, part) => sum + part.counter_total, 0),
          delivery_time: request.delivery_time || '',
          notes: request.notes || ''
        });
      }
    }
  }, [request]);

  const handlePartChange = (index: number, field: string, value: any) => {
    setCounterOffer(prev => {
      const newParts = [...prev.parts];
      const part = { ...newParts[index] };
      
      // Atualiza o campo específico
      (part as any)[field] = value;
      
      // Recalcula os valores
      if (field === 'counter_price') {
        part.counter_total = part.quantity * value;
        part.discount_percentage = part.unit_price > 0 
          ? Math.round(((part.unit_price - value) / part.unit_price) * 100) 
          : 0;
      }
      
      newParts[index] = part;
      
      // Recalcula o total geral
      const newTotal = newParts.reduce((sum, p) => sum + (p.counter_total || 0), 0);
      
      return {
        ...prev,
        parts: newParts,
        total_price: newTotal
      };
    });
  };

  const handleGeneralChange = (field: string, value: any) => {
    setCounterOffer(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!request || !request.id || !request.supplier_id) {
      customToast.error('Dados do fornecedor incompletos');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Determina os dados do fornecedor
      const supplierName = request.response_data?.supplier_name || 
                          request.supplier?.name || 
                          request.supplier_name || '';
      
      const supplierPhone = request.response_data?.supplier_phone || 
                           (request.supplier ? `${request.supplier.area_code}${request.supplier.phone}` : '') || 
                           request.supplier_phone || '';
      
      // Prepara os dados para envio
      const counterOfferData = {
        quotation_id: request.quotation_id,
        request_id: request.id,
        supplier_id: request.supplier_id,
        status: 'pending',
        counter_offer_data: {
          supplier_name: supplierName,
          supplier_phone: supplierPhone,
          parts: counterOffer.parts.map((part: any) => ({
            description: part.description,
            quantity: part.quantity,
            original_price: part.unit_price,
            original_total: part.total_price,
            counter_price: part.counter_price,
            counter_total: part.counter_total,
            discount_percentage: part.discount_percentage,
            condition: part.condition,
            available: part.available,
            delivery_time: part.delivery_time,
            notes: part.notes
          })),
          total_price: counterOffer.total_price,
          delivery_time: counterOffer.delivery_time,
          notes: counterOffer.notes
        }
      };
      
      // Salva no banco de dados
      const { data, error } = await supabase
        .from('counter_offers')
        .insert(counterOfferData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Envia notificação via WhatsApp
      if (data && data.id) {
        try {
          // Busca os dados do fornecedor
          const { data: supplierData, error: supplierError } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', request.supplier_id)
            .single();
          
          if (supplierError) throw supplierError;
          
          // Busca a configuração do WhatsApp (primeira disponível)
          const { data: configData, error: configError } = await supabase
            .from('whatsapp_configs')
            .select('*')
            .limit(1);
          
          if (configError) {
            console.error('Erro ao buscar configuração do WhatsApp:', configError);
            throw configError;
          }
          
          if (!configData || configData.length === 0) {
            console.error('Nenhuma configuração do WhatsApp encontrada');
            return;
          }
          
          const config = configData[0];
          
          // Prepara o número de telefone
          const phone = `55${supplierData.area_code}${supplierData.phone}`;
          
          // Mensagem padrão para contraproposta
          const message = `Olá ${supplierData.name}! Você recebeu uma contraproposta para a cotação de peças. Acesse o link para visualizar e responder: ${window.location.origin}/counter-offer-response/${request?.quotation_id}/${request?.id}?counter_offer_id=${data.id}`;
          
          // Envia a mensagem diretamente para a API da Evolution
          const baseUrl = config.evolution_api_url.replace(/\/+$/, '');
          const url = `${baseUrl}/message/sendText/${config.instance_name}`;
          
          console.log('Enviando mensagem WhatsApp:', {
            url,
            phone,
            message
          });
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': config.evolution_api_key
            },
            body: JSON.stringify({
              number: phone,
              text: message
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro ao enviar mensagem WhatsApp:', errorText);
            throw new Error(`Erro ao enviar mensagem: ${errorText}`);
          }
          
          console.log('Mensagem WhatsApp enviada com sucesso!');
        } catch (whatsappError) {
          console.error('Erro ao enviar notificação WhatsApp:', whatsappError);
          // Não interrompe o fluxo se houver erro no envio do WhatsApp
        }
      }
      
      // Chama a função de callback
      if (onSubmit) await onSubmit(counterOfferData);
      
      customToast.success('Contraproposta enviada com sucesso!');
      onClose();
    } catch (err: any) {
      console.error('Erro ao enviar contraproposta:', err);
      customToast.error(`Erro ao enviar contraproposta: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Fazer Contraproposta</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-grow">
          <form onSubmit={handleSubmit} className="p-4 space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Fornecedor</h3>
              {request?.response_data ? (
                <>
                  <p className="text-sm">{request.response_data.supplier_name}</p>
                  <p className="text-sm">{request.response_data.supplier_phone}</p>
                </>
              ) : request?.supplier ? (
                <>
                  <p className="text-sm">{request.supplier.name}</p>
                  <p className="text-sm">{request.supplier.area_code}{request.supplier.phone}</p>
                </>
              ) : (
                <>
                  <p className="text-sm">{request?.supplier_name}</p>
                  <p className="text-sm">{request?.supplier_phone}</p>
                </>
              )}
            </div>
            
            <div>
              <h3 className="font-medium mb-4">Peças</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qtd
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor Original
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contraproposta
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Desconto
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {counterOffer.parts.map((part, index) => (
                      <tr key={index}>
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {part.description}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {part.quantity}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900">
                          R$ {part.unit_price.toFixed(2)}
                        </td>
                        <td className="px-3 py-4 text-sm">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={part.counter_price}
                            onChange={(e) => handlePartChange(index, 'counter_price', parseFloat(e.target.value))}
                            className="w-24 border rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-4 text-sm text-green-600">
                          {part.discount_percentage}%
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900">
                          R$ {(part.counter_total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        Valor Total Original:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        {request?.response_data ? (
                          `R$ ${(request.response_data.total_price || 0).toFixed(2)}`
                        ) : (
                          `R$ ${(request?.total_price || 0).toFixed(2)}`
                        )}
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        Valor Total Contraproposta:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-blue-600 text-right">
                        R$ {counterOffer.total_price.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        Economia Total:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-blue-600 text-right">
                        {(() => {
                          const originalTotal = request?.response_data 
                            ? (request.response_data.total_price || 0) 
                            : (request?.total_price || 0);
                          
                          const savings = originalTotal - counterOffer.total_price;
                          const savingsPercentage = originalTotal > 0 
                            ? Math.round((savings / originalTotal) * 100) 
                            : 0;
                          
                          return `R$ ${savings.toFixed(2)} (${savingsPercentage}%)`;
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prazo de Entrega
                </label>
                <input
                  type="text"
                  value={counterOffer.delivery_time || ''}
                  onChange={(e) => handleGeneralChange('delivery_time', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ex: 3 dias úteis"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={counterOffer.notes || ''}
                  onChange={(e) => handleGeneralChange('notes', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="Adicione observações sobre a contraproposta..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Contraproposta'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CounterOfferModal;
