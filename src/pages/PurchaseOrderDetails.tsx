import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { sendWhatsAppMessage } from '../services/evolutionApi';
import jsPDF from 'jspdf';

interface PurchaseOrder {
  id: string;
  created_at: string;
  quotation_id: string;
  supplier_id: string;
  status: string;
  total_amount: number;
  notes?: string;
  delivery_time?: string;
  supplier?: {
    name: string;
    phone: string;
    area_code: string;
  };
  items: {
    id: string;
    part_description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes?: string;
  }[];
}

export function PurchaseOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    if (id) {
      loadPurchaseOrder();
    }
  }, [id]);

  const loadPurchaseOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(*),
          items:purchase_order_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (err) {
      console.error('Erro ao carregar ordem de compra:', err);
      toast.error('Erro ao carregar ordem de compra');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!order) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Título
      doc.setFontSize(20);
      doc.text('ORDEM DE COMPRA', pageWidth / 2, y, { align: 'center' });
      y += 20;

      // Informações do Fornecedor
      doc.setFontSize(12);
      doc.text(`Fornecedor: ${order.supplier?.name}`, margin, y);
      y += 10;
      doc.text(`Data: ${new Date(order.created_at).toLocaleDateString()}`, margin, y);
      y += 10;

      if (order.delivery_time) {
        doc.text(`Prazo de Entrega: ${order.delivery_time}`, margin, y);
        y += 10;
      }

      y += 10;

      // Cabeçalho da Tabela
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.text('Descrição', margin + 2, y + 7);
      doc.text('Qtd', margin + 100, y + 7);
      doc.text('Preço Un.', margin + 130, y + 7);
      doc.text('Total', margin + 160, y + 7);
      y += 15;

      // Itens
      for (const item of order.items) {
        const description = doc.splitTextToSize(item.part_description, 90);
        doc.text(description, margin + 2, y);
        doc.text(item.quantity.toString(), margin + 100, y);
        doc.text(`R$ ${item.unit_price.toFixed(2)}`, margin + 130, y);
        doc.text(`R$ ${item.total_price.toFixed(2)}`, margin + 160, y);
        
        y += description.length * 7 + 5;

        if (item.notes) {
          doc.setFontSize(10);
          const notes = doc.splitTextToSize(`Obs: ${item.notes}`, pageWidth - 2 * margin - 4);
          doc.text(notes, margin + 4, y);
          y += notes.length * 5;
          doc.setFontSize(12);
        }

        y += 5;

        // Adiciona nova página se necessário
        if (y > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage();
          y = 20;
        }
      }

      // Total
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Total:', margin + 130, y);
      doc.text(`R$ ${order.total_amount.toFixed(2)}`, margin + 160, y);
      doc.setFont('helvetica', 'normal');

      // Observações
      if (order.notes) {
        y += 20;
        doc.text('Observações:', margin, y);
        y += 7;
        const notes = doc.splitTextToSize(order.notes, pageWidth - 2 * margin);
        doc.text(notes, margin, y);
      }

      doc.save(`ordem-de-compra-${id}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF');
    }
  };

  const sendToSupplier = async () => {
    if (!order?.supplier) {
      toast.error('Fornecedor não encontrado');
      return;
    }

    try {
      setSending(true);

      // Gera o texto da mensagem
      const items = order.items
        .map(item => `- ${item.part_description}: ${item.quantity} un x R$ ${item.unit_price.toFixed(2)} = R$ ${item.total_price.toFixed(2)}`)
        .join('\n');

      const message = `*ORDEM DE COMPRA*\n\n` +
        `Prezado fornecedor,\n\n` +
        `Segue ordem de compra:\n\n` +
        `${items}\n\n` +
        `*Total: R$ ${order.total_amount.toFixed(2)}*\n\n` +
        (order.delivery_time ? `Prazo de entrega: ${order.delivery_time}\n\n` : '') +
        (order.notes ? `Observações: ${order.notes}\n\n` : '') +
        `Por favor, confirme o recebimento.`;

      const { error } = await sendWhatsAppMessage({
        areaCode: order.supplier.area_code,
        phone: order.supplier.phone,
        message
      });

      if (error) throw error;

      // Atualiza o status da ordem
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ status: 'sent' })
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('Ordem de compra enviada com sucesso!');
      loadPurchaseOrder();
    } catch (err) {
      console.error('Erro ao enviar ordem de compra:', err);
      toast.error('Erro ao enviar ordem de compra');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900">
            Ordem de compra não encontrada
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center text-sm text-blue-500 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold">Ordem de Compra</h1>
              <p className="text-sm text-gray-500 mt-1">
                Criada em {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
            <div className="space-x-2">
              <button
                onClick={generatePDF}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </button>
              <button
                onClick={sendToSupplier}
                disabled={sending || order.status === 'sent'}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {order.status === 'sent' ? 'Enviado' : 'Enviar ao Fornecedor'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Informações do Fornecedor */}
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-2">Fornecedor</h2>
            <p className="text-gray-900">{order.supplier?.name}</p>
            <p className="text-gray-500">
              Telefone: ({order.supplier?.area_code}) {order.supplier?.phone}
            </p>
            {order.delivery_time && (
              <p className="text-gray-500">
                Prazo de entrega: {order.delivery_time}
              </p>
            )}
          </div>

          {/* Lista de Itens */}
          <div>
            <h2 className="text-lg font-medium mb-4">Itens</h2>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantidade
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Un.
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.part_description}
                          </div>
                          {item.notes && (
                            <div className="text-sm text-gray-500">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-right">
                        R$ {item.unit_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                        R$ {item.total_price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      Total
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      R$ {order.total_amount.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Observações */}
          {order.notes && (
            <div className="mt-6">
              <h2 className="text-lg font-medium mb-2">Observações</h2>
              <p className="text-gray-700">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
