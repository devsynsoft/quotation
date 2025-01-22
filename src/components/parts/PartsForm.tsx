import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Part = {
  operation: string;
  code: string;
  description: string;
  part_type: string;
  quantity: number;
  painting_hours: number;
  notes: string;
};

export function PartsForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [mode, setMode] = React.useState<'single' | 'bulk' | 'description'>('single');
  const [parts, setParts] = React.useState<Part[]>([]);
  const [bulkText, setBulkText] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedVehicle, setSelectedVehicle] = React.useState('');
  const [vehicles, setVehicles] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetchVehicles();
  }, []);

  async function fetchVehicles() {
    const { data } = await supabase
      .from('vehicles')
      .select('id, brand, model, manufacturing_year, model_year, chassis');
    
    if (data) {
      setVehicles(data);
    }
  }

  function handleAddPart() {
    setParts([...parts, {
      operation: '',
      code: '',
      description: '',
      part_type: 'unknown',
      quantity: 1,
      painting_hours: 0,
      notes: ''
    }]);
  }

  function handlePartChange(index: number, field: keyof Part, value: any) {
    const newParts = [...parts];
    
    if (field === 'description') {
      // Exemplo: 71103T5NM50 - (I) ACAB DIR FAROL NEBL (f) Genuína 1
      const match = value.match(/^(\S+)\s*-?\s*\(([^)]+)\)\s+([^(]+)\s+\(([^)]+)\)\s+(\S+)/);
      if (match) {
        const [, code, type1, description, partType, quantity] = match;
        newParts[index] = {
          ...newParts[index],
          code,
          description: description.trim(),
          part_type: partType.toLowerCase().includes('genuína') ? 'genuine' : 
                    partType.toLowerCase().includes('usada') ? 'used' : 'new',
          quantity: parseInt(quantity) || 1,
        };
      } else {
        newParts[index] = { ...newParts[index], [field]: value };
      }
    } else if (field === 'notes') {
      // Extrai operação e preço das observações
      const operationMatch = value.match(/Operação:\s*([^\/]+)/i);
      if (operationMatch) {
        newParts[index].operation = operationMatch[1].trim();
      }
    } else {
      newParts[index] = { ...newParts[index], [field]: value };
    }
    
    setParts(newParts);
  }

  function handleRemovePart(index: number) {
    setParts(parts.filter((_, i) => i !== index));
  }

  function parseBulkText(text: string): Part[] {
    return text.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Exemplo: TROCAR 71103T5NM50 (I) ACAB DIR FAROL NEBL (f) Genuína 1
        const match = line.match(/^(TROCAR(?:\/PINTAR)?)\s+(\S+)\s+\(([^)]+)\)\s+([^(]+)\s+\(([^)]+)\)\s+(\d+)(?:\s+(\d+(?:[,.]\d+)?))?/);
        if (!match) return null;

        const [, operation, code, type1, description, partType, quantity, price] = match;
        const unitPrice = price ? parseFloat(price.replace(',', '.')) : 0;
        
        return {
          operation: operation.trim(),
          code: code.trim(),
          description: description.trim(),
          part_type: partType.toLowerCase().includes('genuína') ? 'genuine' : 
                    partType.toLowerCase().includes('usada') ? 'used' : 'new',
          quantity: parseInt(quantity) || 1,
          painting_hours: operation.toLowerCase().includes('pintar') ? 1.17 : 0,
          notes: `Operação: ${operation.trim()}${unitPrice ? `/Preço Unitário: ${unitPrice}` : ''}`
        };
      })
      .filter((part): part is Part => 
        part !== null && 
        part.description.length > 0
      );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicle) {
      setError('Por favor selecione um veículo');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      let partsToSave: Part[] = [];

      if (mode === 'bulk') {
        partsToSave = parseBulkText(bulkText);
        if (partsToSave.length === 0) {
          setError('Nenhuma peça válida encontrada no texto. Cada linha deve começar com TROCAR e conter uma descrição.');
          return;
        }
      } else if (mode === 'description') {
        if (!description.trim()) {
          setError('Descrição é obrigatória');
          return;
        }
        partsToSave = [{
          operation: '',
          code: '',
          description: description.trim(),
          part_type: 'unknown',
          quantity: 1,
          painting_hours: 0,
          notes: 'Da descrição'
        }];
      } else {
        if (parts.length === 0) {
          setError('Adicione pelo menos uma peça');
          return;
        }
        if (parts.some(part => !part.description.trim())) {
          setError('Todas as peças precisam ter uma descrição');
          return;
        }
        partsToSave = parts;
      }

      const { error: saveError } = await supabase
        .from('parts')
        .insert(partsToSave.map(part => ({
          ...part,
          vehicle_id: selectedVehicle,
          user_id: user.id
        })));

      if (saveError) throw saveError;

      navigate('/parts');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Adicionar Peças</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700">Veículo</label>
        <select
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          value={selectedVehicle}
          onChange={e => setSelectedVehicle(e.target.value)}
        >
          <option value="">Selecione um veículo</option>
          {vehicles.map(vehicle => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.brand} {vehicle.model} ({vehicle.manufacturing_year}/{vehicle.model_year}) - {vehicle.chassis}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`px-4 py-2 rounded-lg ${
              mode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            Uma por Uma
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`px-4 py-2 rounded-lg ${
              mode === 'bulk' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            Importação em Massa
          </button>
          <button
            type="button"
            onClick={() => setMode('description')}
            className={`px-4 py-2 rounded-lg ${
              mode === 'description' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            Descrição
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === 'single' && (
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
        )}

        {mode === 'bulk' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cole a lista de peças
            </label>
            <textarea
              className="w-full h-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono"
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="TROCAR 62 07 244 26R (I) CJ FRISOS NEBLINA Genuína 1 131,37 131,37 0,00 0.00 0.00"
            />
            <p className="mt-2 text-sm text-gray-500">
              Cada linha deve começar com TROCAR e seguir o formato:<br />
              TROCAR [código] (I) [descrição] [tipo] [quantidade] [preço unitário]
            </p>
          </div>
        )}

        {mode === 'description' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descreva as peças necessárias
            </label>
            <textarea
              className="w-full h-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Exemplo: Peças dianteiras para Sandero incluindo para-choque, grade e faróis"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Salvar Peças'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}