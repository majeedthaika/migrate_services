import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ArrowRight, Plus, Trash2, Settings, GripVertical, Upload, Sparkles, Wand2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Input, Modal } from '@/components/ui';
import { DataInputModal } from '@/components/DataInputModal';
import { useMigrationStore } from '@/store/migration';
import { mappingAPI } from '@/lib/api';
import type { FieldSchema, EntityMapping, FieldMapping, TransformType } from '@/types/migration';
import { cn } from '@/lib/utils';

interface DraggableFieldProps {
  field: FieldSchema;
  isMapped: boolean;
}

function DraggableField({ field, isMapped }: DraggableFieldProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${field.name}`,
    data: { field },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-grab',
        isDragging && 'opacity-50',
        isMapped
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10'
          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50'
      )}
    >
      <GripVertical className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      <span className="flex-1">{field.name}</span>
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{field.type}</span>
      {field.required && <span className="text-xs text-[hsl(var(--destructive))]">*</span>}
    </div>
  );
}

interface DroppableTargetFieldProps {
  field: FieldSchema;
  mapping?: FieldMapping;
  onConfigure: () => void;
  onRemove: () => void;
}

function DroppableTargetField({ field, mapping, onConfigure, onRemove }: DroppableTargetFieldProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `target-${field.name}`,
    data: { field },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm min-h-[42px]',
        isOver && 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10',
        mapping
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
          : field.required
          ? 'border-[hsl(var(--destructive))]/50 border-dashed'
          : 'border-[hsl(var(--border))] border-dashed'
      )}
    >
      {mapping ? (
        <>
          <span className="flex-1 font-medium">{mapping.source_field}</span>
          <ArrowRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="flex-1">{field.name}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))] px-1.5 py-0.5 rounded">
            {mapping.transform}
          </span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onConfigure}>
            <Settings className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-[hsl(var(--destructive))]" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-[hsl(var(--muted-foreground))]">Drop source field here</span>
          <span>{field.name}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{field.type}</span>
          {field.required && <span className="text-xs text-[hsl(var(--destructive))]">*</span>}
        </>
      )}
    </div>
  );
}

interface TransformConfigModalProps {
  open: boolean;
  onClose: () => void;
  mapping: FieldMapping | null;
  transforms: TransformType[];
  onSave: (mapping: FieldMapping) => void;
}

function TransformConfigModal({ open, onClose, mapping, transforms, onSave }: TransformConfigModalProps) {
  const [transform, setTransform] = useState(mapping?.transform || 'direct');
  const [config, setConfig] = useState<Record<string, unknown>>(mapping?.config || {});

  useEffect(() => {
    if (mapping) {
      setTransform(mapping.transform);
      setConfig(mapping.config);
    }
  }, [mapping]);

  const selectedTransform = transforms.find((t) => t.name === transform);

  const handleSave = () => {
    if (mapping) {
      onSave({ ...mapping, transform, config });
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Configure Transformation">
      <div className="space-y-4">
        {mapping && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{mapping.source_field}</span>
            <ArrowRight className="h-4 w-4" />
            <span className="font-medium">{mapping.target_field}</span>
          </div>
        )}

        <Select
          label="Transformation Type"
          options={transforms.map((t) => ({ value: t.name, label: `${t.name} - ${t.description}` }))}
          value={transform}
          onChange={(e) => {
            setTransform(e.target.value);
            setConfig({});
          }}
        />

        {selectedTransform && Object.keys(selectedTransform.config_schema).length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Configuration</h4>
            {Object.entries(selectedTransform.config_schema).map(([key, schema]: [string, any]) => (
              <div key={key}>
                {schema.type === 'object' ? (
                  <div>
                    <label className="mb-1.5 block text-sm">{key}</label>
                    <textarea
                      className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm font-mono"
                      rows={4}
                      value={JSON.stringify(config[key] || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          setConfig({ ...config, [key]: JSON.parse(e.target.value) });
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      placeholder='{"source_value": "target_value"}'
                    />
                  </div>
                ) : schema.enum ? (
                  <Select
                    label={key}
                    options={schema.enum.map((v: string) => ({ value: v, label: v }))}
                    value={(config[key] as string) || ''}
                    onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                  />
                ) : (
                  <Input
                    label={key}
                    type={schema.type === 'boolean' ? 'checkbox' : 'text'}
                    value={(config[key] as string) || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [key]: schema.type === 'boolean' ? e.target.checked : e.target.value,
                      })
                    }
                    placeholder={schema.default?.toString()}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

export function MappingEditor() {
  const {
    sourceSchemas,
    targetSchema,
    entityMappings,
    setEntityMappings,
    addEntityMapping,
  } = useMigrationStore();

  const [transforms, setTransforms] = useState<TransformType[]>([]);
  const [activeField, setActiveField] = useState<FieldSchema | null>(null);
  const [configureMapping, setConfigureMapping] = useState<FieldMapping | null>(null);
  const [selectedSourceKey, setSelectedSourceKey] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Parse selected source key
  const [selectedSourceService, selectedSourceEntity] = selectedSourceKey.split(':');
  const selectedSourceSchema = sourceSchemas.find(
    (s) => s.service === selectedSourceService && s.entity === selectedSourceEntity
  );

  // Get current entity mapping
  const currentMapping = entityMappings.find(
    (m) =>
      m.source_service === selectedSourceService &&
      m.source_entity === selectedSourceEntity &&
      m.target_service === targetSchema?.service &&
      m.target_entity === targetSchema?.entity
  );
  const fieldMappings = currentMapping?.field_mappings || [];

  // Load transforms
  useEffect(() => {
    const loadData = async () => {
      const transformsRes = await mappingAPI.getTransformTypes();
      if (transformsRes.data) {
        setTransforms(transformsRes.data.transforms);
      }
    };
    loadData();
  }, []);

  // Auto-select first source schema
  useEffect(() => {
    if (sourceSchemas.length > 0 && !selectedSourceKey) {
      const first = sourceSchemas[0];
      setSelectedSourceKey(`${first.service}:${first.entity}`);
    }
  }, [sourceSchemas, selectedSourceKey]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveField(event.active.data.current?.field);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveField(null);

    const { active, over } = event;
    if (!over || !targetSchema) return;

    const sourceField = active.data.current?.field as FieldSchema;
    const targetField = over.data.current?.field as FieldSchema;

    if (sourceField && targetField) {
      const newMapping: FieldMapping = {
        source_field: sourceField.name,
        target_field: targetField.name,
        transform: 'direct',
        config: {},
      };

      const existingIndex = entityMappings.findIndex(
        (m) =>
          m.source_service === selectedSourceService &&
          m.source_entity === selectedSourceEntity &&
          m.target_service === targetSchema.service &&
          m.target_entity === targetSchema.entity
      );

      if (existingIndex >= 0) {
        const updated = { ...entityMappings[existingIndex] };
        const fieldIndex = updated.field_mappings.findIndex((f) => f.target_field === targetField.name);

        if (fieldIndex >= 0) {
          updated.field_mappings[fieldIndex] = newMapping;
        } else {
          updated.field_mappings.push(newMapping);
        }

        const newEntityMappings = [...entityMappings];
        newEntityMappings[existingIndex] = updated;
        setEntityMappings(newEntityMappings);
      } else {
        const newEntityMapping: EntityMapping = {
          source_service: selectedSourceService,
          source_entity: selectedSourceEntity,
          target_service: targetSchema.service,
          target_entity: targetSchema.entity,
          field_mappings: [newMapping],
        };
        setEntityMappings([...entityMappings, newEntityMapping]);
      }
    }
  };

  const handleRemoveMapping = (targetField: string) => {
    if (!targetSchema) return;

    const existingIndex = entityMappings.findIndex(
      (m) =>
        m.source_service === selectedSourceService &&
        m.source_entity === selectedSourceEntity &&
        m.target_service === targetSchema.service &&
        m.target_entity === targetSchema.entity
    );

    if (existingIndex >= 0) {
      const updated = { ...entityMappings[existingIndex] };
      updated.field_mappings = updated.field_mappings.filter((f) => f.target_field !== targetField);

      const newEntityMappings = [...entityMappings];
      newEntityMappings[existingIndex] = updated;
      setEntityMappings(newEntityMappings);
    }
  };

  const handleUpdateMapping = (updatedMapping: FieldMapping) => {
    if (!targetSchema) return;

    const existingIndex = entityMappings.findIndex(
      (m) =>
        m.source_service === selectedSourceService &&
        m.source_entity === selectedSourceEntity &&
        m.target_service === targetSchema.service &&
        m.target_entity === targetSchema.entity
    );

    if (existingIndex >= 0) {
      const updated = { ...entityMappings[existingIndex] };
      const fieldIndex = updated.field_mappings.findIndex((f) => f.target_field === updatedMapping.target_field);

      if (fieldIndex >= 0) {
        updated.field_mappings[fieldIndex] = updatedMapping;
      }

      const newEntityMappings = [...entityMappings];
      newEntityMappings[existingIndex] = updated;
      setEntityMappings(newEntityMappings);
    }
  };

  const handleMappingGenerated = (mapping: EntityMapping) => {
    // Check if mapping already exists
    const existingIndex = entityMappings.findIndex(
      (m) =>
        m.source_service === mapping.source_service &&
        m.source_entity === mapping.source_entity &&
        m.target_service === mapping.target_service &&
        m.target_entity === mapping.target_entity
    );

    if (existingIndex >= 0) {
      const newEntityMappings = [...entityMappings];
      newEntityMappings[existingIndex] = mapping;
      setEntityMappings(newEntityMappings);
    } else {
      addEntityMapping(mapping);
    }
  };

  const handleAiSuggestMappings = async () => {
    if (!selectedSourceSchema || !targetSchema) return;

    setAiSuggesting(true);
    try {
      const response = await fetch('/api/ai/suggest-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_schema: selectedSourceSchema,
          target_schema: targetSchema,
          existing_mappings: fieldMappings,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.mappings) {
          handleMappingGenerated({
            source_service: selectedSourceService,
            source_entity: selectedSourceEntity,
            target_service: targetSchema.service,
            target_entity: targetSchema.entity,
            field_mappings: result.mappings,
          });
        }
      }
    } catch (error) {
      console.error('AI suggestion failed:', error);
    } finally {
      setAiSuggesting(false);
    }
  };

  const getMappingForTarget = (targetField: string) => {
    return fieldMappings.find((m) => m.target_field === targetField);
  };

  const isSourceMapped = (sourceField: string) => {
    return fieldMappings.some((m) => m.source_field === sourceField);
  };

  // Source options for dropdown
  const sourceOptions = sourceSchemas.map((s) => ({
    value: `${s.service}:${s.entity}`,
    label: `${s.service}.${s.entity}`,
  }));

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Mapping Editor</h2>
          <p className="text-[hsl(var(--muted-foreground))]">
            Define how source fields map to target fields. Drag and drop or use AI to suggest mappings.
          </p>
        </div>

        {/* Import Options */}
        <Card className="bg-gradient-to-r from-[hsl(var(--primary))]/5 to-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-[hsl(var(--primary))] mt-0.5" />
                <div>
                  <h3 className="font-medium mb-1">AI-Powered Mapping</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Import mappings from files or let AI suggest field mappings based on your schemas.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImportModal(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Mapping
                </Button>
                <Button
                  onClick={handleAiSuggestMappings}
                  disabled={!selectedSourceSchema || !targetSchema || aiSuggesting}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {aiSuggesting ? 'Suggesting...' : 'AI Suggest'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entity Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Entity Mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Source Entity"
                options={sourceOptions}
                value={selectedSourceKey}
                onChange={(e) => setSelectedSourceKey(e.target.value)}
                placeholder="Select source entity"
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium">Target Entity</label>
                <div className="flex items-center h-10 px-3 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--muted))]">
                  {targetSchema ? (
                    <span>{targetSchema.service}.{targetSchema.entity}</span>
                  ) : (
                    <span className="text-[hsl(var(--muted-foreground))]">No target schema defined</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Field Mapping */}
        {selectedSourceSchema && targetSchema ? (
          <div className="grid grid-cols-2 gap-6">
            {/* Source Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Source: {selectedSourceService}.{selectedSourceEntity}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedSourceSchema.fields.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                      No fields in this schema.
                    </p>
                  ) : (
                    selectedSourceSchema.fields.map((field) => (
                      <DraggableField key={field.name} field={field} isMapped={isSourceMapped(field.name)} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Target Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Target: {targetSchema.service}.{targetSchema.entity}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {targetSchema.fields.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                      No fields in target schema.
                    </p>
                  ) : (
                    targetSchema.fields.map((field) => (
                      <DroppableTargetField
                        key={field.name}
                        field={field}
                        mapping={getMappingForTarget(field.name)}
                        onConfigure={() => setConfigureMapping(getMappingForTarget(field.name) || null)}
                        onRemove={() => handleRemoveMapping(field.name)}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-[hsl(var(--muted-foreground))]">
                {!selectedSourceSchema && !targetSchema
                  ? 'Define source and target schemas in the Schemas tab first.'
                  : !selectedSourceSchema
                  ? 'Select a source entity to start mapping fields.'
                  : 'Define a target schema in the Schemas tab first.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  <span className="font-medium">{entityMappings.length}</span> entity mappings,{' '}
                  <span className="font-medium">
                    {entityMappings.reduce((sum, em) => sum + em.field_mappings.length, 0)}
                  </span>{' '}
                  field mappings total
                </p>
                {targetSchema && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {targetSchema.fields.filter((f) => f.required && !getMappingForTarget(f.name)).length} required
                    fields unmapped in current view
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Computed Field
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeField && (
          <div className="rounded-md border border-[hsl(var(--primary))] bg-[hsl(var(--card))] px-3 py-2 text-sm shadow-lg">
            <span>{activeField.name}</span>
          </div>
        )}
      </DragOverlay>

      {/* Transform Config Modal */}
      <TransformConfigModal
        open={!!configureMapping}
        onClose={() => setConfigureMapping(null)}
        mapping={configureMapping}
        transforms={transforms}
        onSave={handleUpdateMapping}
      />

      {/* Import Modal */}
      <DataInputModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onMappingGenerated={handleMappingGenerated}
        outputType="mapping"
        existingSchemas={sourceSchemas}
      />
    </DndContext>
  );
}
