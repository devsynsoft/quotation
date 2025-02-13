import { supabase } from '../lib/supabase';

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  user_id: string;
  sequence: number;
}

export async function updateTemplateSequence(templateId: string, newSequence: number): Promise<{ error?: Error }> {
  try {
    // Primeiro, obtém o template atual e sua sequência
    const { data: currentTemplate, error: getError } = await supabase
      .from('message_templates')
      .select('sequence')
      .eq('id', templateId)
      .single();

    if (getError) {
      throw getError;
    }

    if (!currentTemplate) {
      throw new Error('Template não encontrado');
    }

    // Atualiza as sequências dos outros templates
    if (newSequence > currentTemplate.sequence) {
      // Movendo para baixo: decrementa os templates entre a posição antiga e nova
      await supabase.rpc('update_template_sequences_down', {
        p_template_id: templateId,
        p_old_sequence: currentTemplate.sequence,
        p_new_sequence: newSequence
      });
    } else if (newSequence < currentTemplate.sequence) {
      // Movendo para cima: incrementa os templates entre a posição nova e antiga
      await supabase.rpc('update_template_sequences_up', {
        p_template_id: templateId,
        p_old_sequence: currentTemplate.sequence,
        p_new_sequence: newSequence
      });
    }

    // Atualiza a sequência do template atual
    const { error: updateError } = await supabase
      .from('message_templates')
      .update({ sequence: newSequence })
      .eq('id', templateId);

    if (updateError) {
      throw updateError;
    }

    return {};
  } catch (error) {
    console.error('Erro ao atualizar sequência:', error);
    return { error: error as Error };
  }
}
