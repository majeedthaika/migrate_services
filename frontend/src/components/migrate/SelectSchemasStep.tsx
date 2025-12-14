import { CheckSquare, Square, Database } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';

export function SelectSchemasStep() {
  const {
    sourceSchemas,
    selectedSourceSchemaKeys,
    setSelectedSourceSchemaKeys,
    toggleSourceSchemaSelection,
  } = useMigrationStore();

  const allSelected = sourceSchemas.length > 0 &&
    sourceSchemas.every((s) => selectedSourceSchemaKeys.includes(`${s.service}.${s.entity}`));
  const noneSelected = selectedSourceSchemaKeys.length === 0;

  const handleSelectAll = () => {
    setSelectedSourceSchemaKeys(sourceSchemas.map((s) => `${s.service}.${s.entity}`));
  };

  const handleDeselectAll = () => {
    setSelectedSourceSchemaKeys([]);
  };

  // Group schemas by service
  const schemasByService = sourceSchemas.reduce((acc, schema) => {
    if (!acc[schema.service]) {
      acc[schema.service] = [];
    }
    acc[schema.service].push(schema);
    return acc;
  }, {} as Record<string, typeof sourceSchemas>);

  if (sourceSchemas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-[hsl(var(--muted-foreground))]">
            No source schemas configured. Please create schemas in the Schemas tab first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Select Source Schemas to Migrate</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={allSelected}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                disabled={noneSelected}
              >
                Deselect All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(schemasByService).map(([service, schemas]) => (
            <div key={service}>
              <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
                {service}
              </h3>
              <div className="space-y-2">
                {schemas.map((schema) => {
                  const key = `${schema.service}.${schema.entity}`;
                  const isSelected = selectedSourceSchemaKeys.includes(key);
                  const fieldCount = schema.fields.length;

                  return (
                    <button
                      key={key}
                      onClick={() => toggleSourceSchemaSelection(key)}
                      className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                        isSelected
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                          : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-[hsl(var(--primary))]" />
                      ) : (
                        <Square className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                      )}
                      <Database className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                      <div className="flex-1">
                        <span className="font-medium">{schema.entity}</span>
                        {schema.description && (
                          <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            {schema.description}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-[hsl(var(--muted-foreground))]">
                        {fieldCount} field{fieldCount === 1 ? '' : 's'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedSourceSchemaKeys.length > 0 && (
        <Card className="bg-[hsl(var(--primary))]/5 border-[hsl(var(--primary))]/20">
          <CardContent className="py-4">
            <p className="font-medium">
              {selectedSourceSchemaKeys.length} schema{selectedSourceSchemaKeys.length === 1 ? '' : 's'} selected
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {selectedSourceSchemaKeys.join(', ')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
