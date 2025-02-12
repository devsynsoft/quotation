import React from 'react';
import { Plus } from 'lucide-react';

export interface QuotationPart {
  operation: string;
  code: string;
  description: string;
  part_type: string;
  quantity: number;
  painting_hours: number;
}

interface QuotationPartFormProps {
  parts: QuotationPart[];
  onChange: (parts: QuotationPart[]) => void;
  mode: 'manual' | 'bulk';
}

export function QuotationPartForm({ parts, onChange, mode }: QuotationPartFormProps) {
  function handleAddPart() {
    onChange([...parts, {
      operation: '',
      code: '',
      description: '',
      part_type: '',
      quantity: 1,
      painting_hours: 0
    }]);
  }

  function handleRemovePart(index: number) {
    const newParts = [...parts];
    newParts.splice(index, 1);
    onChange(newParts);
  }

  function handlePartChange(index: number, field: keyof QuotationPart, value: any) {
    const newParts = [...parts];
    newParts[index] = { ...newParts[index], [field]: value };
    onChange(newParts);
  }

  function handleBulkTextChange(text: string) {
    const parts = text.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Normaliza o texto removendo espaços extras e caracteres especiais
        const normalizedLine = line.trim()
          .replace(/\s+/g, ' ')
          .replace(/[\u200B-\u200D\uFEFF]/g, '');

        // Diferentes formatos de operação
        const operationRegex = /^(TROCAR(?:\/PINTAR)?|PINTAR|RECUPERAR)/i;
        const operationMatch = normalizedLine.match(operationRegex);
        if (!operationMatch) return null;

        const operation = operationMatch[1].toUpperCase();

        // Remove a operação do início e processa o resto
        const restOfLine = normalizedLine.slice(operation.length).trim();

        // Tenta extrair código, tipo e descrição
        const partRegex = /^(\S+)\s*(?:\(([^)]+)\))?\s*([^(]+)(?:\s*\(([^)]+)\))?\s*(\d+)?/;
        const match = restOfLine.match(partRegex);
        if (!match) return null;

        const [, code, type1, description, partType, quantity] = match;

        // Determina o tipo da peça
        let finalPartType = 'new'; // default
        if (partType) {
          if (partType.toLowerCase().includes('genuína') || partType.toLowerCase().includes('genuina')) {
            finalPartType = 'genuine';
          } else if (partType.toLowerCase().includes('usada')) {
            finalPartType = 'used';
          }
        }

        // Calcula horas de pintura baseado na operação
        let paintingHours = 0;
        if (operation.includes('PINTAR')) {
          paintingHours = 1.17; // Padrão para pintura
        } else if (operation === 'RECUPERAR') {
          paintingHours = 2.34; // Dobro para recuperação
        }

        return {
          operation: operation.trim(),
          code: code.trim(),
          description: description.trim(),
          part_type: finalPartType,
          quantity: parseInt(quantity) || 1,
          painting_hours: paintingHours
        };
      })
      .filter((part): part is QuotationPart => part !== null);

    onChange(parts);
  }

  if (mode === 'bulk') {
    return (
      <div className="space-y-4">
        <textarea
          className="w-full h-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Cole aqui sua lista de peças..."
          onChange={e => handleBulkTextChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {parts.map((part, index) => (
        <div key={index} className="p-4 border rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Operação *</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={part.operation}
                onChange={e => handlePartChange(index, 'operation', e.target.value)}
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
                value={part.code}
                onChange={e => handlePartChange(index, 'code', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Descrição *</label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={part.description}
              onChange={e => handlePartChange(index, 'description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo da Peça *</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={part.part_type}
                onChange={e => handlePartChange(index, 'part_type', e.target.value)}
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
                value={part.quantity}
                onChange={e => handlePartChange(index, 'quantity', parseInt(e.target.value))}
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
              value={part.painting_hours}
              onChange={e => handlePartChange(index, 'painting_hours', parseFloat(e.target.value))}
            />
          </div>

          <button
            type="button"
            onClick={() => handleRemovePart(index)}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            Remover
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={handleAddPart}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Plus className="h-5 w-5 mr-2" /> Adicionar Peça
      </button>
    </div>
  );
}
