import { useState } from 'react';
import { ChevronDown, ChevronRight, Database, Target, GitBranch, Circle } from 'lucide-react';
import { useMigrationStore } from '@/store/migration';
import type { EntitySchema, FieldSchema } from '@/types/migration';

interface SchemaTreeProps {
  schema: EntitySchema;
  isTarget?: boolean;
}

function FieldItem({ field, depth = 0 }: { field: FieldSchema; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = field.properties && field.properties.length > 0;
  const paddingLeft = 12 + depth * 16;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 text-xs hover:bg-[hsl(var(--accent))] rounded cursor-default"
        style={{ paddingLeft }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
          ) : (
            <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
          )
        ) : (
          <Circle className="h-2 w-2 text-[hsl(var(--muted-foreground))] ml-0.5 mr-0.5" />
        )}
        <span className={field.required ? 'font-medium' : 'text-[hsl(var(--muted-foreground))]'}>
          {field.name}
        </span>
        <span className="text-[hsl(var(--muted-foreground))] ml-1">
          {field.type}
          {field.required && <span className="text-[hsl(var(--destructive))]">*</span>}
        </span>
      </div>
      {hasChildren && expanded && (
        <div>
          {field.properties!.map((child) => (
            <FieldItem key={child.name} field={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaTree({ schema, isTarget }: SchemaTreeProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm font-medium hover:bg-[hsl(var(--accent))] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        )}
        <span className={isTarget ? 'text-[hsl(var(--primary))]' : ''}>
          {schema.entity}
        </span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          ({schema.fields.length} fields)
        </span>
      </button>
      {expanded && (
        <div className="ml-2 border-l border-[hsl(var(--border))]">
          {schema.fields.map((field) => (
            <FieldItem key={field.name} field={field} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaPanel() {
  const { sourceSchemas, targetSchema, entityMappings } = useMigrationStore();

  // Group source schemas by service
  const schemasByService = sourceSchemas.reduce((acc, schema) => {
    if (!acc[schema.service]) {
      acc[schema.service] = [];
    }
    acc[schema.service].push(schema);
    return acc;
  }, {} as Record<string, EntitySchema[]>);

  // Calculate mapping stats
  const totalFieldMappings = entityMappings.reduce(
    (sum, em) => sum + em.field_mappings.length,
    0
  );
  const unmappedRequired = targetSchema
    ? targetSchema.fields.filter((f) => f.required).length -
      entityMappings.reduce((sum, em) => {
        const mappedTargets = new Set(em.field_mappings.map((fm) => fm.target_field.split('.')[0]));
        return sum + targetSchema!.fields.filter((f) => f.required && mappedTargets.has(f.name)).length;
      }, 0)
    : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Source Schemas */}
      <div className="flex-1 overflow-auto p-3">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            <Database className="h-4 w-4" />
            Source Schemas
          </div>
          {Object.entries(schemasByService).map(([service, schemas]) => (
            <div key={service} className="mb-3">
              <div className="text-xs font-medium text-[hsl(var(--muted-foreground))] px-2 py-1 bg-[hsl(var(--muted))] rounded mb-1">
                {service.charAt(0).toUpperCase() + service.slice(1)}
              </div>
              {schemas.map((schema) => (
                <SchemaTree key={`${schema.service}-${schema.entity}`} schema={schema} />
              ))}
            </div>
          ))}
          {sourceSchemas.length === 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] px-2">
              No source schemas defined
            </p>
          )}
        </div>

        {/* Target Schema */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            <Target className="h-4 w-4" />
            Target Schema
          </div>
          {targetSchema ? (
            <div className="mb-3">
              <div className="text-xs font-medium text-[hsl(var(--muted-foreground))] px-2 py-1 bg-[hsl(var(--muted))] rounded mb-1">
                {targetSchema.service.charAt(0).toUpperCase() + targetSchema.service.slice(1)}
              </div>
              <SchemaTree schema={targetSchema} isTarget />
            </div>
          ) : (
            <p className="text-xs text-[hsl(var(--muted-foreground))] px-2">
              No target schema defined
            </p>
          )}
        </div>
      </div>

      {/* Mapping Summary */}
      <div className="border-t p-3 bg-[hsl(var(--muted))]">
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          <GitBranch className="h-4 w-4" />
          Mapping Summary
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[hsl(var(--background))] rounded p-2">
            <div className="text-lg font-bold">{entityMappings.length}</div>
            <div className="text-[hsl(var(--muted-foreground))]">Entity mappings</div>
          </div>
          <div className="bg-[hsl(var(--background))] rounded p-2">
            <div className="text-lg font-bold">{totalFieldMappings}</div>
            <div className="text-[hsl(var(--muted-foreground))]">Field mappings</div>
          </div>
          {unmappedRequired > 0 && (
            <div className="col-span-2 bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] rounded p-2">
              <div className="font-medium">{unmappedRequired} unmapped required fields</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
