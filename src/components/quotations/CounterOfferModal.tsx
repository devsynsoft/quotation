import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { customToast } from '../../lib/toast';
import { supabase } from '../../lib/supabase';

interface Part {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  available: boolean;
  condition?: string;
  notes?: string;
  counter_price?: number;
  counter_total?: number;
  discount_percentage?: number;
}

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

interface CounterOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotationId: string;
  quotationResponse: QuotationResponse;
  onSubmit: (counterOfferData: any) => Promise<void>;
}

interface CounterOfferData {
  parts: Part[];
  total_price: number;
  delivery_time?: string;
  notes?: string;
}

const CounterOfferModal: React.FC<CounterOfferModalProps> = ({
  isOpen,
  onClose,
  quotationId,
  quotationResponse,
  onSubmit
}) => {
  const [counterOffer, setCounterOffer] = useState<CounterOfferData>({
    parts: [],
    total_price: 0,
    delivery_time: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && quotationResponse.response_data.parts && Array.isArray(quotationResponse.response_data.parts)) {
      // Inicializa a contraproposta com os dados originais
      const initialParts = quotationResponse.response_data.parts.map(part => ({
        ...part,
        counter_price: part.unit_price,
        counter_total: part.total_price,
        discount_percentage: 0,
        available: part.available === undefined ? true : part.available
      }));

      setCounterOffer({
        parts: initialParts as Part[],
        total_price: quotationResponse.response_data.total_price || 0,
        delivery_time: quotationResponse.response_data.delivery_time || '',
        notes: quotationResponse.response_data.notes || ''
      });
    }
  }, [isOpen, quotationResponse]);

  const handlePartChange = (index: number, field: string, value: any) => {
    setCounterOffer(prev => {
      const newParts = [...prev.parts];
      const part = newParts[index];

      if (field === 'counter_price') {
        const numValue = parseFloat(value);
        const originalPrice = part.unit_price;
        
        // Atualiza o preço de contraproposta
        newParts[index] = {
          ...part,
          counter_price: numValue,
          counter_total: numValue * part.quantity,
          discount_percentage: originalPrice > 0 
            ? Math.round(((originalPrice - numValue) / originalPrice) * 100) 
            : 0
        };
      } else if (field === 'discount_percentage') {
        const numValue = parseFloat(value);
        const originalPrice = part.unit_price;
        
        // Calcula o novo preço com base no desconto
        const newPrice = originalPrice * (1 - (numValue / 100));
        
        newParts[index] = {
          ...part,
          counter_price: parseFloat(newPrice.toFixed(2)),
          counter_total: parseFloat((newPrice * part.quantity).toFixed(2)),
          discount_percentage: numValue
        };
      } else {
        newParts[index] = {
          ...part,
          [field]: value
        };
      }

      // Recalcula o total
      const totalPrice = newParts.reduce((sum, part) => 
        sum + (part.available ? (part.counter_total || 0) : 0), 0);

      return {
        ...prev,
        parts: newParts,
        total_price: totalPrice
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Prepara os dados para envio
      const counterOfferData = {
        quotation_id: quotationId,
        request_id: quotationResponse.id,
        supplier_id: quotationResponse.supplier_id,
        counter_offer_data: {
          supplier_name: quotationResponse.response_data.supplier_name || '',
          supplier_phone: quotationResponse.response_data.supplier_phone || '',
          parts: counterOffer.parts.map(part => ({
            description: part.description,
            quantity: part.quantity,
            original_price: part.unit_price,
            original_total: part.total_price,
            counter_price: part.counter_price || part.unit_price,
            counter_total: part.counter_total || part.total_price,
            discount_percentage: part.discount_percentage || 0,
            available: part.available,
            condition: part.condition || '',
            notes: part.notes || ''
          })),
          total_price: counterOffer.total_price,
          delivery_time: counterOffer.delivery_time,
          notes: counterOffer.notes
        },
        status: 'pending'
      };
      
      // Salva a contraproposta no banco de dados
      const { data, error } = await supabase
        .from('counter_offers')
        .insert(counterOfferData)
        .select('id')
        .single();
      
      if (error) throw error;
      
      // Envia notificação via WhatsApp
      await sendWhatsAppNotification(quotationResponse.supplier_id, data.id);
      
      // Chama a função de callback
      await onSubmit(counterOfferData);
      
      onClose();
    } catch (err: any) {
      console.error('Erro ao enviar contraproposta:', err);
      customToast.error(err.message || 'Erro ao enviar contraproposta');
    } finally {
      setSubmitting(false);
    }
  };
  
  const sendWhatsAppNotification = async (supplierId: string, counterOfferId: string) => {
    try {
      // Busca os dados do fornecedor
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .single();
      
      if (supplierError) throw supplierError;
      
      // Busca as configurações do WhatsApp
      const { data: whatsappConfig, error: configError } = await supabase
        .from('whatsapp_configs')
        .select('*')
        .limit(1)
        .single();
      
      if (configError) throw configError;
      
      // Constrói a mensagem
      const message = `Olá! Você recebeu uma contraproposta para a cotação de peças. Acesse o link para visualizar: ${window.location.origin}/quotation-response/${quotationId}/${quotationResponse.id}?counter_offer_id=${counterOfferId}`;
      
      // Prepara o número de telefone
      const phone = `${supplierData.area_code}${supplierData.phone}`;
      
      // Envia a mensagem via WhatsApp
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
      
      // Abre o WhatsApp em uma nova aba
      window.open(whatsappUrl, '_blank');
      
      return true;
    } catch (err) {
      console.error('Erro ao enviar notificação via WhatsApp:', err);
      return false;
    }
  };

  if (!isOpen) return null;

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
              <p className="text-sm">{quotationResponse.response_data.supplier_name}</p>
              <p className="text-sm">{quotationResponse.response_data.supplier_phone}</p>
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
                        Preço Original
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contraproposta
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Desconto (%)
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
                            value={part.counter_price || 0}
                            onChange={(e) => handlePartChange(index, 'counter_price', e.target.value)}
                            className="w-24 border rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-4 text-sm">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={part.discount_percentage || 0}
                            onChange={(e) => handlePartChange(index, 'discount_percentage', e.target.value)}
                            className="w-20 border rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-4 text-sm font-medium text-gray-900">
                          R$ {(part.counter_total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-3 py-2 text-sm font-medium text-gray-900">
                        Valor Total Original:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        R$ {(quotationResponse.response_data.total_price || 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-sm font-medium text-blue-600">
                        Valor Total Contraproposta:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-blue-600 text-right">
                        R$ {counterOffer.total_price.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-sm font-medium text-blue-600">
                        Economia Total:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-blue-600 text-right">
                        R$ {((quotationResponse.response_data.total_price || 0) - counterOffer.total_price).toFixed(2)} 
                        ({(quotationResponse.response_data.total_price || 0) > 0 
                          ? Math.round((((quotationResponse.response_data.total_price || 0) - counterOffer.total_price) / (quotationResponse.response_data.total_price || 1)) * 100) 
                          : 0}%)
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
                  onChange={(e) => setCounterOffer({...counterOffer, delivery_time: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ex: 5 dias úteis"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={counterOffer.notes || ''}
                  onChange={(e) => setCounterOffer({...counterOffer, notes: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="Adicione observações se necessário"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
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
