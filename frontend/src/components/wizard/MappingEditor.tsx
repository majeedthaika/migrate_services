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
import { ArrowRight, Plus, Trash2, Settings, GripVertical } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Input, Modal } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';
import { schemaAPI, mappingAPI } from '@/lib/api';
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
  const { sources, targetService, entityMappings, setEntityMappings } = useMigrationStore();

  const [sourceSchema, setSourceSchema] = useState<FieldSchema[]>([]);
  const [targetSchema, setTargetSchema] = useState<FieldSchema[]>([]);
  const [transforms, setTransforms] = useState<TransformType[]>([]);
  const [activeField, setActiveField] = useState<FieldSchema | null>(null);
  const [configureMapping, setConfigureMapping] = useState<FieldMapping | null>(null);
  const [selectedSourceEntity, setSelectedSourceEntity] = useState('');
  const [selectedTargetEntity, setSelectedTargetEntity] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Get current entity mapping
  const currentMapping = entityMappings.find(
    (m) => m.source_entity === selectedSourceEntity && m.target_entity === selectedTargetEntity
  );
  const fieldMappings = currentMapping?.field_mappings || [];

  // Load schemas and transforms
  useEffect(() => {
    const loadData = async () => {
      // Load transforms
      const transformsRes = await mappingAPI.getTransformTypes();
      if (transformsRes.data) {
        setTransforms(transformsRes.data.transforms);
      }
    };
    loadData();
  }, []);

  // Load source schema when entity changes
  useEffect(() => {
    const loadSourceSchema = async () => {
      if (!selectedSourceEntity || sources.length === 0) return;

      const source = sources.find((s) => s.entity === selectedSourceEntity);
      if (source) {
        const res = await schemaAPI.getEntity(source.service, source.entity);
        if (res.data) {
          setSourceSchema(res.data.fields);
        }
      }
    };
    loadSourceSchema();
  }, [selectedSourceEntity, sources]);

  // Load target schema when entity changes
  useEffect(() => {
    const loadTargetSchema = async () => {
      if (!selectedTargetEntity || !targetService) return;

      const res = await schemaAPI.getEntity(targetService, selectedTargetEntity);
      if (res.data) {
        setTargetSchema(res.data.fields);
      }
    };
    loadTargetSchema();
  }, [selectedTargetEntity, targetService]);

  // Auto-select first available entities
  useEffect(() => {
    if (sources.length > 0 && !selectedSourceEntity) {
      setSelectedSourceEntity(sources[0].entity);
    }
  }, [sources, selectedSourceEntity]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveField(event.active.data.current?.field);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveField(null);

    const { active, over } = event;
    if (!over) return;

    const sourceField = active.data.current?.field as FieldSchema;
    const targetField = over.data.current?.field as FieldSchema;

    if (sourceField && targetField) {
      // Create new mapping
      const newMapping: FieldMapping = {
        source_field: sourceField.name,
        target_field: targetField.name,
        transform: 'direct',
        config: {},
      };

      // Update entity mappings
      const existingIndex = entityMappings.findIndex(
        (m) => m.source_entity === selectedSourceEntity && m.target_entity === selectedTargetEntity
      );

      if (existingIndex >= 0) {
        // Update existing entity mapping
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
        // Create new entity mapping
        const source = sources.find((s) => s.entity === selectedSourceEntity);
        const newEntityMapping: EntityMapping = {
          source_service: source?.service || '',
          source_entity: selectedSourceEntity,
          target_service: targetService,
          target_entity: selectedTargetEntity,
          field_mappings: [newMapping],
        };
        setEntityMappings([...entityMappings, newEntityMapping]);
      }
    }
  };

  const handleRemoveMapping = (targetField: string) => {
    const existingIndex = entityMappings.findIndex(
      (m) => m.source_entity === selectedSourceEntity && m.target_entity === selectedTargetEntity
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
    const existingIndex = entityMappings.findIndex(
      (m) => m.source_entity === selectedSourceEntity && m.target_entity === selectedTargetEntity
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

  const getMappingForTarget = (targetField: string) => {
    return fieldMappings.find((m) => m.target_field === targetField);
  };

  const isSourceMapped = (sourceField: string) => {
    return fieldMappings.some((m) => m.source_field === sourceField);
  };

  // Get unique source entities from sources
  const sourceEntities = [...new Set(sources.map((s) => s.entity))];

  // Target entities based on target service
  const targetEntities =
    targetService === 'chargebee'
      ? ['Customer', 'Subscription']
      : targetService === 'stripe'
      ? ['Customer', 'Subscription', 'Invoice']
      : targetService === 'salesforce'
      ? ['Account', 'Contact']
      : [];

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {/* Entity Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Entity Mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Source Entity"
                options={sourceEntities.map((e) => ({ value: e, label: e }))}
                value={selectedSourceEntity}
                onChange={(e) => setSelectedSourceEntity(e.target.value)}
                placeholder="Select source entity"
              />
              <Select
                label="Target Entity"
                options={targetEntities.map((e) => ({ value: e, label: e }))}
                value={selectedTargetEntity}
                onChange={(e) => setSelectedTargetEntity(e.target.value)}
                placeholder="Select target entity"
              />
            </div>
          </CardContent>
        </Card>

        {/* Field Mapping */}
        {selectedSourceEntity && selectedTargetEntity && (
          <div className="grid grid-cols-2 gap-6">
            {/* Source Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Source Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sourceSchema.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                      No schema available. Configure source to load fields.
                    </p>
                  ) : (
                    sourceSchema.map((field) => (
                      <DraggableField key={field.name} field={field} isMapped={isSourceMapped(field.name)} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Target Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Target Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {targetSchema.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                      No schema available. Select target entity to load fields.
                    </p>
                  ) : (
                    targetSchema.map((field) => (
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
        )}

        {/* Summary */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  <span className="font-medium">{fieldMappings.length}</span> field mappings configured
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {targetSchema.filter((f) => f.required && !getMappingForTarget(f.name)).length} required fields
                  unmapped
                </p>
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
    </DndContext>
  );
}
