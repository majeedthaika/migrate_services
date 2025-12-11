import type {
  Migration,
  MigrationCreate,
  EntitySchema,
  TransformType,
  PreviewRequest,
  PreviewResponse,
  FieldMapping,
} from '@/types/migration';

const API_URL = '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    return { error: error.detail || 'Request failed' };
  }
  const data = await response.json();
  return { data };
}

// Migration API
export const migrationAPI = {
  async list(): Promise<ApiResponse<{ migrations: Migration[]; total: number }>> {
    const response = await fetch(`${API_URL}/migrations`);
    return handleResponse(response);
  },

  async get(id: string): Promise<ApiResponse<Migration>> {
    const response = await fetch(`${API_URL}/migrations/${id}`);
    return handleResponse(response);
  },

  async create(data: MigrationCreate): Promise<ApiResponse<Migration>> {
    const response = await fetch(`${API_URL}/migrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async update(id: string, data: Partial<MigrationCreate>): Promise<ApiResponse<Migration>> {
    const response = await fetch(`${API_URL}/migrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async delete(id: string): Promise<ApiResponse<{ status: string }>> {
    const response = await fetch(`${API_URL}/migrations/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async start(id: string): Promise<ApiResponse<{ status: string; migration_id: string }>> {
    const response = await fetch(`${API_URL}/migrations/${id}/start`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async pause(id: string): Promise<ApiResponse<{ status: string }>> {
    const response = await fetch(`${API_URL}/migrations/${id}/pause`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async resume(id: string): Promise<ApiResponse<{ status: string }>> {
    const response = await fetch(`${API_URL}/migrations/${id}/resume`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async cancel(id: string): Promise<ApiResponse<{ status: string }>> {
    const response = await fetch(`${API_URL}/migrations/${id}/cancel`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async rollback(id: string): Promise<ApiResponse<{ status: string }>> {
    const response = await fetch(`${API_URL}/migrations/${id}/rollback`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  createEventStream(migrationId: string): EventSource {
    return new EventSource(`${API_URL}/events/migration/${migrationId}`);
  },
};

// Schema API
export const schemaAPI = {
  async list(): Promise<ApiResponse<{ schemas: Record<string, string[]> }>> {
    const response = await fetch(`${API_URL}/schemas`);
    return handleResponse(response);
  },

  async getService(service: string): Promise<ApiResponse<{ service: string; entities: string[] }>> {
    const response = await fetch(`${API_URL}/schemas/${service}`);
    return handleResponse(response);
  },

  async getEntity(service: string, entity: string): Promise<ApiResponse<EntitySchema>> {
    const response = await fetch(`${API_URL}/schemas/${service}/${entity}`);
    return handleResponse(response);
  },

  async infer(
    data: unknown[],
    service: string,
    entity: string
  ): Promise<ApiResponse<{ schema: EntitySchema; sample_values: Record<string, unknown> }>> {
    const response = await fetch(`${API_URL}/schemas/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, service, entity }),
    });
    return handleResponse(response);
  },
};

// Mapping API
export const mappingAPI = {
  async list(): Promise<ApiResponse<{ mappings: unknown[]; total: number }>> {
    const response = await fetch(`${API_URL}/mappings`);
    return handleResponse(response);
  },

  async save(data: {
    name: string;
    source_service: string;
    source_entity: string;
    target_service: string;
    target_entity: string;
    field_mappings: FieldMapping[];
  }): Promise<ApiResponse<unknown>> {
    const response = await fetch(`${API_URL}/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async delete(id: string): Promise<ApiResponse<{ status: string }>> {
    const response = await fetch(`${API_URL}/mappings/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async getTransformTypes(): Promise<ApiResponse<{ transforms: TransformType[] }>> {
    const response = await fetch(`${API_URL}/mappings/transforms/types`);
    return handleResponse(response);
  },
};

// Preview API
export const previewAPI = {
  async transform(data: PreviewRequest): Promise<ApiResponse<PreviewResponse>> {
    const response = await fetch(`${API_URL}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async transformBatch(data: PreviewRequest[]): Promise<ApiResponse<PreviewResponse[]>> {
    const response = await fetch(`${API_URL}/preview/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};
