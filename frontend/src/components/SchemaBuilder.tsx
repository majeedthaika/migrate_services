import { useState } from 'react';
import { Plus, Upload, Globe, Trash2, Edit2, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';
import type { EntitySchema, FieldSchema } from '@/types/migration';

const FIELD_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'integer', label: 'Integer' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
  { value: 'timestamp', label: 'Timestamp' },
];

interface FieldEditorProps {
  field: FieldSchema;
  onUpdate: (field: FieldSchema) => void;
  onDelete: () => void;
  depth?: number;
}

function FieldEditor({ field, onUpdate, onDelete, depth = 0 }: FieldEditorProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [editedField, setEditedField] = useState(field);
  const hasChildren = field.type === 'object' && field.properties;

  const handleSave = () => {
    onUpdate(editedField);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditedField(field);
    setEditing(false);
  };

  const handleAddChild = () => {
    const newChild: FieldSchema = {
      name: 'new_field',
      type: 'string',
      required: false,
      description: '',
    };
    onUpdate({
      ...field,
      properties: [...(field.properties || []), newChild],
    });
  };

  const handleUpdateChild = (index: number, updatedChild: FieldSchema) => {
    const newProperties = [...(field.properties || [])];
    newProperties[index] = updatedChild;
    onUpdate({ ...field, properties: newProperties });
  };

  const handleDeleteChild = (index: number) => {
    const newProperties = (field.properties || []).filter((_, i) => i !== index);
    onUpdate({ ...field, properties: newProperties });
  };

  const paddingLeft = depth * 24;

  if (editing) {
    return (
      <div className="border rounded p-2 mb-2 bg-[hsl(var(--muted))]" style={{ marginLeft: paddingLeft }}>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <Input
            value={editedField.name}
            onChange={(e) => setEditedField({ ...editedField, name: e.target.value })}
            placeholder="Field name"
          />
          <Select
            options={FIELD_TYPES}
            value={editedField.type}
            onChange={(e) => setEditedField({ ...editedField, type: e.target.value })}
          />
          <Input
            value={editedField.description}
            onChange={(e) => setEditedField({ ...editedField, description: e.target.value })}
            placeholder="Description"
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={editedField.required}
                onChange={(e) => setEditedField({ ...editedField, required: e.target.checked })}
              />
              Required
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}>
            <Check className="h-3 w-3 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginLeft: paddingLeft }}>
      <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-[hsl(var(--muted))] rounded group">
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            ) : (
              <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            )}
          </button>
        )}
        <span className={`font-medium ${field.required ? '' : 'text-[hsl(var(--muted-foreground))]'}`}>
          {field.name}
        </span>
        <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))] px-1.5 py-0.5 rounded">
          {field.type}
        </span>
        {field.required && (
          <span className="text-xs text-[hsl(var(--destructive))]">required</span>
        )}
        {field.description && (
          <span className="text-xs text-[hsl(var(--muted-foreground))] truncate flex-1">
            - {field.description}
          </span>
        )}
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1 hover:bg-[hsl(var(--accent))] rounded"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-[hsl(var(--destructive))]/20 rounded text-[hsl(var(--destructive))]"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="border-l ml-4 pl-2">
          {field.properties!.map((child, index) => (
            <FieldEditor
              key={child.name}
              field={child}
              onUpdate={(updated) => handleUpdateChild(index, updated)}
              onDelete={() => handleDeleteChild(index)}
              depth={0}
            />
          ))}
          <button
            onClick={handleAddChild}
            className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] py-1 px-2"
          >
            <Plus className="h-3 w-3" />
            Add nested field
          </button>
        </div>
      )}
    </div>
  );
}

interface SchemaEditorCardProps {
  schema: EntitySchema;
  isTarget?: boolean;
  onUpdate: (schema: EntitySchema) => void;
  onDelete: () => void;
}

function SchemaEditorCard({ schema, isTarget, onUpdate, onDelete }: SchemaEditorCardProps) {
  const [editingHeader, setEditingHeader] = useState(false);
  const [editedSchema, setEditedSchema] = useState(schema);

  const handleAddField = () => {
    const newField: FieldSchema = {
      name: 'new_field',
      type: 'string',
      required: false,
      description: '',
    };
    onUpdate({ ...schema, fields: [...schema.fields, newField] });
  };

  const handleUpdateField = (index: number, updatedField: FieldSchema) => {
    const newFields = [...schema.fields];
    newFields[index] = updatedField;
    onUpdate({ ...schema, fields: newFields });
  };

  const handleDeleteField = (index: number) => {
    const newFields = schema.fields.filter((_, i) => i !== index);
    onUpdate({ ...schema, fields: newFields });
  };

  const handleSaveHeader = () => {
    onUpdate(editedSchema);
    setEditingHeader(false);
  };

  return (
    <Card className={isTarget ? 'border-[hsl(var(--primary))]' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          {editingHeader ? (
            <div className="flex gap-2 flex-1">
              <Input
                value={editedSchema.service}
                onChange={(e) => setEditedSchema({ ...editedSchema, service: e.target.value })}
                placeholder="Service"
                className="w-32"
              />
              <Input
                value={editedSchema.entity}
                onChange={(e) => setEditedSchema({ ...editedSchema, entity: e.target.value })}
                placeholder="Entity"
                className="w-32"
              />
              <Button size="sm" onClick={handleSaveHeader}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingHeader(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-xs uppercase text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-2 py-0.5 rounded">
                  {schema.service}
                </span>
                {schema.entity}
                {isTarget && (
                  <span className="text-xs text-[hsl(var(--primary))]">TARGET</span>
                )}
              </CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditingHeader(true)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} className="text-[hsl(var(--destructive))]">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </>
          )}
        </div>
        {schema.description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{schema.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {schema.fields.map((field, index) => (
            <FieldEditor
              key={field.name}
              field={field}
              onUpdate={(updated) => handleUpdateField(index, updated)}
              onDelete={() => handleDeleteField(index)}
            />
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={handleAddField} className="mt-2">
          <Plus className="h-3 w-3 mr-1" />
          Add Field
        </Button>
      </CardContent>
    </Card>
  );
}

export function SchemaBuilder() {
  const {
    sourceSchemas,
    targetSchema,
    addSourceSchema,
    updateSourceSchema,
    removeSourceSchema,
    setTargetSchema,
  } = useMigrationStore();

  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceService, setNewSourceService] = useState('');
  const [newSourceEntity, setNewSourceEntity] = useState('');

  const handleAddSourceSchema = () => {
    if (!newSourceService || !newSourceEntity) return;
    addSourceSchema({
      service: newSourceService.toLowerCase(),
      entity: newSourceEntity,
      fields: [],
    });
    setNewSourceService('');
    setNewSourceEntity('');
    setShowAddSource(false);
  };

  const handleAddTargetSchema = () => {
    setTargetSchema({
      service: 'target',
      entity: 'Entity',
      fields: [],
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Schema Builder</h2>
        <p className="text-[hsl(var(--muted-foreground))]">
          Define source and target schemas. You can load existing schemas, upload JSON/CSV data to infer schemas, or create them manually.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setShowAddSource(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Source Schema
        </Button>
        <Button variant="outline" disabled>
          <Upload className="h-4 w-4 mr-2" />
          Upload JSON/CSV
        </Button>
        <Button variant="outline" disabled>
          <Globe className="h-4 w-4 mr-2" />
          Discover from API
        </Button>
      </div>

      {/* Add Source Form */}
      {showAddSource && (
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-2 items-end">
              <div>
                <label className="text-sm font-medium mb-1 block">Service</label>
                <Input
                  value={newSourceService}
                  onChange={(e) => setNewSourceService(e.target.value)}
                  placeholder="e.g., stripe"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Entity</label>
                <Input
                  value={newSourceEntity}
                  onChange={(e) => setNewSourceEntity(e.target.value)}
                  placeholder="e.g., Customer"
                />
              </div>
              <Button onClick={handleAddSourceSchema}>Add</Button>
              <Button variant="outline" onClick={() => setShowAddSource(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Schemas */}
      <div>
        <h3 className="text-lg font-medium mb-4">Source Schemas</h3>
        {sourceSchemas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-[hsl(var(--muted-foreground))]">
              No source schemas defined. Add a schema to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sourceSchemas.map((schema) => (
              <SchemaEditorCard
                key={`${schema.service}-${schema.entity}`}
                schema={schema}
                onUpdate={(updated) => updateSourceSchema(schema.service, schema.entity, updated)}
                onDelete={() => removeSourceSchema(schema.service, schema.entity)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Target Schema */}
      <div>
        <h3 className="text-lg font-medium mb-4">Target Schema</h3>
        {targetSchema ? (
          <SchemaEditorCard
            schema={targetSchema}
            isTarget
            onUpdate={setTargetSchema}
            onDelete={() => setTargetSchema(null)}
          />
        ) : (
          <Card className="border-dashed border-[hsl(var(--primary))]/50">
            <CardContent className="py-8 text-center">
              <p className="text-[hsl(var(--muted-foreground))] mb-4">
                No target schema defined.
              </p>
              <Button onClick={handleAddTargetSchema}>
                <Plus className="h-4 w-4 mr-2" />
                Add Target Schema
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
