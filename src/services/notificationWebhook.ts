const WEBHOOK_URL = "https://webhook.synsoft.com.br/webhook/ce0f0fa6-34b8-477d-898c-1a8c5e05ef9c";

type WebhookSupplier = {
  id: string;
  name: string | null;
  phone: string | null;
  area_code: string | null;
};

type WebhookVehicle = {
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  chassis?: string | null;
};

type WebhookPart = {
  operation: string;
  code: string;
  description: string;
  part_type: string;
  quantity: number;
  painting_hours?: number;
};

export interface WebhookRequestPayload {
  request_id: string;
  supplier: WebhookSupplier;
  supplier_link: string;
  parts: WebhookPart[];
  parts_text: string;
  cover_image?: string | null;
}

export interface WebhookNotificationPayload {
  quotation_id: string;
  vehicle: WebhookVehicle;
  requests: WebhookRequestPayload[];
}

export async function sendNotification(
  payload: WebhookNotificationPayload
): Promise<{ success: boolean; error?: Error }> {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro no webhook: ${response.status} ${response.statusText} - ${text}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    return { success: false, error: error as Error };
  }
}
