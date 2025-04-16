import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Plus, Trash2, Pencil } from 'lucide-react';

// Mapeamento para exibição amigável
const SPECIALIZATION_LABELS: Record<string, string> = {
  bodywork: 'Lataria',
  mechanical: 'Mecânica',
  lights: 'Elétrica',
  finishing: 'Acabamento',
  others: 'Outros',
  all: 'Todas',
};

function toSlug(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-/g, '_');
}

interface Specialization {
  id: string;
  name: string;
  created_at: string;
}

export default function SpecializationList() {
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    fetchSpecializations();
  }, []);

  async function fetchSpecializations() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('specializations')
      .select('*')
      .order('name');
    if (error) setError('Erro ao carregar especializações');
    setSpecializations(data || []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    // Gera slug para salvar como chave interna
    const slug = toSlug(newName.trim());
    const { error } = await supabase
      .from('specializations')
      .insert([{ name: slug }]);
    if (error) {
      setError('Erro ao adicionar especialização');
      return;
    }
    setNewName('');
    fetchSpecializations();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Deseja realmente excluir esta especialização?')) return;
    const { error } = await supabase
      .from('specializations')
      .delete()
      .eq('id', id);
    if (error) {
      setError('Erro ao excluir especialização');
      return;
    }
    fetchSpecializations();
  }

  async function handleEdit() {
    if (!editingId || !editingName.trim()) return;
    // Atualiza o slug ao editar
    const slug = toSlug(editingName.trim());
    const { error } = await supabase
      .from('specializations')
      .update({ name: slug })
      .eq('id', editingId);
    if (error) {
      setError('Erro ao editar especialização');
      return;
    }
    setEditingId(null);
    setEditingName('');
    fetchSpecializations();
  }

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Especializações</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="border rounded px-2 py-1 flex-1"
          placeholder="Nova especialização"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center"
          onClick={handleAdd}
          disabled={loading}
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </button>
      </div>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <ul>
          {specializations.map(spec => (
            <li key={spec.id} className="flex items-center justify-between py-2 border-b">
              {editingId === spec.id ? (
                <>
                  <input
                    type="text"
                    className="border rounded px-2 py-1 flex-1 mr-2"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEdit()}
                  />
                  <button className="text-green-600 mr-2" onClick={handleEdit}>Salvar</button>
                  <button className="text-gray-500" onClick={() => setEditingId(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span>{SPECIALIZATION_LABELS[spec.name] || spec.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  <div className="flex gap-2">
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => { setEditingId(spec.id); setEditingName(spec.name); }}
                    >
                      <Pencil className="w-4 h-4 inline" />
                    </button>
                    <button
                      className="text-red-600 hover:underline"
                      onClick={() => handleDelete(spec.id)}
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
