import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { clearAbbreviationsCache } from '../utils/textUtils';

interface TextAbbreviation {
  id: string;
  abbreviation: string;
  full_text: string;
}

interface TextAbbreviationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAbbreviationsUpdated: () => void;
}

export default function TextAbbreviationsModal({ 
  isOpen, 
  onClose,
  onAbbreviationsUpdated 
}: TextAbbreviationsModalProps) {
  const [abbreviations, setAbbreviations] = useState<TextAbbreviation[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAbbreviation, setNewAbbreviation] = useState({ abbreviation: '', full_text: '' });
  const { user } = useAuth();

  // Carrega abreviações existentes
  const loadAbbreviations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('text_abbreviations')
        .select('*')
        .order('abbreviation');

      if (error) throw error;
      setAbbreviations(data || []);
    } catch (err: any) {
      toast.error(`Erro ao carregar abreviações: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAbbreviations();
    }
  }, [isOpen]);

  // Adiciona nova abreviação
  const handleAdd = async () => {
    if (!newAbbreviation.abbreviation || !newAbbreviation.full_text) {
      toast.error('Preencha a abreviação e o texto completo');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('text_abbreviations')
        .insert([{
          abbreviation: newAbbreviation.abbreviation.toUpperCase(),
          full_text: newAbbreviation.full_text.toUpperCase(),
          created_by: user?.id
        }]);

      if (error) throw error;

      toast.success('Abreviação adicionada com sucesso');
      setNewAbbreviation({ abbreviation: '', full_text: '' });
      clearAbbreviationsCache();
      await loadAbbreviations();
      onAbbreviationsUpdated();
    } catch (err: any) {
      toast.error(`Erro ao adicionar abreviação: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Remove uma abreviação
  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('text_abbreviations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Abreviação removida com sucesso');
      clearAbbreviationsCache();
      await loadAbbreviations();
      onAbbreviationsUpdated();
    } catch (err: any) {
      toast.error(`Erro ao remover abreviação: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-medium">
              Gerenciar Abreviações de Texto
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Formulário para adicionar nova abreviação */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Abreviação"
                className="flex-1 border rounded px-2 py-1"
                value={newAbbreviation.abbreviation}
                onChange={e => setNewAbbreviation(prev => ({ 
                  ...prev, 
                  abbreviation: e.target.value 
                }))}
              />
              <input
                type="text"
                placeholder="Texto Completo"
                className="flex-1 border rounded px-2 py-1"
                value={newAbbreviation.full_text}
                onChange={e => setNewAbbreviation(prev => ({ 
                  ...prev, 
                  full_text: e.target.value 
                }))}
              />
              <button
                onClick={handleAdd}
                disabled={loading}
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Lista de abreviações */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Abreviação</th>
                      <th className="text-left py-2">Texto Completo</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {abbreviations.map(abbr => (
                      <tr key={abbr.id} className="border-b">
                        <td className="py-2">{abbr.abbreviation}</td>
                        <td className="py-2">{abbr.full_text}</td>
                        <td>
                          <button
                            onClick={() => handleDelete(abbr.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t">
            <button
              onClick={onClose}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
