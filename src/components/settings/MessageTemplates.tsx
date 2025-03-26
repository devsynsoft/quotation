import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { customToast } from '../../lib/toast';
import { useAuth } from '../../hooks/useAuth';

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  sequence: number;
  user_id?: string;
  created_at?: string;
}

export function MessageTemplates() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('sequence', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
      customToast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveTemplate = async (template: MessageTemplate, direction: 'up' | 'down') => {
    const currentIndex = templates.findIndex(t => t.id === template.id);
    if (
      (direction === 'up' && currentIndex === 0) || 
      (direction === 'down' && currentIndex === templates.length - 1)
    ) {
      return;
    }

    const newSequence = direction === 'up' 
      ? templates[currentIndex - 1].sequence
      : templates[currentIndex + 1].sequence;

    try {
      // First update other templates' sequences
      const { error: rpcError } = await supabase.rpc(
        direction === 'up' ? 'update_template_sequences_up' : 'update_template_sequences_down',
        {
          p_template_id: template.id,
          p_old_sequence: template.sequence,
          p_new_sequence: newSequence
        }
      );

      if (rpcError) throw rpcError;

      // Then update the current template's sequence
      const { error: updateError } = await supabase
        .from('message_templates')
        .update({ sequence: newSequence })
        .eq('id', template.id);

      if (updateError) throw updateError;

      await loadTemplates();
      customToast.success('Ordem atualizada com sucesso');
    } catch (err) {
      console.error('Erro ao atualizar ordem:', err);
      customToast.error('Erro ao atualizar ordem');
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    if (!editingTemplate.name.trim() || !editingTemplate.content.trim()) {
      customToast.error('Por favor, preencha o nome e o conteúdo do template');
      return;
    }

    try {
      setSaving(true);
      
      // Se é um novo template, pega a maior sequência e adiciona 1
      let sequence = editingTemplate.sequence;
      if (!editingTemplate.id) {
        const maxSequence = templates.reduce((max, t) => Math.max(max, t.sequence || 0), 0);
        sequence = maxSequence + 1;
      }

      // Create a new template object with required fields
      const templateData = {
        name: editingTemplate.name,
        content: editingTemplate.content,
        sequence,
        user_id: user?.id || '',
        is_default: editingTemplate.is_default || false
      };

      // If we have an ID, it's an update
      if (editingTemplate.id) {
        const { error } = await supabase
          .from('message_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        // Otherwise it's an insert
        const { error } = await supabase
          .from('message_templates')
          .insert(templateData);

        if (error) throw error;
      }

      customToast.success('Template salvo com sucesso');
      setEditingTemplate(null);
      await loadTemplates();
    } catch (err) {
      console.error('Erro ao salvar template:', err);
      customToast.error('Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: MessageTemplate) => {
    if (template.is_default) {
      customToast.error('Não é possível excluir o template padrão');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      customToast.success('Template excluído com sucesso');
      await loadTemplates();
    } catch (err) {
      console.error('Erro ao excluir template:', err);
      customToast.error('Erro ao excluir template');
    }
  };

  const createNewTemplate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      content: '',
      is_default: false,
      sequence: 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Templates de Mensagem</h2>
        <button
          onClick={createNewTemplate}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Lista de Templates */}
          {templates.map((template, index) => (
            <div key={template.id} className="bg-white shadow rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveTemplate(template, 'up')}
                      disabled={index === 0}
                      className={`p-1 rounded hover:bg-gray-100 ${index === 0 ? 'text-gray-300' : 'text-gray-600'}`}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveTemplate(template, 'down')}
                      disabled={index === templates.length - 1}
                      className={`p-1 rounded hover:bg-gray-100 ${index === templates.length - 1 ? 'text-gray-300' : 'text-gray-600'}`}
                    >
                      ▼
                    </button>
                  </div>
                  <div>
                    <h3 className="font-medium">{template.name}</h3>
                    {template.is_default && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        Padrão
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingTemplate(template)}
                    className="text-gray-600 hover:text-blue-600"
                  >
                    Editar
                  </button>
                  {!template.is_default && (
                    <button
                      onClick={() => handleDelete(template)}
                      className="text-gray-600 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                {template.content}
              </pre>
            </div>
          ))}

          {/* Modal de Edição */}
          {editingTemplate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-2xl w-full p-6">
                <h3 className="text-lg font-medium mb-4">
                  {editingTemplate.id ? 'Editar Template' : 'Novo Template'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={e => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Nome do template"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Conteúdo
                    </label>
                    <textarea
                      value={editingTemplate.content}
                      onChange={e => setEditingTemplate(prev => prev ? { ...prev, content: e.target.value } : null)}
                      rows={10}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Digite o conteúdo do template..."
                    />
                  </div>

                  <div className="text-sm text-gray-500">
                    <p className="font-medium mb-1">Variáveis disponíveis:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>{'{vehicle_brand}'} - Marca do veículo</li>
                      <li>{'{vehicle_model}'} - Modelo do veículo</li>
                      <li>{'{vehicle_year}'} - Ano do veículo</li>
                      <li>{'{vehicle_chassis}'} - Chassi do veículo (se disponível)</li>
                      <li>{'{parts_list}'} - Lista de peças com quantidades</li>
                      <li>{'{quotation_link}'} - Link para responder a cotação</li>
                    </ul>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setEditingTemplate(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Salvar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
