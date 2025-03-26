import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Send, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { customToast, hotToast } from '../lib/toast';
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
  vehicle?: {
    brand: string;
    model: string;
    year: string;
  };
}

export function PurchaseOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  // Estado para armazenar a URL da imagem do veículo
  const [vehicleImage, setVehicleImage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadPurchaseOrder();
    }
  }, [id]);

  // Efeito para carregar a imagem do veículo quando o pedido for carregado
  useEffect(() => {
    if (order?.quotation_id) {
      loadVehicleImage();
    }
  }, [order]);

  const loadPurchaseOrder = async () => {
    try {
      // Buscamos a ordem de compra
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id!)
        .single();

      if (orderError) throw orderError;
      
      if (!orderData) {
        throw new Error('Ordem de compra não encontrada');
      }

      // Buscamos o fornecedor
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('name, phone, area_code')
        .eq('id', orderData.supplier_id)
        .single();

      if (supplierError) {
        console.error('Erro ao buscar fornecedor:', supplierError);
      }

      // Buscamos os itens da ordem
      const { data: itemsData, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', orderData.id);
      
      if (itemsError) {
        console.error('Erro ao buscar itens da ordem:', itemsError);
      }

      // Criamos um objeto que corresponde à nossa interface PurchaseOrder
      const purchaseOrder: PurchaseOrder = {
        id: orderData.id,
        created_at: orderData.created_at,
        quotation_id: orderData.quotation_id,
        supplier_id: orderData.supplier_id,
        status: orderData.status,
        total_amount: orderData.total_amount,
        notes: orderData.notes,
        delivery_time: orderData.delivery_time,
        supplier: supplierData || undefined,
        items: itemsData || []
      };
      
      // Fetch vehicle information from the quotation if available
      if (purchaseOrder.quotation_id) {
        try {
          // Busca a cotação
          const { data: quotationData, error: quotationError } = await supabase
            .from('quotations')
            .select('vehicle_id')
            .eq('id', purchaseOrder.quotation_id)
            .single();
            
          if (quotationError) {
            console.error('Erro ao buscar cotação:', quotationError);
          } else if (quotationData && quotationData.vehicle_id) {
            // Busca os dados do veículo
            const { data: vehicleData, error: vehicleError } = await supabase
              .from('vehicles')
              .select('brand, model, year')
              .eq('id', quotationData.vehicle_id)
              .single();
              
            if (vehicleError) {
              console.error('Erro ao buscar veículo:', vehicleError);
            } else if (vehicleData) {
              purchaseOrder.vehicle = vehicleData;
            }
          }
        } catch (quotationError) {
          console.error('Erro ao buscar informações do veículo:', quotationError);
        }
      }
      
      setOrder(purchaseOrder);
    } catch (err) {
      console.error('Erro ao carregar ordem de compra:', err);
      customToast.error('Erro ao carregar ordem de compra');
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar a imagem do veículo
  const loadVehicleImage = async () => {
    if (!order?.quotation_id) return;
    
    try {
      // Busca a cotação para obter o ID do veículo
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select('vehicle_id')
        .eq('id', order.quotation_id)
        .single();
        
      if (quotationError || !quotationData?.vehicle_id) {
        console.error('Erro ao buscar ID do veículo:', quotationError);
        return;
      }
      
      // Busca os dados do veículo, incluindo as imagens
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', quotationData.vehicle_id)
        .single();
        
      if (vehicleError) {
        console.error('Erro ao buscar veículo:', vehicleError);
        return;
      }
      
      // Usa any para acessar o campo images
      const vehicle = vehicleData as any;
      if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
        setVehicleImage(vehicle.images[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar imagem do veículo:', error);
    }
  };

  const generatePdf = () => {
    if (!order) return;

    const doc = new jsPDF();
    const margin = 20;
    let y = margin;

    // Título
    doc.setFontSize(18);
    doc.text('ORDEM DE COMPRA', doc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 15;

    // Informações da ordem
    doc.setFontSize(12);
    doc.text(`Data: ${new Date(order.created_at).toLocaleDateString()}`, margin, y);
    y += 10;
    doc.text(`Fornecedor: ${order.supplier?.name || 'N/A'}`, margin, y);
    y += 10;
    doc.text(`Status: ${order.status}`, margin, y);
    y += 10;
    if (order.delivery_time) {
      doc.text(`Prazo de entrega: ${order.delivery_time}`, margin, y);
      y += 10;
    }
    if (order.notes) {
      doc.text(`Observações: ${order.notes}`, margin, y);
      y += 10;
    }
    y += 10;

    // Tabela de itens
    const headers = ['Descrição', 'Qtd', 'Valor Unit.', 'Total'];
    const data = order.items.map(item => [
      item.part_description,
      item.quantity.toString(),
      `R$ ${item.unit_price.toFixed(2)}`,
      `R$ ${item.total_price.toFixed(2)}`
    ]);

    // Cabeçalho da tabela
    const colWidths = [100, 20, 30, 30];
    let x = margin;
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    y += 7;
    doc.line(margin, y, 190, y);
    y += 7;

    // Dados da tabela
    data.forEach(row => {
      x = margin;
      row.forEach((cell, i) => {
        doc.text(cell, x, y);
        x += colWidths[i];
      });
      y += 10;
    });

    // Total
    y += 5;
    doc.line(margin, y, 190, y);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: R$ ${order.total_amount.toFixed(2)}`, 160, y, { align: 'right' });

    // Salva o PDF
    doc.save(`ordem_compra_${order.id}.pdf`);
    customToast.success('PDF gerado com sucesso!');
  };

  const sendToSupplier = async () => {
    if (!order?.supplier) {
      customToast.error('Fornecedor não encontrado');
      return;
    }

    try {
      setSending(true);
      
      // Mostra notificação de "Enviando solicitações..." que será removida automaticamente
      const toastId = customToast.loading('Enviando solicitações...');
      
      // Atualiza o status para "enviando"
      const { error: updateSendingError } = await supabase
        .from('purchase_orders')
        .update({ status: 'sending' })
        .eq('id', id!);
        
      if (updateSendingError) {
        console.error('Erro ao atualizar status para enviando:', updateSendingError);
      } else {
        // Atualiza o estado local para refletir a mudança
        setOrder(prev => prev ? {...prev, status: 'sending'} : null);
      }

      const items = order.items
        .map(item => `⭕ ${item.part_description}: ${item.quantity} un x R$ ${item.unit_price.toFixed(2)} = R$ ${item.total_price.toFixed(2)}`)
        .join('\n');

      const message = `*ORDEM DE COMPRA*\n\n` +
        `Prezado fornecedor,\n\n` +
        `Segue ordem de compra:\n\n` +
        `${items}\n\n` +
        `*Total: R$ ${order.total_amount.toFixed(2)}*\n\n` +
        (order.delivery_time ? `Prazo de entrega: ${order.delivery_time}\n\n` : '') +
        (order.notes ? `Observações: ${order.notes}\n\n` : '') +
        `Por favor, confirme o recebimento.`;

      let imageUrl: string | undefined = undefined;
      let vehicleCaption: string | undefined = undefined;
      
      if (order.vehicle) {
        // Buscar a imagem real do veículo
        try {
          // Extrair o ID do veículo da cotação associada
          let vehicleId = '';
          
          if (order.quotation_id) {
            const { data: quotationData, error: quotationError } = await supabase
              .from('quotations')
              .select('vehicle_id')
              .eq('id', order.quotation_id)
              .single();
              
            if (!quotationError && quotationData) {
              vehicleId = quotationData.vehicle_id;
            }
          }
          
          if (vehicleId) {
            const { data: vehicleData, error: vehicleError } = await supabase
              .from('vehicles')
              .select('*')
              .eq('id', vehicleId)
              .single();
              
            if (!vehicleError && vehicleData) {
              // Usar any para acessar o campo images
              const vehicle = vehicleData as any;
              if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
                imageUrl = vehicle.images[0];
              } else {
                // Fallback para imagem fictícia se não encontrar
                imageUrl = "https://via.placeholder.com/500x300?text=Veiculo+Imagem";
              }
            } else {
              imageUrl = "https://via.placeholder.com/500x300?text=Veiculo+Imagem";
            }
          } else {
            imageUrl = "https://via.placeholder.com/500x300?text=Veiculo+Imagem";
          }
        } catch (error) {
          console.error('Erro ao buscar imagem do veículo:', error);
          imageUrl = "https://via.placeholder.com/500x300?text=Veiculo+Imagem";
        }
        
        // Cria a legenda do veículo
        vehicleCaption = `*${order.vehicle.brand} ${order.vehicle.model} ano ${order.vehicle.year}*`;
        console.log(`Veículo: ${vehicleCaption}`);
      }

      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      // Envia a mensagem com ou sem imagem
      const { error } = await sendWhatsAppMessage({
        areaCode: order.supplier.area_code,
        phone: order.supplier.phone,
        message,
        imageUrl,
        userId
      });

      if (error) throw error;

      // Atualiza o status da ordem
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ status: 'sent' })
        .eq('id', id!);

      if (updateError) throw updateError;

      // Remove a notificação de "Enviando solicitações..."
      hotToast.dismiss(toastId);
      
      customToast.success('Ordem de compra enviada com sucesso!');
      loadPurchaseOrder();
    } catch (err) {
      console.error('Erro ao enviar ordem de compra:', err);
      customToast.error('Erro ao enviar ordem de compra');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto p-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="mr-2" size={16} />
          Voltar
        </button>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Ordem de compra não encontrada.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="mr-2" size={16} />
          Voltar
        </button>
        <div className="flex space-x-2">
          <button
            onClick={generatePdf}
            className="flex items-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            <Download className="mr-2" size={16} />
            Gerar PDF
          </button>
          {order.status !== 'sent' && (
            <button
              onClick={sendToSupplier}
              disabled={sending}
              className="flex items-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              <Send className="mr-2" size={16} />
              {sending ? 'Enviando...' : 'Enviar ao Fornecedor'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold mb-4">Ordem de Compra</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="flex items-center">
                <span className="font-semibold">Fornecedor:</span> 
                {order.supplier?.phone && (
                  <a
                    href={`https://wa.me/55${(order.supplier.area_code + order.supplier.phone).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 mr-1 inline-flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full p-1"
                    title="Conversar no WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                )}
                <span className="ml-1">{order.supplier?.name}</span>
              </p>
              <p><span className="font-semibold">Data:</span> {new Date(order.created_at).toLocaleDateString()}</p>
              {order.delivery_time && (
                <p><span className="font-semibold">Prazo de entrega:</span> {order.delivery_time}</p>
              )}
            </div>
            <div>
              <p>
                <span className="font-semibold">Status:</span>{' '}
                <span className={`px-2 py-1 text-sm rounded-full ${
                  order.status === 'pending' 
                    ? 'bg-yellow-100 text-yellow-800'
                    : order.status === 'sending'
                    ? 'bg-blue-100 text-blue-800'
                    : order.status === 'sent'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {order.status === 'pending' ? 'Pendente' :
                   order.status === 'sending' ? 'Enviando' :
                   order.status === 'sent' ? 'Enviado' : order.status}
                </span>
              </p>
              <p><span className="font-semibold">Total:</span> R$ {order.total_amount.toFixed(2)}</p>
              {order.vehicle && (
                <div>
                  <p><span className="font-semibold">Veículo:</span> {order.vehicle.brand} {order.vehicle.model} ({order.vehicle.year})</p>
                  {vehicleImage && (
                    <div className="mt-2">
                      <img 
                        src={vehicleImage} 
                        alt={`${order.vehicle.brand} ${order.vehicle.model}`}
                        className="w-full max-w-xs rounded-lg shadow-md"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {order.notes && (
            <div className="mt-4">
              <p><span className="font-semibold">Observações:</span> {order.notes}</p>
            </div>
          )}
        </div>

        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Itens</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Unitário</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
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
                    <td className="px-6 py-4 text-sm text-gray-500">{item.quantity}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">R$ {item.unit_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">R$ {item.total_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-6 py-4 text-right font-medium">Total:</td>
                  <td className="px-6 py-4 text-sm font-bold">R$ {order.total_amount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
