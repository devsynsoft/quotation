import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Loader2, FileText, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PurchaseOrder {
  id: string;
  created_at: string;
  total_price: number;
  status: string;
  items: {
    id: string;
    part_index: number;
    quantity: number;
    unit_price: number;
    total_price: number;
    quotation_request: {
      response_data: {
        supplier_name: string;
        supplier_phone: string;
        parts: any[];
      };
    };
  }[];
}

export default function QuotationOrders() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    if (id) {
      loadOrders();
    }
  }, [id]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          items:purchase_order_items(
            *,
            quotation_request:quotation_requests(*)
          )
        `)
        .eq('quotation_id', id);

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Erro ao carregar ordens:', err);
      toast.error('Erro ao carregar ordens');
    } finally {
      setLoading(false);
    }
  };

  const printOrder = (order: PurchaseOrder) => {
    // Implementar a impressão da ordem de compra
    console.log('Imprimir ordem:', order);
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
        <h1 className="text-2xl font-bold mb-6">Ordens de Compra</h1>

        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-gray-500 mr-2" />
                    <h3 className="font-medium text-lg">
                      Ordem #{order.id.slice(0, 8)}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Criada em: {new Date(order.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm font-medium mt-2">
                    Total: {order.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <button
                  onClick={() => printOrder(order)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </button>
              </div>

              <div className="mt-4">
                <h4 className="font-medium mb-2">Itens</h4>
                <div className="space-y-4">
                  {order.items.map((item) => {
                    const part = item.quotation_request.response_data.parts[item.part_index];
                    return (
                      <div key={item.id} className="border-t pt-4">
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium">{part.description}</p>
                            <p className="text-sm text-gray-600">
                              Fornecedor: {item.quotation_request.response_data.supplier_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              Quantidade: {item.quantity}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">
                              Preço Un.: {item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-sm font-medium">
                              Total: {item.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhuma ordem de compra gerada ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
