import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface MessageTemplateProps {
  quotationId: string;
  onTemplateChange: (template: string) => void;
  className?: string;
}

export const MessageTemplate: React.FC<MessageTemplateProps> = ({
  quotationId,
  onTemplateChange,
  className = ''
}) => {
  const [template, setTemplate] = useState('');
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotation();
  }, [quotationId]);

  const loadQuotation = async () => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          *,
          vehicle:vehicles(*)
        `)
        .eq('id', quotationId)
        .single();

      if (error) throw error;

      setQuotation(data);
      
      // Gera o template inicial
      const quotationLink = `${window.location.origin}/quotation/${quotationId}/respond`;
      const initialTemplate = `*Cotação de Peças*
Veículo: ${data.vehicle.brand} ${data.vehicle.model} ${data.vehicle.year}
${data.vehicle.chassis ? `Chassi: ${data.vehicle.chassis}` : ''}

*Peças necessárias:*
${data.parts.map((part: any) => `- ${part.operation} - ${part.code}
  ${part.description}
  Tipo: ${part.part_type === 'genuine' ? 'Genuína' : part.part_type === 'used' ? 'Usada' : 'Nova'}
  Quantidade: ${part.quantity}
  ${part.painting_hours > 0 ? `Horas Pintura: ${part.painting_hours}` : ''}`).join('\n\n')}

Para enviar sua cotação, acesse: ${quotationLink}`;

      setTemplate(initialTemplate);
      onTemplateChange(initialTemplate);
    } catch (err) {
      console.error('Erro ao carregar cotação:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newTemplate = e.target.value;
    setTemplate(newTemplate);
    onTemplateChange(newTemplate);
  };

  if (loading) {
    return <div className="animate-pulse h-48 bg-gray-100 rounded-md"></div>;
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Mensagem para Fornecedores
      </label>
      <div className="relative">
        <textarea
          value={template}
          onChange={handleTemplateChange}
          rows={10}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Digite a mensagem que será enviada para os fornecedores..."
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          {template.length} caracteres
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Use * para texto em negrito. O link para resposta será sempre incluído automaticamente.
      </p>
    </div>
  );
};
