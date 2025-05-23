import React from 'react';
import { Plus } from 'lucide-react';

type QuotationItem = {
  operation: string;
  code: string;
  description: string;
  part_type: string;
  quantity: number;
  painting_hours: number;
};

interface QuotationItemFormProps {
  items: QuotationItem[];
  onChange: (items: QuotationItem[]) => void;
}

export function QuotationItemForm({ items, onChange }: QuotationItemFormProps) {
  function handleAddItem() {
    onChange([...items, {
      operation: '',
      code: '',
      description: '',
      part_type: '',
      quantity: 1,
      painting_hours: 0
    }]);
  }

  function handleRemoveItem(index: number) {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  }

  function handleItemChange(index: number, field: keyof QuotationItem, value: any) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="p-4 border rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Operação *</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={item.operation}
                onChange={e => handleItemChange(index, 'operation', e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="TROCAR">TROCAR</option>
                <option value="TROCAR/PINTAR">TROCAR/PINTAR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Código *</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={item.code}
                onChange={e => handleItemChange(index, 'code', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Descrição *</label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={item.description}
              onChange={e => handleItemChange(index, 'description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo da Peça *</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={item.part_type}
                onChange={e => handleItemChange(index, 'part_type', e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="genuine">Genuína</option>
                <option value="new">Nova</option>
                <option value="used">Usada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantidade *</label>
              <input
                type="number"
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={item.quantity}
                onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Horas Pintura</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={item.painting_hours}
              onChange={e => handleItemChange(index, 'painting_hours', parseFloat(e.target.value))}
            />
          </div>

          <button
            type="button"
            onClick={() => handleRemoveItem(index)}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            Remover
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={handleAddItem}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Plus className="h-5 w-5 mr-2" /> Adicionar Peça
      </button>
    </div>
  );
}
